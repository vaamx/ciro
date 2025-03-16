/**
 * Visualization module index
 * Exports all visualization components and utilities
 */
import React, { lazy } from 'react';
import { ChartProcessor } from './ChartProcessor';
import { CHART_COLORS, DARK_CHART_COLORS, CHART_BORDER_COLORS } from './constants';

// Set to true to enable detailed console logging for debugging
const DEBUG_MODE = false;

// Lazy-loaded visualization components for better performance
const BarChart = lazy(() => import('./charts/BarChart'));
const LineChart = lazy(() => import('./charts/LineChart'));
const PieChart = lazy(() => import('./charts/PieChart'));
const AreaChart = lazy(() => import('./charts/AreaChart'));
const ScatterChart = lazy(() => import('./charts/ScatterChart'));
const RadarChart = lazy(() => import('./charts/RadarChart'));

// Additional chart types
const HeatmapChart = lazy(() => import('./charts/HeatmapChart'));
const FunnelChart = lazy(() => import('./charts/FunnelChart'));
const TreemapChart = lazy(() => import('./charts/TreemapChart'));
const AnimatedChart = lazy(() => import('./charts/AnimatedChart'));
const ThreeDChart = lazy(() => import('./charts/ThreeDChart'));
const SankeyDiagram = lazy(() => import('./charts/SankeyDiagram'));
const GeospatialMap = lazy(() => import('./charts/GeospatialMap'));
const NetworkGraph = lazy(() => import('./charts/NetworkGraph'));

// Define mapping of type strings to normalized chart types
const chartTypeMap: Record<string, string> = {
  // Basic chart types
  'bar': 'bar',
  'column': 'bar',
  'line': 'line',
  'area': 'area',
  'pie': 'pie',
  'scatter': 'scatter',
  'radar': 'radar',
  
  // Advanced chart types
  'heatmap': 'heatmap',
  'heat map': 'heatmap',
  'heat': 'heatmap',
  'funnel': 'funnel',
  'treemap': 'treemap',
  'tree map': 'treemap',
  'tree': 'treemap',
  'animated': 'animated',
  'animation': 'animated',
  '3d': 'threeD',
  'three dimensional': 'threeD',
  'threeD': 'threeD',
  'sankey': 'sankey',
  'flow': 'sankey',
  'map': 'geospatial',
  'geo': 'geospatial',
  'geospatial': 'geospatial',
  'geographical': 'geospatial',
  'network': 'network',
  'graph': 'network',
  'node': 'network',
  'nodes': 'network'
};

// Helper function to normalize chart type string
const normalizeChartType = (type: string = 'bar'): string => {
  const normalizedType = type.toLowerCase().trim();
  const result = chartTypeMap[normalizedType] || 'bar'; // Default to bar if unknown
  
  if (DEBUG_MODE) {
    console.log(`[CHART DEBUG] Normalizing chart type: "${type}" -> "${result}"`);
  }
  
  return result;
};

// Visualization component interface
export interface VisualizationProps {
  type?: string;
  data: any[];
  width?: number | string;
  height?: number | string;
  xKey?: string;
  yKey?: string;
  series?: Array<{
    dataKey: string;
    name?: string;
    color?: string;
    type?: string;
  }>;
  labels?: {
    title?: string;
    xAxis?: string;
    yAxis?: string;
  };
  options?: Record<string, any>;
  theme?: 'light' | 'dark';
}

/**
 * Main Visualization component that renders the appropriate chart
 * based on the type parameter
 */
