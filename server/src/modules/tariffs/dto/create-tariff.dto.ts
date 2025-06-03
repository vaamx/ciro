import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsPositive, IsInt, MinLength, MaxLength, ValidateNested, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RateType, TariffStatus } from '@prisma/client';

export class TariffBlockDto {
  @IsInt()
  @IsPositive()
  blockNumber: number;

  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  fromKwh: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  toKwh?: number;

  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  rate: number;
}

export class CreateTariffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(RateType)
  rateType: RateType;

  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => Number(value))
  energyRate: number;

  // Time-of-Use rates
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  onPeakRate?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  offPeakRate?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  midPeakRate?: number;

  // Demand charges
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  demandRate?: number;

  // Fixed charges
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  monthlyCharge?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => value ? Number(value) : undefined)
  connectionFee?: number;

  // Effective dates
  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsEnum(TariffStatus)
  status?: TariffStatus = TariffStatus.DRAFT;

  @IsOptional()
  metadata?: any;

  // Tiered rate blocks
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffBlockDto)
  tierBlocks?: TariffBlockDto[];
} 