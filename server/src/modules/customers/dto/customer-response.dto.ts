import { CustomerStatus, BillingCycle } from '@prisma/client';

export class CustomerResponseDto {
  id: number;
  customerNumber: string;
  name: string;
  email?: string;
  phone?: string;
  serviceAddress: string;
  city?: string;
  state?: string;
  zipCode?: string;
  accountNumber?: string;
  meterNumber?: string;
  clientId: number;
  status: CustomerStatus;
  billingCycle: BillingCycle;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  createdById: number;

  // Optional related data
  client?: {
    id: number;
    name: string;
    code: string;
    organizationId: number;
  };

  meterReadings?: {
    id: number;
    readingDate: Date;
    readingValue: number;
    readingType: string;
  }[];

  invoices?: {
    id: number;
    invoiceNumber: string;
    invoiceDate: Date;
    totalAmount: number;
    status: string;
  }[];

  _count?: {
    meterReadings: number;
    invoices: number;
  };
} 