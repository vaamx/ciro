import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UploadFileDto {
  @ApiProperty({ required: false, description: 'Processing method for the file' })
  @IsOptional()
  @IsString()
  processingMethod?: string;

  @ApiProperty({ required: false, description: 'Organization ID for the file upload' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  organizationId?: number;

  @ApiProperty({ required: false, description: 'Additional metadata for the file' })
  @IsOptional()
  @IsString()
  metadata?: string;

  @ApiProperty({ required: false, description: 'Active organization ID for diagnostics' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  active_organization_id?: number;
} 