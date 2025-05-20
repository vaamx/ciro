import { IsNotEmpty, IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticalSearchDto {
  @ApiProperty({ 
    description: 'The analytical query to perform',
    example: 'Count mentions of all VC funds' 
  })
  @IsNotEmpty()
  @IsString()
  query!: string;

  @ApiPropertyOptional({ 
    description: 'List of file IDs to search within (comma-separated when used in query params)',
    example: '1,2,3'
  })
  @IsOptional()
  @IsString()
  fileIds?: string;

  @ApiPropertyOptional({ 
    description: 'Maximum number of results to return',
    example: '100',
    default: '50'
  })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ 
    description: 'Entity types to specifically look for',
    example: ['PERSON', 'ORGANIZATION']
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  entityTypes?: string[];

  @ApiPropertyOptional({ 
    description: 'Whether to include context snippets with each entity',
    example: true,
    default: false
  })
  @IsOptional()
  includeContext?: boolean;
} 