import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'File to upload' })
  file: any;

  @ApiProperty({ required: false, description: 'Additional metadata for the file' })
  @IsOptional()
  @IsString()
  metadata?: string;
} 