import { Injectable, Logger } from '@nestjs/common';

/**
 * Visualization service for generating chart and visualization data
 */
@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);

  /**
   * Generates chart configuration for various chart types
   */
  generateChartConfig(
    data: Record<string, any>[],
    options: {
      type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap';
      xAxis?: string;
      yAxis?: string;
      title?: string;
      colorScheme?: string;
    }
  ): Record<string, any> {
    const { type, xAxis = '', yAxis = '', title = 'Chart', colorScheme = 'default' } = options;
    
    try {
      switch (type) {
        case 'bar':
          return this.generateBarChart(data, xAxis, yAxis, title, colorScheme);
        case 'line':
          return this.generateLineChart(data, xAxis, yAxis, title, colorScheme);
        case 'pie':
          return this.generatePieChart(data, xAxis, yAxis, title, colorScheme);
        case 'scatter':
          return this.generateScatterChart(data, xAxis, yAxis, title, colorScheme);
        case 'heatmap':
          return this.generateHeatmapChart(data, xAxis, yAxis, title, colorScheme);
        default:
          return this.generateBarChart(data, xAxis, yAxis, title, colorScheme);
      }
    } catch (error: any) {
      this.logger.error(`Error generating ${type} chart: ${error.message}`);
      return {
        error: true,
        message: `Failed to generate ${type} chart: ${error.message}`
      };
    }
  }

  /**
   * Generates a bar chart configuration
   */
  private generateBarChart(
    data: Record<string, any>[],
    xAxis: string,
    yAxis: string,
    title: string,
    colorScheme: string
  ): Record<string, any> {
    if (!xAxis || !yAxis) {
      throw new Error('Bar chart requires xAxis and yAxis parameters');
    }

    // Extract categories and values
    const categories = data.map(item => item[xAxis]);
    const values = data.map(item => item[yAxis]);
    
    return {
      title: { text: title },
      xAxis: { categories },
      yAxis: { title: { text: yAxis } },
      series: [{ name: yAxis, data: values }],
      colorScheme,
      type: 'bar'
    };
  }

  /**
   * Generates a line chart configuration
   */
  private generateLineChart(
    data: Record<string, any>[],
    xAxis: string,
    yAxis: string,
    title: string,
    colorScheme: string
  ): Record<string, any> {
    if (!xAxis || !yAxis) {
      throw new Error('Line chart requires xAxis and yAxis parameters');
    }

    // Extract categories and values
    const categories = data.map(item => item[xAxis]);
    const values = data.map(item => item[yAxis]);
    
    return {
      title: { text: title },
      xAxis: { categories },
      yAxis: { title: { text: yAxis } },
      series: [{ name: yAxis, data: values }],
      colorScheme,
      type: 'line'
    };
  }

  /**
   * Generates a pie chart configuration
   */
  private generatePieChart(
    data: Record<string, any>[],
    labelField: string,
    valueField: string,
    title: string,
    colorScheme: string
  ): Record<string, any> {
    if (!labelField || !valueField) {
      throw new Error('Pie chart requires labelField and valueField parameters');
    }

    // Extract series data
    const seriesData = data.map(item => ({
      name: item[labelField],
      y: item[valueField]
    }));
    
    return {
      title: { text: title },
      series: [{
        type: 'pie',
        name: valueField,
        data: seriesData
      }],
      colorScheme,
      type: 'pie'
    };
  }

  /**
   * Generates a scatter chart configuration
   */
  private generateScatterChart(
    data: Record<string, any>[],
    xAxis: string,
    yAxis: string,
    title: string,
    colorScheme: string
  ): Record<string, any> {
    if (!xAxis || !yAxis) {
      throw new Error('Scatter chart requires xAxis and yAxis parameters');
    }

    // Extract points
    const points = data.map(item => [item[xAxis], item[yAxis]]);
    
    return {
      title: { text: title },
      xAxis: { title: { text: xAxis } },
      yAxis: { title: { text: yAxis } },
      series: [{
        type: 'scatter',
        name: `${xAxis} vs ${yAxis}`,
        data: points
      }],
      colorScheme,
      type: 'scatter'
    };
  }

  /**
   * Generates a heatmap chart configuration
   */
  private generateHeatmapChart(
    data: Record<string, any>[],
    xAxis: string,
    yAxis: string,
    title: string,
    colorScheme: string
  ): Record<string, any> {
    // For heatmap, data should contain x, y, value
    if (!data.every(item => item.x !== undefined && item.y !== undefined && item.value !== undefined)) {
      throw new Error('Heatmap requires data with x, y, value properties');
    }
    
    return {
      title: { text: title },
      xAxis: { categories: [...new Set(data.map(item => item.x))] },
      yAxis: { categories: [...new Set(data.map(item => item.y))] },
      series: [{
        name: 'Value',
        data: data.map(item => [item.x, item.y, item.value]),
        dataLabels: { enabled: true }
      }],
      colorScheme,
      type: 'heatmap'
    };
  }
}

export default VisualizationService; 