/**
 * Visualization Utility Functions
 * Contains helper functions for handling chart types, data generation, and insights.
 */

/**
 * Maps internal chart types to standardized chart types
 */
export function mapChartType(type: string): string {
  // Normalize the input type by removing underscores and converting to lowercase
  const normalizedType = type.toLowerCase().replace(/_/g, '').replace(/chart$/, '');
  
  // Debug log for chart type mapping
  console.debug(`[Chart Type Mapping] Original: "${type}", Normalized: "${normalizedType}"`);
  
  const typeMap: Record<string, string> = {
    'bar': 'bar',
    'barchart': 'bar',
    'bar_chart': 'bar',
    'line': 'line',
    'linechart': 'line',
    'line_chart': 'line',
    'pie': 'pie',
    'piechart': 'pie',
    'pie_chart': 'pie',
    'area': 'area',
    'areachart': 'area',
    'area_chart': 'area',
    'scatter': 'scatter',
    'scatterchart': 'scatter',
    'scatter_chart': 'scatter',
    'composed': 'composed',
    'composedchart': 'composed',
    'composed_chart': 'composed',
    'heatmap': 'heatmap',
    'heatmapchart': 'heatmap',
    'radar': 'radar',
    'radarchart': 'radar',
    'radar_chart': 'radar',
    'funnel': 'funnel',
    'funnelchart': 'funnel',
    'funnel_chart': 'funnel',
    'treemap': 'treemap',
    'treemapchart': 'treemap',
    'treemap_chart': 'treemap',
    'network': 'network',
    'networkgraph': 'network',
    'network_graph': 'network',
    'geospatial': 'geospatial',
    'geospatialmap': 'geospatial',
    'geospatial_map': 'geospatial',
    'sankey': 'sankey',
    'sankeydiagram': 'sankey',
    'sankey_diagram': 'sankey',
    'table': 'table'
  };
  
  // Try to match the normalized type first
  if (typeMap[normalizedType]) {
    const result = typeMap[normalizedType];
    console.debug(`[Chart Type Mapping] Matched normalized type: "${normalizedType}" → "${result}"`);
    return result;
  }
  
  // If no match with normalized type, try the original type
  const result = typeMap[type] || type || 'bar';
  console.debug(`[Chart Type Mapping] Final result: "${result}"`);
  return result;
}

/**
 * Validates and normalizes visualization types
 */
export function validateVisualizationType(type: string | undefined): string {
  console.log(`[DEBUG] validateVisualizationType called with type: "${type}"`);
  
  if (!type) {
    console.log('[DEBUG] No type provided, defaulting to "bar"');
    return 'bar'; // Default to bar if no type provided
  }
  
  // Check URL parameters for forced chart type
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const forcedChartType = urlParams.get('chartType');
    if (forcedChartType) {
      console.log(`[DEBUG] Forcing chart type from URL parameter: "${forcedChartType}"`);
      return mapChartType(forcedChartType);
    }
  } catch (error) {
    console.error('Error checking URL parameters:', error);
  }
  
  // Get the mapped type
  const mappedType = mapChartType(type);
  console.log(`[DEBUG] Type "${type}" mapped to "${mappedType}"`);
  
  // List of all supported visualization types from the Visualization directory
  const supportedTypes = [
    'bar', 'line', 'pie', 'area', 'scatter', 'composed', 
    'heatmap', 'radar', 'funnel', 'treemap', 'network', 
    'geospatial', 'sankey', 'table'
  ];
  
  // Check if the mapped type is supported
  if (supportedTypes.includes(mappedType)) {
    console.log(`[DEBUG] Type "${mappedType}" is supported`);
    return mappedType;
  }
  
  // If not supported, log a warning and return a default
  console.warn(`[Visualization Type] Unsupported type: "${type}" (mapped to "${mappedType}"). Falling back to "bar".`);
  return 'bar';
}

/**
 * Generates metrics from data for use in visualizations
 */
