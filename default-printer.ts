import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrintAgentError } from './print-agent-error';

const execFileAsync = promisify(execFile);

type PdfScale = 'noscale' | 'shrink' | 'fit';

interface DefaultPrinterOptions {
  jobTitle: string;
  paperSize?: string;
  scale: PdfScale;
}

function cupsPaperSize(paperSize: string): string {
  return paperSize.toUpperCase() === 'LETTER' ? 'Letter' : paperSize;
}

export async function sendPdfToDefaultPrinter(
  filePath: string,
  options: DefaultPrinterOptions,
): Promise<void> {
  if (process.platform === 'win32') {
    const { getDefaultPrinter, print } = await import('pdf-to-printer');
    const defaultPrinter = await getDefaultPrinter();
    if (!defaultPrinter) {
      throw new PrintAgentError(
        'DEFAULT_PRINTER_NOT_FOUND',
        'No hay una impresora predeterminada configurada en Windows.',
      );
    }

    await print(filePath, {
      printer: defaultPrinter.name,
      ...(options.paperSize ? { paperSize: options.paperSize } : {}),
      scale: options.scale,
      silent: true,
    });
    return;
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    const argumentsList: string[] = [];
    if (options.scale === 'fit') {
      argumentsList.push('-o', 'fit-to-page');
    }
    if (options.paperSize) {
      argumentsList.push(
        '-o',
        `media=${cupsPaperSize(options.paperSize)}`,
      );
    }
    argumentsList.push('-t', options.jobTitle, '--', filePath);

    try {
      await execFileAsync('lp', argumentsList);
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
