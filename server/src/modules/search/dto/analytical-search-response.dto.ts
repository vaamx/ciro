import { ApiProperty } from '@nestjs/swagger';

export interface EntityMention {
  text: string;
  count: number;
  context?: string[];
  files?: string[];
}

export class AnalyticalSearchResponseDto {
  @ApiProperty({
    description: 'Original search query',
    example: 'Count mentions of all VC funds'
  })
  query: string;

  @ApiProperty({
    description: 'Map of entities and their mentions',
    example: {
      'Sequoia Capital': { count: 15, context: ['...mentioned Sequoia Capital in...'] },
      'Andreessen Horowitz': { count: 8, context: ['...investment from Andreessen Horowitz...'] }
    },
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        count: { type: 'number' },
        context: { type: 'array', items: { type: 'string' } },
        files: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  entities: Record<string, EntityMention>;

  @ApiProperty({
    description: 'Total number of entities found',
    example: 10
  })
  totalEntities: number;

  @ApiProperty({
    description: 'Total number of mentions across all entities',
    example: 45
  })
  totalMentions: number;

  @ApiProperty({
    description: 'Files that were searched',
    example: ['1', '2', '3']
  })
  searchedFiles: string[];

  constructor(data?: Partial<AnalyticalSearchResponseDto>) {
    this.query = data?.query || '';
    this.entities = data?.entities || {};
    this.totalEntities = data?.totalEntities || 0;
    this.totalMentions = data?.totalMentions || 0;
    this.searchedFiles = data?.searchedFiles || [];
  }
} 