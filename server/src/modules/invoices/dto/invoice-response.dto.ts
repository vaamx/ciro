import { InvoiceStatus } from '@prisma/client';

export class InvoiceResponseDto {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  
  // Financial details
  energyCharges: number;
  demandCharges: number;
  taxes: number;
  adjustments: number;
  totalAmount: number;
  
  // Usage details
  totalKwh: number;
  peakDemand?: number;
  billingDays: number;
  averageDailyUsage?: number;
  
  // Status and payment
  status: InvoiceStatus;
  paidDate?: string;
  paidAmount?: number;
  
  // PDF and metadata
  pdfUrl?: string;
  metadata?: any;
  
  createdAt: string;
  updatedAt: string;

  // Customer information
  customer: {
    id: number;
    name: string;
    accountNumber: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    client: {
      id: number;
      name: string;
    };
  };

  // Billing period information
  billingPeriod: {
    id: number;
    startDate: string;
    endDate: string;
    status: string;
  };

  // Usage breakdown (if available from billing calculation)
  usageBreakdown?: Array<{
    description: string;
    kwh?: number;
    rate?: number;
    amount: number;
    period?: string;
  }>;
} 