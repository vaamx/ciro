import React, { useEffect, useState, Suspense, lazy } from 'react';
import { AlertCircle, BarChart2, LineChart, PieChart, Activity, Table, HelpCircle, Maximize2, Minimize2, MapPin } from 'lucide-react';

// Import debug logger
const DEBUG_MODE = true;

// Debug logging function
const logDebug = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(`[VisualizationWidget] ${message}`, ...args);
  }
};

// Lazy load the Visualization component
const LazyVisualization = lazy(() => import('../../Visualization').then(module => ({ default: module.Visualization })));

// Loading component with improved styling
const LoadingVisualization = () => (
  <div className="flex items-center justify-center h-full text-center p-6 bg-gray-50 dark:bg-gray-800/30 rounded-lg animate-pulse">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 font-medium">Loading visualization data...</p>
    </div>
  </div>
);

// Enhanced NoDataVisualization to show more helpful information
const NoDataVisualization = ({ debugInfo }: { debugInfo?: any }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center mb-3">
      <HelpCircle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
    </div>
    <h3 className="text-base font-medium text-amber-700 dark:text-amber-300 mb-1">No Visualization Data</h3>
    <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
      The widget is configured correctly but no data is available to display.
    </p>
    {DEBUG_MODE && debugInfo && (
      <details className="mt-2 text-xs text-amber-600 dark:text-amber-500">
        <summary className="cursor-pointer">Debug Information</summary>
        <div className="mt-1 p-2 bg-amber-100 dark:bg-amber-900/40 rounded text-left whitespace-pre-wrap max-h-40 overflow-y-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </div>
      </details>
    )}
  </div>
);

// Error component with improved styling
const ErrorVisualization = ({ error }: { error: string }) => (
  <div className="flex flex-col h-full p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 overflow-y-auto">
    <div className="flex items-center mb-3">
      <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mr-2" />
      <h3 className="text-base font-medium text-red-700 dark:text-red-300">Visualization Error</h3>
    </div>
    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  </div>
);

// Get icon based on chart type
const getChartIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'bar':
      return <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
    case 'line':
      return <LineChart className="w-5 h-5 text-green-500 dark:text-green-400" />;
    case 'pie':
      return <PieChart className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
    case 'area':
      return <Activity className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
    case 'table':
      return <Table className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
    case 'map':
    case 'geospatial':
      return <MapPin className="w-5 h-5 text-red-500 dark:text-red-400" />;
    case 'radar':
      return <Activity className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />;
    case 'heatmap':
      return <Activity className="w-5 h-5 text-orange-500 dark:text-orange-400" />;
    default:
      return <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
  }
};

interface VisualizationWidgetProps {
  settings: {
    visualization?: {
      type: string;
      data: any[];
      xKey: string;
      yKey: string;
      series?: any[];
      labels?: {
        title?: string;
        xAxis?: string;
        yAxis?: string;
      };
      options?: any;
    };
  };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const VisualizationWidget: React.FC<VisualizationWidgetProps> = ({ 
  settings, 
  isExpanded = false,
  onToggleExpand
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [localExpanded, setLocalExpanded] = useState<boolean>(false);
  
  // Extract visualization settings
  const visualization = settings?.visualization;
  
  // Handle expand toggle
  const handleExpandToggle = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalExpanded(!localExpanded);
    }
  };
  
  // Determine if expanded (either from props or local state)
  const isWidgetExpanded = isExpanded || localExpanded;
  
  useEffect(() => {
    // Initial loading state
    setLoading(true);
    setError(null);
    
    // Debug info
    logDebug('Initializing visualization with settings:', settings);
    
    // Validate visualization data
    if (!visualization) {
      setError('Invalid Visualization Configuration');
      setLoading(false);
      logDebug('Error: Invalid visualization configuration');
      return;
    }
    
    if (!visualization.data || !Array.isArray(visualization.data) || visualization.data.length === 0) {
      setLoading(false);
      logDebug('Warning: No data available for visualization');
      // Instead of showing an error, we'll show a "No Data" message
      return;
    }
    
    try {
      // Process chart data
      setChartData(visualization);
      logDebug('Visualization data processed successfully', visualization);
      
      // Short delay to show loading state
      setTimeout(() => {
        setLoading(false);
      }, 300);
    } catch (err) {
      const errorMessage = 'Error processing visualization data: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMessage);
      setLoading(false);
      logDebug('Error:', errorMessage);
    }
  }, [visualization]);
  
