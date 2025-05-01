import { ApiProperty } from '@nestjs/swagger'; // Optional: for Swagger documentation

export class VisualizationResponseDto {
  @ApiProperty({ description: 'ID of the data source used', example: 'clxyz12345' })
  declare dataSourceId: string;

  @ApiProperty({ description: 'Title of the generated visualization', example: 'Sales Trend Analysis' })
  declare title: string;

  @ApiProperty({ description: 'Description of the visualization', example: 'Monthly sales data compared to previous period.' })
  declare description: string;

  @ApiProperty({ description: 'Indicates if the data is mock/fallback data', example: false })
  declare isMockData: boolean;

  @ApiProperty({ description: 'Type of chart generated', example: 'enhanced-bar-chart' })
  declare chartType: string; // Could potentially be an enum

  @ApiProperty({ description: 'Configuration specific to the chart type', example: { xAxis: { title: 'Month' }, yAxis: { title: 'Sales ($)' } } })
  declare config: Record<string, any>; // Define more specific type if possible

  @ApiProperty({ description: 'The data points for the visualization', example: [{ month: 'Jan', sales: 1000 }, { month: 'Feb', sales: 1200 }] })
  declare data: any[]; // Define more specific type based on expected data structures

  // Add other fields from legacy if necessary (e.g., query, transformations)
  // declare query?: string | null;
  // declare transformations?: any[];
} 