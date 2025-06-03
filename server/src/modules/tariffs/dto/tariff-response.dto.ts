import { RateType, TariffStatus } from '@prisma/client';

export class TariffBlockResponseDto {
  id: number;
  blockNumber: number;
  fromKwh: number;
  toKwh?: number;
  rate: number;
}

export class TariffResponseDto {
  id: number;
  name: string;
  code: string;
  description?: string;
  rateType: RateType;
  energyRate: number;
  onPeakRate?: number;
  offPeakRate?: number;
  midPeakRate?: number;
  demandRate?: number;
  monthlyCharge?: number;
  connectionFee?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: TariffStatus;
  metadata?: any;
  createdAt: string;
  updatedAt: string;

  // Client information
  client?: {
    id: number;
    name: string;
    code: string;
  };

  // Tier blocks for tiered pricing
  tierBlocks?: TariffBlockResponseDto[];
} 