/**
 * Visualization module index
 * Exports all visualization components and utilities
 */
import React, { lazy, Suspense } from 'react';

// Set to true to enable detailed console logging for debugging
const DEBUG_MODE = false;

// Import main chart components
const BaseChart = lazy(() => import('./echarts').then(module => ({ default: module.BaseChart })));
const BarChart = lazy(() => import('./echarts').then(module => ({ default: module.BarChart })));
const StackedBarChart = lazy(() => import('./echarts').then(module => ({ default: module.StackedBarChart })));
const HorizontalBarChart = lazy(() => import('./echarts').then(module => ({ default: module.HorizontalBarChart })));
const LineChart = lazy(() => import('./echarts').then(module => ({ default: module.LineChart })));
const AreaChart = lazy(() => import('./echarts').then(module => ({ default: module.AreaChart })));
const EnhancedAreaChart = lazy(() => import('./echarts').then(module => ({ default: module.EnhancedAreaChart })));
const PieChart = lazy(() => import('./echarts').then(module => ({ default: module.PieChart })));
const DonutChart = lazy(() => import('./echarts').then(module => ({ default: module.DonutChart })));

// Import specialized charts - defaulting to BaseChart since these aren't fully implemented yet
const RadarChart = lazy(() => import('./echarts/BaseChart'));
const ScatterChart = lazy(() => import('./echarts/BaseChart'));  
const HeatmapChart = lazy(() => import('./echarts/BaseChart'));
const FunnelChart = lazy(() => import('./echarts/BaseChart'));
const TreemapChart = lazy(() => import('./echarts/BaseChart'));
const SankeyDiagram = lazy(() => import('./echarts/BaseChart'));
const GeospatialMap = lazy(() => import('./echarts/BaseChart'));
const NetworkGraph = lazy(() => import('./echarts/BaseChart'));

// Initialize themes
if (typeof document !== 'undefined') {
  // Dynamically import and register themes at runtime
  import('./echarts').then(module => {
    if (module.registerThemes) {
      module.registerThemes();
    }
  });
}

// Define mapping of type strings to normalized chart types
const chartTypeMap: Record<string, string> = {
  // Basic chart types
  'bar': 'bar',
  'column': 'bar',
  'stacked bar': 'stackedBar',
  'stacked column': 'stackedBar',
  'horizontal bar': 'horizontalBar',
  'line': 'line',
  'area': 'area',
  'enhanced area': 'enhancedArea',
  'pie': 'pie',
  'donut': 'donut',
  'doughnut': 'donut',
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
  
  // Determine final chart type with all overrides applied
  const effectiveType = determineEffectiveChartType(normalizedType, options);
  
  // Prepare chart data for visualization
  const preparedData = prepareChartData(effectiveType, data, xKey, yKey);
  
  // Prepare chart options
  const chartOptions = {
    ...options,
    theme,
    xKey,
    yKey,
    series,
    labels
  };
  
  // Main render function to show appropriate chart
  return (
    <Suspense fallback={<LoadingVisualization />}>
      <ChartErrorBoundary fallback={<ErrorVisualization error="Failed to render chart" />}>
        {renderChart(effectiveType, preparedData, width, height, chartOptions)}
      </ChartErrorBoundary>
    </Suspense>
  );
};

// Helper to determine effective chart type with all overrides
const determineEffectiveChartType = (normalizedType: string, options?: Record<string, any>): string => {
  // Check URL for chart type parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlChartType = urlParams.get('chartType') || '';
  
  // Check options for chart type override
  const optionsChartType = options?.forceChartType;
  
  // Priority: URL > Options > Direct specification
  if (urlChartType) {
    return normalizeChartType(urlChartType);
  }
  
  if (optionsChartType) {
    return normalizeChartType(optionsChartType);
  }
  
  return normalizedType;
};

// Helper to prepare data for specific chart types
const prepareChartData = (_chartType: string, data: any[], _xKey?: string, _yKey?: string) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  // Default transformations (return as-is for most charts)
  return data;
};

// Loading component with improved styling
const LoadingVisualization = () => (
  <div className="flex items-center justify-center h-full text-center p-6 bg-gray-50 dark:bg-gray-800/30 rounded-lg animate-pulse">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 font-medium">Loading visualization data...</p>
    </div>
  </div>
);

// Error component
const ErrorVisualization = ({ error }: { error: string }) => (
  <div className="flex flex-col h-full p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 overflow-y-auto">
    <div className="flex items-center mb-3">
      <svg className="w-5 h-5 text-red-500 dark:text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path d="M12 8v4m0 4h.01" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="text-base font-medium text-red-700 dark:text-red-300">Visualization Error</h3>
    </div>
    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  </div>
);

// Render the appropriate chart based on type
const renderChart = (chartType: string, data: any[], width: string | number, height: string | number, options: any) => {
  const commonProps = {
    data,
    width,
    height,
    ...options
  };

  switch (chartType) {
    case 'bar':
      return <BarChart {...commonProps} />;
    case 'stackedBar':
      return <StackedBarChart {...commonProps} />;
    case 'horizontalBar':
      return <HorizontalBarChart {...commonProps} />;
    case 'line':
      return <LineChart {...commonProps} />;
    case 'area':
      return <AreaChart {...commonProps} />;
    case 'enhancedArea':
      return <EnhancedAreaChart {...commonProps} />;
    case 'pie':
      return <PieChart {...commonProps} />;
    case 'donut':
      return <DonutChart {...commonProps} />;
    case 'scatter':
      return <ScatterChart {...commonProps} />;
    case 'radar':
      return <RadarChart {...commonProps} />;
    case 'heatmap':
      return <HeatmapChart {...commonProps} />;
    case 'funnel':
      return <FunnelChart {...commonProps} />;
    case 'treemap':
      return <TreemapChart {...commonProps} />;
    case 'sankey':
      return <SankeyDiagram {...commonProps} />;
    case 'geospatial':
      return <GeospatialMap {...commonProps} />;
    case 'network':
      return <NetworkGraph {...commonProps} />;
    default:
      // Fallback to BaseChart with specified type
      return <BaseChart {...commonProps} type={chartType} />;
  }
};

// Error boundary for chart rendering failures
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
    console.error('Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Export the main visualization component
export { Visualization };

// Export the ECharts components for direct use
export { 
  BaseChart, 
  BarChart, 
  StackedBarChart, 
  HorizontalBarChart, 
  LineChart, 
  AreaChart,
  EnhancedAreaChart, 
  PieChart, 
  DonutChart 
}; 