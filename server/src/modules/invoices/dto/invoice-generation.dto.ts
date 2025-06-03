import { IsInt, IsOptional, IsString, IsDateString, IsPositive, IsNumber } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class GenerateInvoiceDto {
  @IsInt()
  @IsPositive()
  billingPeriodId: number;

  @IsOptional()
  @IsString()
  invoiceNumber?: string; // Auto-generated if not provided

  @IsOptional()
  @IsDateString()
  invoiceDate?: string; // Defaults to current date

  @IsOptional()
  @IsDateString()
  dueDate?: string; // Defaults to 30 days from invoice date
}

export class ProcessPaymentDto {
  @IsNumber()
  @IsPositive()
  paidAmount: number;

  @IsDateString()
  paidDate: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class BulkInvoiceGenerationDto {
  @IsInt({ each: true })
  @IsPositive({ each: true })
  billingPeriodIds: number[];

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class InvoiceGenerationResultDto {
  invoiceId: number;
  invoiceNumber: string;
  billingPeriodId: number;
  customerId: number;
  customerName: string;
  totalAmount: number;
  status: InvoiceStatus;
  generatedAt: string;
  errors?: string[];
} 