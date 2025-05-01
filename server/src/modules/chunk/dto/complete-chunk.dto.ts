import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Define a class for the metadata object if specific validation is needed
// Otherwise, allow any object
// export class FileMetadataDto { ... }

export class CompleteChunkDto {
  @ApiProperty({ description: 'The file ID used during chunk uploads.', example: 'abc-123' })
  @IsString()
  @IsNotEmpty()
  fileId!: string;

  @ApiProperty({ description: 'The ID of the data source to associate the file with.', example: 'ds-456' })
  @IsString()
  @IsNotEmpty()
  dataSourceId!: string;

  @ApiPropertyOptional({
    description: 'Optional metadata about the file.',
    type: 'object',
    example: { filename: 'report.pdf', category: 'finance' },
    additionalProperties: true
  })
  @IsOptional()
  @IsObject()
  // If you have a specific DTO for metadata:
  // @ValidateNested()
  // @Type(() => FileMetadataDto)
  metadata?: Record<string, any>;
}

export class CompleteChunkResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional({ description: 'The ID of the queued processing job.', example: 'job-789' })
  jobId?: string | number;

  @ApiPropertyOptional({ description: 'Message indicating outcome.', example: 'File assembled and queued for processing.' })
  message?: string;
} 