  // Render the appropriate visualization based on type
  const renderVisualization = () => {
    if (!chartData) return null;
    
    // Get theme from document or settings
    const isDarkMode = document.documentElement.classList.contains('dark');
    const theme = isDarkMode ? 'dark' : 'light' as 'dark' | 'light';
    
    // Enhanced text styling for better readability in both modes
    const textStyles = {
      title: {
        fill: isDarkMode ? '#f9fafb' : '#111827', // Lighter in dark mode, darker in light mode
        fontSize: isWidgetExpanded ? 16 : 14,
        fontWeight: 600,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      },
      subtitle: {
        fill: isDarkMode ? '#e5e7eb' : '#374151',
        fontSize: isWidgetExpanded ? 14 : 12,
        fontWeight: 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      },
      axisLabel: {
        fill: isDarkMode ? '#d1d5db' : '#4b5563',
        fontSize: isWidgetExpanded ? 13 : 11,
        fontWeight: 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      },
      tick: {
        fill: isDarkMode ? '#9ca3af' : '#6b7280',
        fontSize: isWidgetExpanded ? 12 : 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }
    };

    // Create visualization props
    const visualizationProps = {
      type: chartData.type,
      data: chartData.data,
      xKey: chartData.xKey,
      yKey: chartData.yKey,
      series: chartData.series,
      labels: chartData.labels,
      width: '100%',
      height: isWidgetExpanded ? 350 : 200,
      theme,
      options: {
        // Base settings
        animation: true,
        responsive: true,
        
        // Text styles from above
        textStyle: textStyles,
        
        // Grid and axis settings
        showGrid: true,
        showLegend: true,
        
        // Pass widget expansion state to allow component to optimize
        isExpanded: isWidgetExpanded,
        
        // Pass through original settings
        ...(chartData.options || {})
      }
    };

    // Safety check: ensure data exists and has items
    if (!chartData.data || chartData.data.length === 0) {
      return <NoDataVisualization debugInfo={visualizationProps} />;
    }

    return (
      <div className="h-full w-full">
        <Suspense fallback={<LoadingVisualization />}>
          <LazyVisualization {...visualizationProps} />
        </Suspense>
      </div>
    );
  };
  
  // Main render
  return (
    <div className={`visualization-widget h-full flex flex-col overflow-hidden ${isWidgetExpanded ? 'expanded-widget' : ''}`}>
      {/* Chart header with type icon and expand button */}
      {visualization?.type && (
        <div className="flex items-center justify-between px-2 py-2 mb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 mr-2">
              {getChartIcon(visualization.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                {visualization?.labels?.title || 'Data Visualization'}
              </h4>
              {visualization?.labels?.xAxis && visualization?.labels?.yAxis && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {visualization.labels.xAxis} vs {visualization.labels.yAxis}
                </p>
              )}
            </div>
          </div>
          
          {/* Expand/Collapse button */}
          <button 
            onClick={handleExpandToggle}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isWidgetExpanded ? "Collapse" : "Expand"}
            aria-label={isWidgetExpanded ? "Collapse visualization" : "Expand visualization"}
          >
            {isWidgetExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
      
      {/* Chart content */}
      <div className={`flex-1 min-h-0 rounded-lg overflow-hidden transition-all duration-300 ${isWidgetExpanded ? 'p-4' : ''}`}>
        {loading ? (
          <LoadingVisualization />
        ) : error ? (
          <ErrorVisualization error={error} />
        ) : !visualization?.data || visualization.data.length === 0 ? (
          <NoDataVisualization debugInfo={visualization} />
        ) : (
          renderVisualization()
        )}
      </div>
      
      {/* Optional footer with data summary */}
      {!loading && !error && visualization?.data && visualization.data.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 px-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{visualization.data.length} data points</span>
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};