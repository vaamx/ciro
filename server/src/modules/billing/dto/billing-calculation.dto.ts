import { IsInt, IsOptional, IsNumber, IsDateString, IsPositive } from 'class-validator';
import { BillingStatus } from '@prisma/client';

export class BillingCalculationRequestDto {
  @IsInt()
  @IsPositive()
  billingPeriodId: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  overrideTotalKwh?: number;
}

export class ChargeBreakdownDto {
  description: string;
  kwh?: number;
  rate?: number;
  amount: number;
  period?: string;
}

export class BillingCalculationResultDto {
  billingPeriodId: number;
  
  // Usage totals
  totalKwh: number;
  peakDemand?: number;
  billingDays: number;
  averageDailyUsage?: number;
  
  // Charge calculations
  energyCharges: number;
  demandCharges: number;
  taxes: number;
  adjustments: number;
  totalAmount: number;
  
  // Detailed breakdown
  chargeBreakdown: ChargeBreakdownDto[];
  
  // Tariff information
  tariffUsed?: {
    id: number;
    name: string;
    code: string;
    rateType: string;
  };
  
  // Calculation metadata
  calculatedAt: string;
  meterReadingsCount: number;
  missingReadings?: string[];
} 