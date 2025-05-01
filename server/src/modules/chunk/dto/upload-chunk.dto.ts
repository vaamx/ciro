import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject, Min, IsInt } from 'class-validator';

export class UploadChunkHeaders {
  @ApiProperty({ description: 'Unique identifier for the file being uploaded.', example: 'abc-123' })
  @IsString()
  @IsNotEmpty()
  'x-file-id': string;

  @ApiProperty({ description: '0-based index of the current chunk.', example: 0 })
  @IsNumber()
  @IsInt()
  @Min(0)
  'x-chunk-index': number;

  @ApiProperty({ description: 'Total number of chunks for the file.', example: 10 })
  @IsNumber()
  @IsInt()
  @Min(1)
  'x-total-chunks': number;

  @ApiPropertyOptional({ description: 'Original filename.', example: 'document.pdf' })
  @IsOptional()
  @IsString()
  'x-file-name'?: string;

  @ApiPropertyOptional({ description: 'Explicit content type if known.', example: 'application/pdf' })
  @IsOptional()
  @IsString()
  'x-content-type'?: string;
}

export class UploadChunkResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Chunk 1/10 received' })
  message!: string;

  @ApiProperty({ example: 10 })
  progress!: number;
} 