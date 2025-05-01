import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FileMetadataDto {
  @ApiProperty({ description: 'File ID' })
  id!: string;

  @ApiProperty({ description: 'Original file name' })
  originalFilename!: string;

  @ApiProperty({ description: 'File size in bytes' })
  size!: number;

  @ApiProperty({ description: 'MIME type of the file' })
  mimeType!: string;

  @ApiProperty({ description: 'When the file was uploaded' })
  uploadedAt!: string;

  @ApiProperty({ description: 'Current status of the file' })
  status!: string;
}

export class UserFilesRequestDto {
  @ApiProperty({ required: false, default: 10, description: 'Number of files to return' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({ required: false, default: 0, description: 'Number of files to skip' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class UserFilesResponseDto {
  @ApiProperty({ type: [FileMetadataDto], description: 'List of files' })
  files!: FileMetadataDto[];

  @ApiProperty({ description: 'Total number of files' })
  total!: number;

  @ApiProperty({ description: 'Number of files returned' })
  limit!: number;

  @ApiProperty({ description: 'Number of files skipped' })
  offset!: number;
} 