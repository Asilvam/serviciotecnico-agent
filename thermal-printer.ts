import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { sendPdfToDefaultPrinter } from './default-printer';
import type { PrintTicketSocketPayload } from './printer-contract';
import { PrintAgentError } from './print-agent-error';

const pointsPerMillimeter = 72 / 25.4;
const pageWidth = 80 * pointsPerMillimeter;
const horizontalMargin = 12;
const topMargin = 12;
const bottomMargin = 12;
const fontSize = 7.5;
const lineHeight = 9.4;
const qrSize = 92;
const qrGap = 8;
const qrCaptionHeight = 34;
const minimumPageHeight = 240;

function ticketLines(content: string): string[] {
  const normalized = content.replace(/\r\n?/g, '\n').trimEnd();
  return normalized ? normalized.split('\n') : [''];
}

export function calculateThermalPageHeight(lineCount: number): number {
  const contentHeight = Math.max(1, lineCount) * lineHeight;
  return Math.max(
    minimumPageHeight,
    topMargin + contentHeight + qrGap + qrSize + qrCaptionHeight + bottomMargin,
  );
}

export async function generateThermalPdf(
  filePath: string,
  data: PrintTicketSocketPayload,
): Promise<void> {
  const lines = ticketLines(data.content);
  const pageHeight = calculateThermalPageHeight(lines.length);
  const usableWidth = pageWidth - horizontalMargin * 2;
  const qrBuffer = await QRCode.toBuffer(data.tracking.url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });
  const document = new PDFDocument({
    size: [pageWidth, pageHeight],
    margins: {
      top: topMargin,
      right: horizontalMargin,
      bottom: bottomMargin,
      left: horizontalMargin,
    },
    info: {
      Title: `Ticket de servicio ${data.orderNumber}`,
      Subject: 'Ticket térmico de orden de servicio',
    },
  });
  const output = createWriteStream(filePath);
  const completed = new Promise<void>((resolve, reject) => {
    output.once('finish', resolve);
    output.once('error', reject);
    document.once('error', reject);
  });
  document.pipe(output);

  document
    .rect(0, 0, pageWidth, pageHeight)
    .fill('#ffffff')
    .fillColor('#000000')
    .font('Courier')
    .fontSize(fontSize);

  lines.forEach((line, index) => {
    document.text(
      line,
      horizontalMargin,
      topMargin + index * lineHeight,
      {
        width: usableWidth,
        lineBreak: false,
      },
    );
  });

  const qrTop = topMargin + lines.length * lineHeight + qrGap;
  document.image(qrBuffer, (pageWidth - qrSize) / 2, qrTop, {
    width: qrSize,
    height: qrSize,
  });
  document
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .text('CONSULTA EL ESTADO DE TU ORDEN', horizontalMargin, qrTop + qrSize + 4, {
      align: 'center',
      width: usableWidth,
    })
    .font('Helvetica')
    .fontSize(6.5)
    .text(
      `Estado actual: ${data.tracking.statusLabelEs}`,
      horizontalMargin,
      qrTop + qrSize + 15,
      { align: 'center', width: usableWidth },
    );

  document.end();
  await completed;
}

export async function printThermalTicket(
  data: PrintTicketSocketPayload,
): Promise<void> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'serviciotecnico-ticket-'),
  );
  const pdfPath = join(temporaryDirectory, 'ticket-80mm.pdf');
  let acceptedBySpooler = false;
  try {
    await generateThermalPdf(pdfPath, data);
    const configuredPaperSize = process.env.THERMAL_PAPER_SIZE?.trim();
    await sendPdfToDefaultPrinter(pdfPath, {
      jobTitle: `Ticket ${data.orderNumber}`,
      ...(configuredPaperSize ? { paperSize: configuredPaperSize } : {}),
      scale: 'noscale',
    });
    acceptedBySpooler = true;
  } catch (error) {
    if (error instanceof PrintAgentError) {
      throw error;
    }
    throw new PrintAgentError(
      'THERMAL_PDF_PRINT_FAILED',
      error instanceof Error
        ? error.message
        : 'No fue posible generar o imprimir el ticket de 80 mm.',
    );
  } finally {
    try {
      await rm(temporaryDirectory, { recursive: true, force: true });
    } catch (error) {
      if (acceptedBySpooler) {
        throw new PrintAgentError(
          'TEMP_CLEANUP_FAILED',
          error instanceof Error
            ? error.message
            : 'No fue posible eliminar el PDF temporal.',
          true,
        );
      }
    }
  }
}
