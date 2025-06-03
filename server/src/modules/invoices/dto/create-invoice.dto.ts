import { IsInt, IsDateString, IsOptional, IsPositive, IsString, IsNumber } from 'class-validator';

export class CreateInvoiceDto {
  @IsInt()
  @IsPositive()
  billingPeriodId: number;

  @IsString()
  invoiceNumber: string;

  @IsDateString()
  invoiceDate: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsNumber()
  energyCharges?: number;

  @IsOptional()
  @IsNumber()
  demandCharges?: number;

  @IsOptional()
  @IsNumber()
  taxes?: number;

  @IsOptional()
  @IsNumber()
  adjustments?: number;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;
} 