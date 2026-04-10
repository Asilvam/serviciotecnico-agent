// agent.ts
import { io, Socket } from 'socket.io-client';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const escpos = require('escpos');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const usbModule = require('usb');

// usb v2 compatibility for escpos-usb legacy API
if (usbModule?.usb && typeof usbModule.on !== 'function') {
  const hotplugUsb = usbModule.usb;
  usbModule.on = hotplugUsb.on.bind(hotplugUsb);
  usbModule.removeAllListeners = hotplugUsb.removeAllListeners.bind(hotplugUsb);
}
if (typeof usbModule.findByIds !== 'function' && typeof usbModule?.usb?.findByIds === 'function') {
  usbModule.findByIds = usbModule.usb.findByIds.bind(usbModule.usb);
}
if (typeof usbModule.getDeviceList !== 'function' && typeof usbModule?.usb?.getDeviceList === 'function') {
  usbModule.getDeviceList = usbModule.usb.getDeviceList.bind(usbModule.usb);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const USB = require('escpos-usb');
escpos.USB = USB?.default ?? USB;

type ServiceOrderStatusValue =
  | 'pending'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'delivered'
  | 'cancelled';

type ServiceOrderStatusLabelEs =
  | 'PENDIENTE'
  | 'EN PROCESO'
  | 'EN ESPERA DE REPUESTOS'
  | 'COMPLETADA'
  | 'ENTREGADA'
  | 'CANCELADA';

interface PrintTicketTrackingInfo {
  url: string;
  status: ServiceOrderStatusValue;
  statusLabelEs: ServiceOrderStatusLabelEs;
}

interface PrintTicketSocketPayload {
  type: 'service_order_ticket';
  orderId: string;
  orderNumber: string;
  mimeType: 'text/plain';
  content: string;
  width: number;
  paperWidthMm: number;
  generatedAt: string;
  tracking?: PrintTicketTrackingInfo;
}

interface PrintSuccessEventPayload {
  orderId: string;
  printedAt?: string;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`),
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.colorize({ all: true }) }),
    new (winston.transports as any).DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      maxFiles: '14d',
    }),
  ],
});

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3500';
const TOKEN = process.env.PRINT_TOKEN || 'tu_token_seguro';

const socket: Socket = io(SERVER_URL, {
  auth: { token: TOKEN },
  reconnection: true,
});

socket.on('connect', () => logger.info(`Connected to API. socketId=${socket.id}`));
socket.on('disconnect', (reason) => logger.warn(`Disconnected: ${reason}`));
socket.on('connect_error', (err) => logger.error(`Socket connect error: ${err.message}`));

function emitSuccess(orderId: string): void {
  const payload: PrintSuccessEventPayload = {
    orderId,
    printedAt: new Date().toISOString(),
  };
  socket.emit('print_success', payload);
}

function printTicket(data: PrintTicketSocketPayload): void {
  logger.info(`Printing order ${data.orderNumber} (${data.orderId})`);

  try {
    const device = new (escpos as any).USB();
    const printer = new (escpos as any).Printer(device);

    device.open((err: Error | null) => {
      if (err) {
        logger.error(`Hardware error: ${err.message}`);
        return;
      }

      printer.model('qsprinter').font('a').pureText(data.content).feed(1);

      const trackingUrl = data.tracking?.url;
      if (!trackingUrl) {
        logger.warn('No tracking.url in payload. Printing text only.');
        printer
          .feed(2)
          .cut()
          .close(() => {
            logger.info('Print success (without QR).');
            emitSuccess(data.orderId);
          });
        return;
      }

      // Centro para bloque de tracking + QR
      printer.align('ct').text('Consulta estado:')

      printer.qrimage(
        trackingUrl,
        { type: 'png', mode: 'normal', size: 4 }, // usa size: 3 si lo quieres más pequeño
        (qrErr: Error | null) => {
          if (qrErr) {
            logger.error(`QR print error: ${qrErr.message}`);
          } else {
            logger.info('QR printed.');
          }

          // Regresa a izquierda para el resto del ticket
          printer.align('lt');

          if (data.tracking?.statusLabelEs) {
            printer.text(`Estado actual: ${data.tracking.statusLabelEs}`);
          }

          printer
            .feed(2)
            .cut()
            .close(() => {
              logger.info('Print success.');
              emitSuccess(data.orderId);
            });
        },
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    logger.error(`System error: ${message}`);
  }
}


socket.on('print_ticket', (data: PrintTicketSocketPayload) => {
  if (!data || data.type !== 'service_order_ticket') {
    logger.warn('Ignored event with invalid payload type.');
    return;
  }
  printTicket(data);
});
