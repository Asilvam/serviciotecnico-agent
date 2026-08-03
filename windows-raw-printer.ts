import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PrintAgentError } from './print-agent-error';

const execFileAsync = promisify(execFile);

type RawPrintExecutionError = Error & {
  code?: number | string;
  stderr?: string;
  stdout?: string;
};

async function resolveRawPrintScript(): Promise<string> {
  const candidates = [
    join(__dirname, 'windows-print-raw.ps1'),
    join(__dirname, '..', 'windows-print-raw.ps1'),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue with the next location used by source and portable builds.
    }
  }

  throw new PrintAgentError(
    'RAW_PRINT_SCRIPT_NOT_FOUND',
    'No se encontró windows-print-raw.ps1 en la instalación del agent.',
  );
}

function executionMessage(error: RawPrintExecutionError): string {
  return (
    error.stderr?.trim() ||
    error.stdout?.trim() ||
    error.message ||
    'Windows rechazó el trabajo RAW.'
  );
}

export async function sendRawToDefaultWindowsPrinter(
  bytes: Buffer,
  documentName: string,
): Promise<void> {
  if (process.platform !== 'win32') {
    throw new PrintAgentError(
      'UNSUPPORTED_RAW_PLATFORM',
      `La impresión RAW de Windows no está soportada en ${process.platform}.`,
    );
  }

  const { getDefaultPrinter } = await import('pdf-to-printer');
  const defaultPrinter = await getDefaultPrinter();
  if (!defaultPrinter) {
    throw new PrintAgentError(
      'DEFAULT_PRINTER_NOT_FOUND',
      'No hay una impresora predeterminada configurada en Windows.',
    );
  }

  const scriptPath = await resolveRawPrintScript();
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'serviciotecnico-raw-'),
  );
  const dataPath = join(temporaryDirectory, 'ticket.bin');

  try {
    await writeFile(dataPath, bytes);
    await execFileAsync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-PrinterName',
        defaultPrinter.name,
        '-DataPath',
        dataPath,
        '-DocumentName',
        documentName,
        '-TimeoutSeconds',
        '15',
      ],
      {
        timeout: 25_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
  } catch (error) {
    if (error instanceof PrintAgentError) {
      throw error;
    }
    const executionError = error as RawPrintExecutionError;
    const outcomeUncertain =
      executionError.code === 3 || executionError.code === 'ETIMEDOUT';
    throw new PrintAgentError(
      outcomeUncertain
        ? 'WINDOWS_PRINT_STATUS_TIMEOUT'
        : 'WINDOWS_RAW_PRINT_FAILED',
      executionMessage(executionError),
      outcomeUncertain,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
