import { CHART_COLORS } from './constants';

/**
 * ChartProcessor - Utility functions for processing chart data
 * Handles data transformation and configuration for various chart types
 */
export class ChartProcessor {
  /**
   * Process tabular data for visualization
   * @param data Raw tabular data (array of objects)
   * @param config Chart configuration
   * @returns Processed data ready for visualization
   */
  static processForVisualization(
    data: Record<string, any>[],
    config: {
      type: string;
      xKey?: string;
      yKey?: string;
      series?: Array<{ dataKey: string; name?: string; color?: string }>;
      labels?: { title?: string; xAxis?: string; yAxis?: string };
      options?: Record<string, any>;
    }
  ) {
    if (!data || data.length === 0) {
      return { data: [], config };
    }

    const { type } = config;
    
    // Process data based on chart type
    switch (type.toLowerCase()) {
      case 'bar':
      case 'line':
      case 'area':
        return this.processBarLineData(data, config);
        
      case 'pie':
        return this.processPieData(data, config);
        
      case 'scatter':
        return this.processScatterData(data, config);
        
      case 'table':
        return { data, config }; // Tables don't need special processing
        
      default:
        return { data, config };
    }
  }
  
  /**
   * Process data for bar, line, and area charts
   */
  private static processBarLineData(
    data: Record<string, any>[],
    config: any
  ) {
    const { xKey, series, labels } = config;
    
    // Ensure we have proper data structure
    if (!xKey) {
      // Try to find a suitable x-axis key
      const sampleKeys = Object.keys(data[0] || {});
      const newXKey = sampleKeys.find(key => 
        typeof data[0][key] === 'string' || 
        key.toLowerCase().includes('name') || 
        key.toLowerCase().includes('label') ||
        key.toLowerCase().includes('segment')
      ) || sampleKeys[0];
      
      config.xKey = newXKey;
    }
    
    // Ensure we have series data
    if (!series || series.length === 0) {
      // Auto-generate series from numeric fields
      const numericKeys = Object.keys(data[0] || {}).filter(key => 
        key !== config.xKey && 
        typeof data[0][key] === 'number'
      );
      
      config.series = numericKeys.map((key, index) => ({
        dataKey: key,
        name: key,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }));
    }
    
    // Add default labels if missing
    if (!labels) {
      config.labels = {
        title: 'Data Visualization',
        xAxis: config.xKey,
        yAxis: config.series && config.series.length > 0 ? config.series[0].name : 'Value'
      };
    }
    
    // Format numbers in data for better display
    const processedData = data.map(item => {
      const newItem = { ...item };
      // Format numbers for display
      Object.keys(newItem).forEach(key => {
        if (typeof newItem[key] === 'number') {
          // Keep the original value but format it for display if needed
          if (Math.abs(newItem[key]) > 1000) {
            // Handle large numbers better
            newItem[`${key}_formatted`] = this.formatNumber(newItem[key]);
          }
        }
      });
      return newItem;
    });
    
    return { data: processedData, config };
  }
  
  /**
   * Process data for pie charts
   */
  private static processPieData(
    data: Record<string, any>[],
    config: any
  ) {
    const { xKey, yKey } = config;
    
    // For pie charts, we need a name field and value field
    let nameKey = xKey;
    let valueKey = yKey;
    
    if (!nameKey || !valueKey) {
      // Find suitable keys for pie chart
      const sampleKeys = Object.keys(data[0] || {});
      const stringKeys = sampleKeys.filter(key => typeof data[0][key] === 'string');
      const numericKeys = sampleKeys.filter(key => typeof data[0][key] === 'number');
      
      nameKey = nameKey || stringKeys[0] || sampleKeys[0];
      valueKey = valueKey || numericKeys[0] || sampleKeys[1];
      
      config.xKey = nameKey;
      config.yKey = valueKey;
    }
    
    // Add default labels
    if (!config.labels) {
      config.labels = {
        title: 'Distribution',
        xAxis: nameKey,
        yAxis: valueKey
      };
    }
    
    // Add colors to data points
    const processedData = data.map((item, index) => ({
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
    
    return { data: processedData, config };
  }
  
  /**
   * Process data for scatter plots
   */
  private static processScatterData(
    data: Record<string, any>[],
    config: any
  ) {
    // Similar to bar/line processing but with some scatter-specific handling
    return this.processBarLineData(data, config);
  }
  
  /**
   * Format a number for display (e.g., add commas, K, M suffixes)
   */
  private static formatNumber(num: number): string {
    if (Math.abs(num) >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    } else if (Math.abs(num) >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    } else {
      return num.toLocaleString();
    }
  }
} 