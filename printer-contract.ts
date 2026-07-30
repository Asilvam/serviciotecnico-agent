export type ServiceOrderStatusValue =
  | 'pending'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'delivered'
  | 'cancelled';

export type PrinterProfile = 'thermal_escpos' | 'system_pdf';
export type SystemPaperSize = 'A4' | 'LETTER';

export interface PrintDocumentSummary {
  createdAt?: string;
  status: string;
  statusLabelEs: string;
  priority: string;
  priorityLabelEs: string;
  customerName?: string;
  technicianName?: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel?: string;
  serialNumber?: string;
  problemDescription: string;
  diagnosis?: string;
  workDone?: string;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  estimatedDelivery?: string;
  deliveredAt?: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface PrintTicketSocketPayload {
  type: 'service_order_ticket';
  jobId: string;
  printerId: string;
  printerProfile: PrinterProfile;
  paperSize?: SystemPaperSize;
  orderId: string;
  orderNumber: string;
  mimeType: 'text/plain';
  content: string;
  width: number;
  paperWidthMm: number;
  generatedAt: string;
  tracking: {
    url: string;
    status: ServiceOrderStatusValue;
    statusLabelEs: string;
  };
  summary: PrintDocumentSummary;
}
