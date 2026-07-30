import 'dotenv/config';
import { hostname } from 'node:os';
import { io, Socket } from 'socket.io-client';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import type { PrintTicketSocketPayload } from './printer-contract';
import { PrintAgentError } from './print-agent-error';
import { printSystemPdf } from './system-pdf-printer';
import { printThermalTicket } from './thermal-printer';

type PrintTicketAcknowledgement = {
  accepted: boolean;
  jobId: string;
  message?: string;
  duplicate?: boolean;
};

type PrintTicketAcknowledge = (
  acknowledgement: PrintTicketAcknowledgement,
) => void;

type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

const LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message}`,
    ),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.colorize({ all: true }),
    }),
    new (winston.transports as any).DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      maxFiles: '14d',
    }),
  ],
});

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === 'tu_token_seguro' || value.startsWith('replace-')) {
    throw new Error(`${name} must be configured with a secure value.`);
  }
  return value;
}

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3500';
const TOKEN = requiredSecret('PRINT_TOKEN');
const AGENT_ID = process.env.AGENT_ID?.trim() || hostname();
const PRINTER_ID = process.env.PRINTER_ID?.trim() || 'default-printer';

const socket: Socket = io(SERVER_URL, {
  auth: {
    token: TOKEN,
    agentId: AGENT_ID,
    printerId: PRINTER_ID,
  },
  reconnection: true,
});

socket.on('connect', () =>
  logger.info(
    `Connected to API. socketId=${socket.id} agentId=${AGENT_ID} printerId=${PRINTER_ID}`,
  ),
);
socket.on('disconnect', (reason) =>
  logger.info(`Disconnected: ${reason}`),
);
socket.on('connect_error', (error) =>
  logger.error(`Socket connect error: ${error.message}`),
);

async function printTicket(data: PrintTicketSocketPayload): Promise<void> {
  logger.info(
    `Printing job ${data.jobId}, order ${data.orderNumber} (${data.orderId}), profile=${data.printerProfile}`,
  );
  if (data.printerProfile === 'system_pdf') {
    await printSystemPdf(data);
    return;
  }
  await printThermalTicket(data);
}

const queue: PrintTicketSocketPayload[] = [];
const knownJobIds = new Set<string>();
const completedJobIds: string[] = [];
let processing = false;

function rememberCompleted(jobId: string): void {
  completedJobIds.push(jobId);
  if (completedJobIds.length <= 1000) {
    return;
  }
  const oldestJobId = completedJobIds.shift();
  if (oldestJobId) {
    knownJobIds.delete(oldestJobId);
  }
}

function isValidTicket(
  data: unknown,
): data is PrintTicketSocketPayload {
  const ticket = data as Partial<PrintTicketSocketPayload> | undefined;
  return Boolean(
    ticket &&
      ticket.type === 'service_order_ticket' &&
      ticket.jobId &&
      ticket.printerId === PRINTER_ID &&
      (ticket.printerProfile === 'thermal_escpos' ||
        ticket.printerProfile === 'system_pdf') &&
      ticket.orderId &&
      ticket.content &&
      ticket.tracking?.url &&
      ticket.summary,
  );
}

async function processQueue(): Promise<void> {
  if (processing) {
    return;
  }
  processing = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) {
        continue;
      }

      socket.emit('print_started', {
        jobId: job.jobId,
        printerId: PRINTER_ID,
      });

      try {
        await printTicket(job);
        logger.info(`Print data sent to device. jobId=${job.jobId}`);
        socket.emit('print_sent', {
          jobId: job.jobId,
          printerId: PRINTER_ID,
          orderId: job.orderId,
          sentAt: new Date().toISOString(),
        });
      } catch (error) {
        const code =
          error instanceof PrintAgentError ? error.code : 'PRINT_FAILED';
        const message =
          error instanceof Error ? error.message : 'Unknown print error';
        logger.error(
          `Print failed. jobId=${job.jobId} code=${code} message=${message}`,
        );
        socket.emit('print_error', {
          jobId: job.jobId,
          printerId: PRINTER_ID,
          orderId: job.orderId,
          code,
          message,
          outcomeUncertain:
            error instanceof PrintAgentError && error.outcomeUncertain,
        });
      } finally {
        rememberCompleted(job.jobId);
      }
    }
  } finally {
    processing = false;
  }
}

socket.on(
  'print_ticket',
  (
    data: unknown,
    acknowledge?: PrintTicketAcknowledge,
  ) => {
    if (!isValidTicket(data)) {
      const rejectedJobId =
        typeof data === 'object' &&
        data !== null &&
        'jobId' in data &&
        typeof data.jobId === 'string'
          ? data.jobId
          : '';
      logger.warn('Rejected invalid print_ticket payload.');
      acknowledge?.({
        accepted: false,
        jobId: rejectedJobId,
        message: 'Invalid ticket payload or printerId.',
      });
      return;
    }

    if (knownJobIds.has(data.jobId)) {
      logger.warn(`Ignored duplicate print job. jobId=${data.jobId}`);
      acknowledge?.({
        accepted: true,
        duplicate: true,
        jobId: data.jobId,
      });
      return;
    }

    knownJobIds.add(data.jobId);
    queue.push(data);
    acknowledge?.({ accepted: true, jobId: data.jobId });
    logger.info(`Print job queued. jobId=${data.jobId} depth=${queue.length}`);
    void processQueue();
  },
);
