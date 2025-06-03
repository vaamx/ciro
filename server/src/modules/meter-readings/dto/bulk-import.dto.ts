import { IsOptional, IsBoolean, IsEnum, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReadingType } from '@prisma/client';
import { CreateMeterReadingDto } from './create-meter-reading.dto';

export class BulkImportOptionsDto {
  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean = false;

  @IsOptional()
  @IsBoolean()
  validateOnly?: boolean = false;

  @IsOptional()
  @IsEnum(ReadingType)
  defaultReadingType?: ReadingType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkMeterReadingImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMeterReadingDto)
  readings: CreateMeterReadingDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkImportOptionsDto)
  options?: BulkImportOptionsDto;
}

export class BulkImportResultDto {
  success: boolean;
  totalCount: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
  processedReadings?: number[];
} 