export function generateMetricsFromData(data: any[]): Array<{label: string, value: string | number}> {
  if (!data || data.length === 0) return [];
  
  const metrics: Array<{label: string, value: string | number}> = [];
  try {
    // Basic metrics
    metrics.push({ label: 'Total Records', value: data.length });
    
    // If we have numerical data, calculate statistics
    const numericKeys = Object.keys(data[0]).filter(key => {
      return !isNaN(parseFloat(data[0][key]));
    });
    
    if (numericKeys.length > 0) {
      const key = numericKeys[0]; // Use first numeric key for statistics
      
      // Calculate sum, average, max, min
      const values = data.map(item => parseFloat(item[key])).filter(val => !isNaN(val));
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        metrics.push({ label: 'Total Sum', value: sum.toFixed(2) });
        metrics.push({ label: 'Average', value: avg.toFixed(2) });
        metrics.push({ label: 'Maximum', value: max });
        metrics.push({ label: 'Minimum', value: min });
      }
    }
  } catch (error) {
    console.error('Error generating metrics from data:', error);
  }
  
  return metrics;
}

/**
 * Generates insights from data for visualization
 */
export function generateInsightsFromData(
  data: any[], 
  chartType: string,
  xKey?: string,
  yKey?: string
): string[] {
  if (!data || data.length === 0) return [];
  
  const insights: string[] = [];
  
  try {
    // Determine the keys to analyze
    const keys = Object.keys(data[0]);
    const numericalKeys = keys.filter(key => 
      !isNaN(parseFloat(data[0][key]))
    );
    
    // Use provided keys or fall back to first keys
    const categoryKey = xKey || keys[0];
    const valueKey = yKey || (numericalKeys.length > 0 ? numericalKeys[0] : keys[1]);
    
    // Extract values for analysis
    const values = data.map(item => parseFloat(item[valueKey]))
      .filter(val => !isNaN(val));
    
    if (values.length === 0) return ['No numerical data found for analysis.'];
    
    // Calculate basic stats
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    // Find max and min items
    const maxItem = data.find(item => parseFloat(item[valueKey]) === max);
    const minItem = data.find(item => parseFloat(item[valueKey]) === min);
    
    // Generate basic insights
    insights.push(`The data contains ${data.length} records.`);
    
    if (maxItem) {
      insights.push(`The highest ${valueKey} is ${max}, found in ${maxItem[categoryKey]}.`);
    }
    
    if (minItem) {
      insights.push(`The lowest ${valueKey} is ${min}, found in ${minItem[categoryKey]}.`);
    }
    
    // Check for outliers
    const std = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
    );
    const outliers = data.filter(item => 
      Math.abs(parseFloat(item[valueKey]) - avg) > 2 * std
    );
    
    if (outliers.length > 0) {
      insights.push(`Found ${outliers.length} notable outliers in the data.`);
    }
    
    // Add chart-specific insights
    if (chartType === 'pie' || chartType === 'treemap') {
      // Calculate percentages for pie/treemap
      const total = sum;
      const topSegment = data.sort((a, b) => 
        parseFloat(b[valueKey]) - parseFloat(a[valueKey])
      )[0];
      
      if (topSegment) {
        const topValue = parseFloat(topSegment[valueKey]);
        const percentage = (topValue / total * 100).toFixed(1);
        insights.push(`The largest segment, ${topSegment[categoryKey]}, represents ${percentage}% of the total.`);
      }
    }
    
    if (chartType === 'bar' || chartType === 'line') {
      // Look for trends in line/bar charts
      if (data.length > 3) {
        const increases = data
          .map((item, i) => i > 0 ? 
            parseFloat(item[valueKey]) > parseFloat(data[i-1][valueKey]) : false
          )
          .filter(Boolean).length;
        
        const percentIncrease = (increases / (data.length - 1) * 100).toFixed(0);
        
        if (parseInt(percentIncrease) > 60) {
          insights.push(`There is a generally increasing trend, with values rising ${percentIncrease}% of the time.`);
        } else if (parseInt(percentIncrease) < 40) {
          insights.push(`There is a generally decreasing trend, with values falling ${100 - parseInt(percentIncrease)}% of the time.`);
        }
      }
    }
  } catch (error) {
    console.error('Error generating insights from data:', error);
    insights.push('Unable to generate insights due to an error in data analysis.');
  }
  
  return insights;
}

