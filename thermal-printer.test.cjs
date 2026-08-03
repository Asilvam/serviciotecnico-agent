const assert = require('node:assert/strict');
const test = require('node:test');
const { buildWindowsRawTicket } = require('./dist/thermal-printer.js');

function payload(overrides = {}) {
  return {
    type: 'service_order_ticket',
    jobId: 'job-test',
    printerId: 'default-printer',
    printerProfile: 'thermal_escpos',
    orderId: 'order-test',
    orderNumber: 'OT-TEST',
    mimeType: 'text/plain',
    content: 'SERVICIO TÉCNICO\nTécnico: José Muñoz',
    width: 40,
    paperWidthMm: 80,
    generatedAt: '2026-08-03T05:00:00.000Z',
    tracking: {
      url: 'https://example.com/tracking/test-token',
      status: 'in_progress',
      statusLabelEs: 'EN PROCESO',
    },
    summary: {
      status: 'in_progress',
      statusLabelEs: 'EN PROCESO',
      priority: 'medium',
      priorityLabelEs: 'MEDIA',
      deviceType: 'Notebook',
      deviceBrand: 'Marca',
      problemDescription: 'No enciende',
      laborCost: 0,
      partsCost: 0,
      totalCost: 0,
      items: [],
    },
    ...overrides,
  };
}

test('construye un ticket RAW BXL/POS con texto, QR y corte', () => {
  const data = payload();
  const result = buildWindowsRawTicket(data);
  const printable = result.toString('latin1');

  assert.deepEqual([...result.subarray(0, 2)], [0x1b, 0x40]);
  assert.match(printable, /SERVICIO TECNICO/);
  assert.match(printable, /Tecnico: Jose Munoz/);
  assert.ok(result.includes(Buffer.from(data.tracking.url, 'utf8')));
  assert.ok(
    result.includes(
      Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
    ),
  );
  assert.deepEqual([...result.subarray(-3)], [0x1d, 0x56, 0x00]);
});

test('rechaza una URL que excede el comando QR', () => {
  const data = payload({
    tracking: {
      url: `https://example.com/${'a'.repeat(65_535)}`,
      status: 'pending',
      statusLabelEs: 'PENDIENTE',
    },
  });

  assert.throws(
    () => buildWindowsRawTicket(data),
    /demasiado larga para el ticket/,
  );
});
