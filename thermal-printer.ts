import type { PrintTicketSocketPayload } from './printer-contract';
import { PrintAgentError } from './print-agent-error';

type EscPosModule = {
  USB: new () => {
    open(callback: (error: Error | null) => void): void;
    close(callback: (error?: Error | null) => void): void;
  };
  Printer: new (device: unknown) => any;
};

function loadEscPos(): EscPosModule {
  // Thermal USB dependencies are loaded only when this profile is selected.
  // This lets the system-PDF profile run on Windows without a USB adapter.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const escpos = require('escpos') as EscPosModule;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const usbModule = require('usb') as any;

  if (usbModule?.usb && typeof usbModule.on !== 'function') {
    const hotplugUsb = usbModule.usb;
    usbModule.on = hotplugUsb.on.bind(hotplugUsb);
    usbModule.removeAllListeners =
      hotplugUsb.removeAllListeners.bind(hotplugUsb);
  }
  if (
    typeof usbModule.findByIds !== 'function' &&
    typeof usbModule?.usb?.findByIds === 'function'
  ) {
    usbModule.findByIds = usbModule.usb.findByIds.bind(usbModule.usb);
  }
  if (
    typeof usbModule.getDeviceList !== 'function' &&
    typeof usbModule?.usb?.getDeviceList === 'function'
  ) {
    usbModule.getDeviceList = usbModule.usb.getDeviceList.bind(usbModule.usb);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const usbAdapter = require('escpos-usb') as { default?: unknown };
  escpos.USB = (usbAdapter?.default ?? usbAdapter) as EscPosModule['USB'];
  return escpos;
}

function closeDevice(device: any): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      device.close((closeError?: Error | null) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function flushAndClose(printer: any, device: any): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      printer.flush((transferError?: Error | null) => {
        if (transferError) {
          void closeDevice(device).then(
            () =>
              reject(
                new PrintAgentError(
                  'USB_TRANSFER_FAILED',
                  transferError.message,
                  true,
                ),
              ),
            (closeError: unknown) =>
              reject(
                new PrintAgentError(
                  'USB_TRANSFER_AND_CLOSE_FAILED',
                  closeError instanceof Error
                    ? `${transferError.message}; ${closeError.message}`
                    : transferError.message,
                  true,
                ),
              ),
          );
          return;
        }

        void closeDevice(device).then(
          resolve,
          (closeError: unknown) =>
            reject(
              new PrintAgentError(
                'PRINTER_CLOSE_FAILED',
                closeError instanceof Error
                  ? closeError.message
                  : 'No fue posible cerrar la impresora.',
                true,
              ),
            ),
        );
      });
    } catch (error) {
      reject(
        new PrintAgentError(
          'USB_TRANSFER_FAILED',
          error instanceof Error ? error.message : 'Fallo de transferencia USB.',
          true,
        ),
      );
    }
  });
}

function rejectAfterClosing(
  device: any,
  error: PrintAgentError,
  reject: (reason?: unknown) => void,
): void {
  void closeDevice(device).then(
    () => reject(error),
    (closeError: unknown) =>
      reject(
        new PrintAgentError(
          'PRINTER_CLOSE_FAILED',
          closeError instanceof Error ? closeError.message : error.message,
          error.outcomeUncertain,
        ),
      ),
  );
}

export function printThermalTicket(
  data: PrintTicketSocketPayload,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const escpos = loadEscPos();
      const device = new escpos.USB();
      const printer = new escpos.Printer(device);

      device.open((openError: Error | null) => {
        if (openError) {
          reject(new PrintAgentError('HARDWARE_ERROR', openError.message));
          return;
        }

        try {
          printer
            .model('qsprinter')
            .font('a')
            .pureText(data.content)
            .feed(1)
            .align('ct')
            .text('Consulta estado:');

          printer.qrimage(
            data.tracking.url,
            { type: 'png', mode: 'normal', size: 4 },
            (qrError: Error | null) => {
              if (qrError) {
                rejectAfterClosing(
                  device,
                  new PrintAgentError('QR_PRINT_FAILED', qrError.message),
                  reject,
                );
                return;
              }

              try {
                printer
                  .align('lt')
                  .text(`Estado actual: ${data.tracking.statusLabelEs}`)
                  .feed(2)
                  .cut();
                void flushAndClose(printer, device).then(resolve, reject);
              } catch (error) {
                rejectAfterClosing(
                  device,
                  new PrintAgentError(
                    'PRINT_PREPARATION_FAILED',
                    error instanceof Error
                      ? error.message
                      : 'No fue posible preparar el ticket.',
                  ),
                  reject,
                );
              }
            },
          );
        } catch (error) {
          rejectAfterClosing(
            device,
            new PrintAgentError(
              'PRINT_PREPARATION_FAILED',
              error instanceof Error
                ? error.message
                : 'No fue posible preparar el ticket.',
            ),
            reject,
          );
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
