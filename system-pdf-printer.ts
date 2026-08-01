import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type {
  PrintDocumentSummary,
  PrintTicketSocketPayload,
  SystemPaperSize,
} from './printer-contract';
import { PrintAgentError } from './print-agent-error';

const execFileAsync = promisify(execFile);
const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});
const calendarDate = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
}

function formatCalendarDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match
    ? calendarDate.format(new Date(`${match[1]}T00:00:00.000Z`))
    : value;
}

function safeText(value?: string): string {
  return value?.trim() || '—';
}

function addSectionTitle(document: PDFKit.PDFDocument, title: string): void {
  const left = document.page.margins.left;
  document.x = left;
  document
    .moveDown(0.7)
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .fillColor('#24465f')
    .text(title.toUpperCase(), left);
  document
    .moveDown(0.2)
    .strokeColor('#c9d5dd')
    .lineWidth(0.7)
    .moveTo(left, document.y)
    .lineTo(document.page.width - document.page.margins.right, document.y)
    .stroke()
    .moveDown(0.45);
}

function addLabelValue(
  document: PDFKit.PDFDocument,
  label: string,
  value?: string,
): void {
  const left = document.page.margins.left;
  const usableWidth =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right;
  document
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#334155')
    .text(`${label}:`, left, document.y, { continued: true, width: usableWidth })
    .font('Helvetica')
    .fillColor('#111827')
    .text(` ${safeText(value)}`, { width: usableWidth });
}

function addSummary(
  document: PDFKit.PDFDocument,
  summary: PrintDocumentSummary,
): void {
  addSectionTitle(document, 'Recepción');
  addLabelValue(document, 'Cliente', summary.customerName);
  addLabelValue(document, 'Técnico', summary.technicianName);
  addLabelValue(document, 'Fecha de ingreso', formatDate(summary.createdAt));
  addLabelValue(document, 'Prioridad', summary.priorityLabelEs);

  addSectionTitle(document, 'Equipo');
  addLabelValue(
    document,
    'Equipo',
    [summary.deviceType, summary.deviceBrand, summary.deviceModel]
      .filter(Boolean)
      .join(' '),
  );
  addLabelValue(document, 'Nº de serie', summary.serialNumber);

  addSectionTitle(document, 'Servicio');
  addLabelValue(document, 'Falla informada', summary.problemDescription);
  addLabelValue(document, 'Diagnóstico', summary.diagnosis);
  addLabelValue(document, 'Trabajo realizado', summary.workDone);
  addLabelValue(
    document,
    'Entrega estimada',
    formatCalendarDate(summary.estimatedDelivery),
  );
  if (summary.deliveredAt) {
    addLabelValue(document, 'Entregado', formatDate(summary.deliveredAt));
  }

  addSectionTitle(document, 'Repuestos e insumos');
  if (summary.items.length === 0) {
    document.font('Helvetica').fontSize(9).fillColor('#111827').text('Sin ítems.');
  } else {
    for (const item of summary.items) {
      const total = item.quantity * item.unitPrice;
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text(
          `${item.quantity} × ${item.productName} — ${money.format(total)}`,
          { width: 500 },
        );
    }
  }

  addSectionTitle(document, 'Totales');
  addLabelValue(document, 'Mano de obra', money.format(summary.laborCost));
  addLabelValue(document, 'Repuestos', money.format(summary.partsCost));
  document
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#0f172a')
    .text(`TOTAL: ${money.format(summary.totalCost)}`);
}