const Visualization = ({
  type = 'bar',
  data,
  width = '100%',
  height = 400,
  xKey,
  yKey,
  series,
  labels,
  options,
  theme = 'light'
}: VisualizationProps) => {
  // Special debug logging for input props
  if (DEBUG_MODE) {
    console.log(`[CHART DEBUG] Input props: type=${type}, xKey=${xKey}, yKey=${yKey}, theme=${theme}`);
    console.log(`[CHART DEBUG] Data sample:`, data?.slice(0, 1) || 'No data');
  }
  
  // Normalize the requested chart type
  const normalizedType = normalizeChartType(type);
  
  // CRITICAL OVERRIDE: Force chart type based on URL parameters
  // Check URL for chart type parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlChartType = urlParams.get('chartType') || '';
  const urlHasChartType = urlChartType !== '';
  const urlHasPieChart = urlChartType === 'pie' || 
                        urlParams.get('pieChart') === 'true' || 
                        window.location.search.toLowerCase().includes('pie+chart');
                      
  // Check options for chart type override
  const optionsHasChartType = options?.forceChartType !== undefined;
  const optionsHasPieChart = options?.forceChartType === 'pie' || options?.isPieChart;
  
  // Check document title or last user query for chart type mentions
  const documentTitle = document.title.toLowerCase();
  const lastUserQuery = typeof window !== 'undefined' && 
                      'LAST_USER_QUERY' in window ? 
                      (window as any).LAST_USER_QUERY : '';
  const lastUserQueryLower = (typeof lastUserQuery === 'string') ? lastUserQuery.toLowerCase() : '';
  
  // Check for pie chart specifically
  const hasPieChartInContext = documentTitle.includes('pie chart') || 
                              lastUserQueryLower.includes('pie chart');
  
  // Determine chart type from context for other charts
  const detectChartTypeFromContext = (): string | null => {
    const content = documentTitle + ' ' + lastUserQueryLower;
    
    for (const [term, chartType] of Object.entries(chartTypeMap)) {
      if (content.includes(term)) {
        if (DEBUG_MODE) {
          console.log(`[CHART DEBUG] Detected "${term}" in context, mapped to chart type: "${chartType}"`);
        }
        return chartType;
      }
    }
    
    return null; // No match found
  };
  
  const contextChartType = detectChartTypeFromContext();
  
  // Final determination: what chart type should we use?
  const shouldForcePieChart = urlHasPieChart || optionsHasPieChart || hasPieChartInContext || normalizedType === 'pie';
  
  // Priority: Direct type specification overrides everything else
  let effectiveType = normalizedType;
  
  let typeSource = "direct";
  
  // Apply different override sources with debug tracing
  if (urlHasChartType) {
    const urlNormalizedType = normalizeChartType(urlChartType);
    if (DEBUG_MODE) {
      console.log(`[CHART DEBUG] URL override: "${urlChartType}" -> "${urlNormalizedType}"`);
    }
    effectiveType = urlNormalizedType;
    typeSource = "url";
  } else if (optionsHasChartType) {
    const optionsNormalizedType = normalizeChartType(options?.forceChartType);
    if (DEBUG_MODE) {
      console.log(`[CHART DEBUG] Options override: "${options?.forceChartType}" -> "${optionsNormalizedType}"`);
    }
    effectiveType = optionsNormalizedType;
    typeSource = "options";
  } else if (contextChartType) {
    if (DEBUG_MODE) {
      console.log(`[CHART DEBUG] Context override: detected "${contextChartType}"`);
    }
    effectiveType = contextChartType;
    typeSource = "context";
  }
  
  // Special case: force pie chart if the criteria is met
  if (shouldForcePieChart && effectiveType !== 'pie') {
    if (DEBUG_MODE) {
      console.log(`[CHART DEBUG] Pie override: forcing pie chart (was "${effectiveType}")`);
    }
    effectiveType = 'pie';
    typeSource = "pie-override";
  }
  
  // Check local storage for debugging overrides
  const storedChartType = localStorage.getItem('FORCE_CHART_TYPE');
  if (storedChartType) {
    const storedNormalizedType = normalizeChartType(storedChartType);
    if (DEBUG_MODE) {
      console.log(`[CHART DEBUG] localStorage override: "${storedChartType}" -> "${storedNormalizedType}"`);
    }
    effectiveType = storedNormalizedType;
    typeSource = "localStorage";
  }
  
  // Get the appropriate color palette based on theme
  const colorPalette = theme === 'dark' ? DARK_CHART_COLORS : CHART_COLORS;
  const borderColors = CHART_BORDER_COLORS;
  
  // Prepare sample data for charts that need special formatting
  const prepareChartData = (chartType: string, inputData: any[]) => {
    // Only process if we have data
    if (!inputData || !Array.isArray(inputData) || inputData.length === 0) {
      return inputData;
    }
    
    // Special data preparation for different chart types
    switch(chartType) {
      case 'heatmap':
        // Heatmap expects 2D array of values
        if (!Array.isArray(inputData[0])) {
          // Convert standard data to 2D array for heatmap
          // Extract unique x and y categories for creating a grid
          const xValues = [...new Set(inputData.map(d => d[xKey || 'x']))];
          const yValues = [...new Set(inputData.map(d => d[yKey || 'y']))];
          
          // Create a grid with intensity values
          return yValues.map(y => 
            xValues.map(x => {
              const match = inputData.find(d => d[xKey || 'x'] === x && d[yKey || 'y'] === y);
              return match ? match['value'] || 0.5 : 0;
            })
          );
        }
        return inputData;
        
      case 'treemap':
        // Treemap often expects hierarchical data
        if (inputData[0] && !inputData[0].children) {
          // Convert flat data to simple hierarchy
          return [{
            name: "Root",
            children: inputData.map(item => ({
              name: item[xKey || 'name'] || 'Unknown',
              value: parseFloat(item[yKey || 'value']) || 1
            }))
          }];
        }
        return inputData;
        
      default:
        return inputData;
    }
  };
  
  // Prepare chart options based on type
  const getTypeSpecificOptions = (chartType: string) => {
    switch(chartType) {
      case 'pie':
        return {
          forceChartType: 'pie',
          isPieChart: true,
          useMultipleColors: true
        };
      case 'heatmap':
        return {
          useColorGradient: true,
          showLegend: true,
          title: 'Heatmap Visualization'
        };
      case 'treemap':
        return {
          hierarchical: true,
          useColorGradient: true,
          title: 'Treemap Visualization'
        };
      case 'network':
        return {
          interactive: true,
          enableZoom: true,
          title: 'Network Graph'
        };
      case 'geospatial':
        return {
          projection: 'mercator',
          enableZoom: true,
          title: 'Geospatial Map'
        };
      case 'funnel':
        return {
          invertedColors: false,
          showPercentage: true,
          title: 'Funnel Chart'
        };
      case 'sankey':
        return {
          nodeWidth: 20,
          nodePadding: 10,
          title: 'Sankey Diagram'
        };
      case 'threeD':
        return {
          rotationEnabled: true,
          title: '3D Visualization'
        };
      default:
        return {};
    }
  };
  
  // Process data based on chart type
  const processedData = prepareChartData(effectiveType, data);
  
  // Override original options with type-specific settings
  const effectiveOptions = {
    // Base options with color support
    colors: colorPalette,
    borderColors: borderColors,
    
    // Core visualization options
    useDirectColorAssignment: true,  // Enable by default for consistent coloring
    animation: true,
    maintainAspectRatio: false,
    barPercentage: 0.8,
    categoryPercentage: 0.7,
    borderRadius: 4,
    responsive: true,
    
    // Add axis labels if provided
    xAxisLabel: labels?.xAxis || '',
    yAxisLabel: labels?.yAxis || '',
    
    // Chart type (for components that need to know their type)
    chartType: effectiveType,
    
    // User provided options override defaults
    ...(options || {}),
    
    // Chart type specific options
    ...getTypeSpecificOptions(effectiveType)
  };
  
  // Log detailed visualization props for debugging
  if (DEBUG_MODE) {
    console.log('Visualization final props:', { 
      type, 
      normalizedType,
      effectiveType,
      typeSource,
      data: processedData?.length ? `[${processedData.length} items]` : 'No data',
      options: effectiveOptions,
      chartType: effectiveOptions.chartType
    });
  }
  
  // Ensure we have a valid dataset and type
  if (!processedData || processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-100 dark:bg-gray-800 rounded-md">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  // Force set a chart type for testing or emergency override
  // This function is exposed globally for debugging
  const forceChartType = (chartType: string, value = true) => {
    try {
      if (value) {
        localStorage.setItem('FORCE_CHART_TYPE', chartType);
        console.log(`[CRITICAL DEBUG] Set FORCE_CHART_TYPE to ${chartType}`);
      } else {
        localStorage.removeItem('FORCE_CHART_TYPE');
        console.log('[CRITICAL DEBUG] Removed FORCE_CHART_TYPE override');
      }
      // Force reload the page to apply the change
      window.location.reload();
    } catch (e) {
      console.error('Failed to set force chart type:', e);
    }
  };
  
  // Backward compatibility for pie chart override
  const forcePieChart = (value = true) => {
    forceChartType('pie', value);
  };
  
  // Expose the functions globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).forceChartType = forceChartType;
    (window as any).forcePieChart = forcePieChart;
  }

  // Prepare standard props for all chart types
  const chartProps = {
    data: processedData,
    width,
    height,
    xKey,
    yKey,
    series,
    labels,
    options: effectiveOptions,
    theme,
    type: effectiveType
  };

  // Enhanced error handling for component rendering
  const renderChartWithErrorHandling = (ChartComponent: React.LazyExoticComponent<React.FC<VisualizationProps>>) => {
    try {
      // Wrap in error boundary
      return (
        <React.Suspense fallback={
          <div className="flex items-center justify-center h-full w-full bg-gray-100 dark:bg-gray-800 rounded-md">
            <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading visualization...</div>
          </div>
        }>
          <ChartErrorBoundary fallback={
            <div className="flex flex-col items-center justify-center h-full w-full bg-red-50 dark:bg-red-900 rounded-md p-4">
              <p className="text-red-500 dark:text-red-300 text-center mb-2">
                Error rendering {effectiveType} chart
              </p>
              <details className="text-xs text-gray-500 dark:text-gray-400 max-w-full overflow-auto">
                <summary>Debug Info</summary>
                <pre className="whitespace-pre-wrap">
                  Chart type: {effectiveType}
                  Data sample: {JSON.stringify(processedData?.slice(0, 1), null, 2)}
                </pre>
              </details>
            </div>
          }>
            <ChartComponent {...chartProps} />
          </ChartErrorBoundary>
        </React.Suspense>
      );
    } catch (error) {
      console.error(`[CHART ERROR] Failed to render chart of type ${effectiveType}:`, error);
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-red-50 dark:bg-red-900 rounded-md p-4">
          <p className="text-red-500 dark:text-red-300 text-center mb-2">
            Error rendering {effectiveType} chart: {String(error)}
          </p>
          <details className="text-xs text-gray-500 dark:text-gray-400">
            <summary>Stack Trace</summary>
            <pre className="whitespace-pre-wrap">
              {error instanceof Error ? error.stack : 'No stack trace available'}
            </pre>
          </details>
        </div>
      );
    }
  };

  // Render based on chart type with suspense for lazy loading
  // Removed log: console.log(`[CRITICAL DEBUG] Rendering chart component for type: "${effectiveType}"`);
  
  // Switch based on effective chart type
  switch (effectiveType) {
    case 'pie':
      return renderChartWithErrorHandling(PieChart);
    case 'line':
      return renderChartWithErrorHandling(LineChart);
    case 'area':
      return renderChartWithErrorHandling(AreaChart);
    case 'scatter':
      return renderChartWithErrorHandling(ScatterChart);
    case 'radar':
      return renderChartWithErrorHandling(RadarChart);
    case 'heatmap':
      return renderChartWithErrorHandling(HeatmapChart);
    case 'funnel':
      return renderChartWithErrorHandling(FunnelChart);
    case 'treemap':
      return renderChartWithErrorHandling(TreemapChart);
    case 'animated':
      return renderChartWithErrorHandling(AnimatedChart);
    case 'threeD':
      return renderChartWithErrorHandling(ThreeDChart);
    case 'sankey':
      return renderChartWithErrorHandling(SankeyDiagram);
    case 'geospatial':
      return renderChartWithErrorHandling(GeospatialMap);
    case 'network':
      return renderChartWithErrorHandling(NetworkGraph);
    case 'bar':
    default:
      return renderChartWithErrorHandling(BarChart);
  }
};

// Export the ChartProcessor for data transformation
export { ChartProcessor };

// Export both as named and default export
export { Visualization };
export default Visualization;

// Add ChartErrorBoundary component at the top of the file
class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[CHART ERROR] Chart component failed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
} 