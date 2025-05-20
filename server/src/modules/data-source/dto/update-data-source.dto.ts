import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, IsObject, MinLength } from 'class-validator';
import { CreateDataSourceDto } from './create-data-source.dto';

// Assuming DataSourceType and DataSourceStatus enums/types exist
// If not, define simple placeholders or import them
enum DataSourceType { TEXT='text', FILE='file', WEB='web' } // Example
enum DataSourceStatus { PENDING='pending', PROCESSING='processing', READY='ready', ERROR='error' } // Example

export class UpdateDataSourceDto extends PartialType(CreateDataSourceDto) {
  // Explicitly define name as optional to potentially help linter
  @IsOptional()
  @IsString()
  @MinLength(3) // Keep validation from Create DTO if desired
  @MaxLength(100)
  name?: string;

  // Override or add specific validation for update if needed
  // For example, maybe type cannot be updated?
  
  // Ensure description isn't overly long if updated
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // Allow updating config
  @IsOptional()
  @IsObject()
  config?: Record<string, any>; 

  // Allow updating metadata
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  // We explicitly exclude type and status from being updated via this DTO
  // If status updates are needed, they should go through a dedicated endpoint/method
  type?: never;
  status?: never;
} 