import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject, IsEnum, MinLength, MaxLength } from 'class-validator';
import { DataSourceTypeEnum, DataSourceProcessingStatus } from '../../../types';

// REMOVED Placeholder definitions
// enum DataSourceType { TEXT='text', FILE='file', WEB='web' } // Example
// enum DataSourceStatus { PENDING='pending', PROCESSING='processing', READY='ready', ERROR='error' } // Example

export class CreateDataSourceDto {
  @IsNumber()
  @IsNotEmpty()
  organization_id!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsNotEmpty()
  @IsEnum(DataSourceTypeEnum)
  type!: DataSourceTypeEnum;

  @IsEnum(DataSourceTypeEnum)
  @IsOptional()
  derivedFromType?: DataSourceTypeEnum;

  @IsEnum(DataSourceProcessingStatus)
  @IsNotEmpty()
  status!: DataSourceProcessingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsObject()
  @IsOptional()
  metrics?: Record<string, any>;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>; // Use a more specific type if possible
} 