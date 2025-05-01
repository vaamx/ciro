import { IsNotEmpty, IsOptional, IsString, IsObject, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({ 
    description: 'ID of the data source to process the document for', 
    example: '123e4567-e89b-12d3-a456-426614174000' 
  })
  @IsNotEmpty()
  @IsString()
  dataSourceId!: string;

  @ApiProperty({ 
    description: 'File type to process, required when submitting content instead of a file', 
    required: false,
    enum: ['text', 'csv', 'json', 'xml', 'html', 'markdown'],
    example: 'csv' 
  })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiProperty({ 
    description: 'Additional metadata to store with the processing job',
    required: false,
    example: { source: 'user_upload', tags: ['financial', 'quarterly'] }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ 
    description: 'Content to process if not uploading a file',
    required: false,
    example: 'This is the text content to process'
  })
  @IsOptional()
  @IsString()
  @ValidateIf(o => !o.file)
  content?: string;
} 