import { BillingStatus } from '@prisma/client';

export class BillingPeriodResponseDto {
  id: number;
  customerId: number;
  startDate: string;
  endDate: string;
  dueDate: string;
  totalKwh?: number;
  totalAmount?: number;
  status: BillingStatus;
  createdAt: string;
  updatedAt: string;

  // Customer information
  customer?: {
    id: number;
    name: string;
    accountNumber: string;
    client: {
      id: number;
      name: string;
    };
  };

  // Tariff information
  tariffRate?: {
    id: number;
    name: string;
    code: string;
    rateType: string;
    energyRate: number;
  };

  // Associated invoice information
  invoice?: {
    id: number;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  };

  // Reading statistics
  meterReadingsCount?: number;
  readingsSummary?: {
    firstReading?: string;
    lastReading?: string;
    totalKwh?: number;
    peakDemand?: number;
  };
} 