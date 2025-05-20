import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchRequestDto {
  @ApiProperty({ 
    description: 'The search query to perform',
    example: 'machine learning in healthcare' 
  })
  @IsNotEmpty()
  @IsString()
  query!: string;

  @ApiPropertyOptional({ 
    description: 'List of file IDs to search within (comma-separated string)',
    example: '1,2,3' 
  })
  @IsOptional()
  @IsString()
  fileIds?: string;

  @ApiPropertyOptional({ 
    description: 'Maximum number of results to return',
    example: 20,
    default: 20
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ 
    description: 'User ID to restrict search to specific user files',
    example: 'user-123' 
  })
  @IsOptional()
  @IsString()
  userId?: string;
} 