/**
 * Generates domain-specific insights based on data and source type
 */
export function generateDomainSpecificInsights(
  data: any[],
  dataSourceType: string
): string[] {
  const insights: string[] = [];
  
  // Skip if no data
  if (!data || data.length === 0) return insights;
  
  try {
    // Analyze data based on source type
    switch (dataSourceType) {
      case 'pdf':
        insights.push('This data was extracted from a PDF document.');
        break;
        
      case 'spreadsheet':
      case 'csv':
      case 'excel':
        insights.push('This data was extracted from a spreadsheet.');
        
        // Check for temporal data
        const keys = Object.keys(data[0]);
        const dateKeys = keys.filter(key => {
          const val = String(data[0][key]);
          return val.match(/^\d{4}-\d{2}-\d{2}/) || 
                 val.match(/^\d{1,2}\/\d{1,2}\/\d{4}/) ||
                 val.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
        });
        
        if (dateKeys.length > 0) {
          insights.push('This dataset contains time-series information that could be tracked over time.');
        }
        break;
        
      case 'database':
      case 'sql':
        insights.push('This data was retrieved from a database query.');
        break;
        
      case 'qdrant':
      case 'vector_db':
      case 'vector-db':
      case 'vectordb':
        insights.push('This data was retrieved from a vector database using semantic search.');
        break;
        
      default:
        // No specific insights for unknown source types
        break;
    }
  } catch (error) {
    console.error('Error generating domain-specific insights:', error);
  }
  
  return insights;
}

/**
 * Generates a text summary from data
 */
export function generateSummaryFromData(data: any[]): string {
  if (!data || data.length === 0) return 'No data available for summary.';
  
  try {
    const keys = Object.keys(data[0]);
    const numericKeys = keys.filter(key => !isNaN(parseFloat(data[0][key])));
    
    if (numericKeys.length === 0) {
      return `This dataset contains ${data.length} records with ${keys.length} attributes.`;
    }
    
    // Calculate some basic statistics for the first numeric column
    const numericKey = numericKeys[0];
    const values = data.map(item => parseFloat(item[numericKey])).filter(val => !isNaN(val));
    
    if (values.length === 0) return `This dataset contains ${data.length} records.`;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = (sum / values.length).toFixed(2);
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    return `This dataset contains ${data.length} records. For the ${numericKey} field, the average value is ${avg}, ranging from ${min} to ${max}.`;
  } catch (error) {
    console.error('Error generating summary from data:', error);
    return `This dataset contains ${data?.length || 0} records.`;
  }
}

/**
 * Generates recommendations based on chart type
 */
export function generateRecommendations(chartType: string): string[] {
  const recommendations: string[] = [];
  
  // Add general recommendations
  recommendations.push("Consider filtering the data to focus on key insights.");
  
  // Add chart-specific recommendations
  switch (chartType.toLowerCase()) {
    case 'bar':
      recommendations.push("Try sorting the bars by value to identify patterns.");
      recommendations.push("Consider grouping smaller categories into an 'Other' category.");
      break;
      
    case 'line':
      recommendations.push("Look for seasonal patterns or trends over time.");
      recommendations.push("Consider adding a moving average to highlight trends.");
      break;
      
    case 'pie':
      recommendations.push("Focus on the top segments that make up the majority of the data.");
      recommendations.push("Consider using a bar chart if there are many small segments.");
      break;
      
    case 'scatter':
      recommendations.push("Look for clusters of data points that might indicate patterns.");
      recommendations.push("Consider adding trend lines to visualize relationships.");
      break;
      
    default:
      recommendations.push("Experiment with different chart types to best represent the data.");
      break;
  }
  
  // Add general analytical recommendations
  recommendations.push("Compare this data with historical information to identify changes.");
  recommendations.push("Break down the analysis by different dimensions for deeper insights.");
  
  return recommendations;
} 