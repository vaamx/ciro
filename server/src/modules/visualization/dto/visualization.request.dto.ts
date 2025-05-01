import { ApiProperty } from '@nestjs/swagger';

export class VisualizationRequestDto {
  @ApiProperty({ 
    description: 'Optional configuration options for the visualization',
    required: false,
    type: Object,
    example: {
      visualizationType: 'bar_chart',
      limit: 100,
      groupBy: 'month',
      aggregation: 'sum',
      filters: [{ field: 'region', operator: 'eq', value: 'North America' }]
    }
  })
  declare options?: {
    visualizationType?: string;
    limit?: number;
    groupBy?: string;
    aggregation?: string;
    filters?: Array<{
      field: string;
      operator: string;
      value: string | number | boolean;
    }>;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    showLegend?: boolean;
    colors?: string[];
    [key: string]: any;
  };
} 