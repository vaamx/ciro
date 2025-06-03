import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsPositive, IsInt, MinLength, MaxLength } from 'class-validator';
import { ReadingType } from '@prisma/client';

export class CreateMeterReadingDto {
  @IsInt()
  @IsPositive()
  customerId: number;

  @IsDateString()
  readingDate: string;

  @IsNumber()
  @IsPositive()
  readingValue: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  demandReading?: number;

  @IsEnum(ReadingType)
  readingType: ReadingType;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  meterNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  metadata?: any;
} 