export async function generateSystemPdf(
  filePath: string,
  data: PrintTicketSocketPayload,
): Promise<void> {
  const pageSize: SystemPaperSize = data.paperSize ?? 'LETTER';
  const qrBuffer = await QRCode.toBuffer(data.tracking.url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 180,
  });
  const document = new PDFDocument({
    size: pageSize,
    margins: { top: 42, right: 48, bottom: 42, left: 48 },
    info: {
      Title: `Orden de servicio ${data.orderNumber}`,
      Subject: 'Resumen de orden de servicio',
    },
  });
  const output = createWriteStream(filePath);
  const completed = new Promise<void>((resolve, reject) => {
    output.once('finish', resolve);
    output.once('error', reject);
    document.once('error', reject);
  });
  document.pipe(output);
  const paintPageBackground = () => {
    const currentX = document.x;
    const currentY = document.y;
    document
      .save()
      .rect(0, 0, document.page.width, document.page.height)
      .fill('#ffffff')
      .restore();
    document.x = currentX;
    document.y = currentY;
  };
  paintPageBackground();
  document.x = document.page.margins.left;
  document.y = document.page.margins.top;

  document
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#173b57')
    .text('SERVICIO TÉCNICO', { align: 'center' })
    .fontSize(11)
    .fillColor('#475569')
    .text('RESUMEN DE ORDEN DE SERVICIO', { align: 'center' })
    .moveDown(0.8);

  const cardTop = document.y;
  document
    .roundedRect(
      document.page.margins.left,
      cardTop,
      document.page.width -
        document.page.margins.left -
        document.page.margins.right,
      52,
      5,
    )
    .fill('#eef4f7');
  const cardY = cardTop + 17;
  const cardWidth =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right;
  document
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#173b57')
    .text(`ORDEN ${data.orderNumber}`, document.page.margins.left + 14, cardY, {
      width: cardWidth / 2,
    })
    .fontSize(10)
    .fillColor('#334155')
    .text(
      `Estado: ${data.summary.statusLabelEs}`,
      document.page.width - document.page.margins.right - 230,
      cardY + 2,
      { width: 215, align: 'right' },
    );
  document.x = document.page.margins.left;
  document.y = cardTop + 56;

  addSummary(document, data.summary);
  document.moveDown(1);

  if (document.y > document.page.height - 205) {
    document.addPage();
  }
  const qrY = document.y;
  document.image(qrBuffer, document.page.margins.left, qrY, {
    fit: [112, 112],
  });
  document
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#173b57')
    .text('Consulta el estado de tu orden', document.page.margins.left + 130, qrY + 12)
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#475569')
    .text(data.tracking.url, document.page.margins.left + 130, qrY + 34, {
      width: 350,
      link: data.tracking.url,
      underline: true,
    })
    .moveDown(0.6)
    .fillColor('#64748b')
    .text(
      `Documento generado: ${formatDate(data.generatedAt)}. La confirmación indica envío a la cola del sistema; no confirma la salida física del papel.`,
      { width: 350 },
    );

  document.end();
  await completed;
}

async function sendToDefaultPrinter(
  filePath: string,
  paperSize: SystemPaperSize,
  orderNumber: string,
): Promise<void> {
  if (process.platform === 'win32') {
    const { print } = await import('pdf-to-printer');
    await print(filePath, {
      paperSize,
      scale: 'fit',
      silent: true,
    });
    return;
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      await execFileAsync('lp', [
        '-o',
        'fit-to-page',
        '-o',
        `media=${paperSize === 'LETTER' ? 'Letter' : 'A4'}`,
        '-t',
        `Orden ${orderNumber}`,
        '--',
        filePath,
      ]);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        throw new PrintAgentError(
          'PRINT_COMMAND_NOT_FOUND',
          'No se encontró el comando lp. Instala o habilita CUPS.',
        );
      }
      throw new PrintAgentError(
        'SYSTEM_PRINT_FAILED',
        error instanceof Error
          ? error.message
          : 'El sistema operativo rechazó el documento.',
      );
    }
    return;
  }

  throw new PrintAgentError(
    'UNSUPPORTED_PLATFORM',
    `La impresión PDF no está soportada en ${process.platform}.`,
  );
}

export async function printSystemPdf(
  data: PrintTicketSocketPayload,
): Promise<void> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'serviciotecnico-print-'),
  );
  const pdfPath = join(temporaryDirectory, 'orden-servicio.pdf');
  let acceptedBySpooler = false;
  try {
    await generateSystemPdf(pdfPath, data);
    await sendToDefaultPrinter(
      pdfPath,
      data.paperSize ?? 'LETTER',
      data.orderNumber,
    );
    acceptedBySpooler = true;
  } catch (error) {
    if (error instanceof PrintAgentError) {
      throw error;
    }
    throw new PrintAgentError(
      'PDF_PRINT_FAILED',
      error instanceof Error
        ? error.message
        : 'No fue posible generar o imprimir el PDF.',
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
