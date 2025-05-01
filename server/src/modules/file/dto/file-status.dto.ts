import { ApiProperty } from '@nestjs/swagger';

export class FileStatusDto {
  @ApiProperty({ description: 'Unique identifier for the file' })
  id!: string;

  @ApiProperty({ description: 'Current status of the file' })
  status!: string;

  @ApiProperty({ description: 'Progress percentage (0-100)', required: false })
  progress?: number;
} 