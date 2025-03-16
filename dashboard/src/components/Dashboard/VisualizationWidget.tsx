import React, { useEffect, useState, Suspense, lazy } from 'react';
import { AlertCircle, BarChart2, LineChart, PieChart, Activity, Table, HelpCircle, Maximize2, Minimize2 } from 'lucide-react';

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

// No data component
const NoDataVisualization = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center mb-3">
      <HelpCircle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
    </div>
    <h3 className="text-base font-medium text-amber-700 dark:text-amber-300 mb-1">No Visualization Data</h3>
    <p className="text-sm text-amber-600 dark:text-amber-400">
      The widget is configured correctly but no data is available to display.
    </p>
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
    
    // Validate visualization data
    if (!visualization) {
      setError('Invalid Visualization Configuration');
      setLoading(false);
      return;
    }
    
    if (!visualization.data || !Array.isArray(visualization.data) || visualization.data.length === 0) {
      setLoading(false);
      // Instead of showing an error, we'll show a "No Data" message
      return;
    }
    
    try {
      // Process chart data
      setChartData(visualization);
      
      // Short delay to show loading state
      setTimeout(() => {
        setLoading(false);
      }, 300);
    } catch (err) {
      setError('Error processing visualization data: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  }, [visualization]);
  
  // Render the appropriate visualization based on type
  const renderVisualization = () => {
    if (!chartData) return null;
    
    // Get theme from document or settings
    const isDarkMode = document.documentElement.classList.contains('dark');
    const theme = isDarkMode ? 'dark' : 'light';
    
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
      },
      legend: {
        fill: isDarkMode ? '#e5e7eb' : '#374151',
        fontSize: isWidgetExpanded ? 12 : 10,
        fontWeight: 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }
    };
    
    // Enhanced grid styling
    const gridStyles = {
      stroke: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.8)',
      strokeDasharray: '3 3'
    };
    
    // Enhanced tooltip styling
    const tooltipStyles = {
      contentStyle: {
        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        borderColor: isDarkMode ? '#374151' : '#e5e7eb',
        color: isDarkMode ? '#f3f4f6' : '#1f2937',
        boxShadow: isDarkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        borderRadius: '0.375rem',
        padding: '0.5rem 0.75rem',
        fontSize: isWidgetExpanded ? '0.875rem' : '0.75rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      },
      itemStyle: {
        color: isDarkMode ? '#d1d5db' : '#4b5563',
        fontSize: isWidgetExpanded ? '0.875rem' : '0.75rem',
        padding: '0.25rem 0'
      },
      labelStyle: {
        color: isDarkMode ? '#f3f4f6' : '#1f2937',
        fontWeight: 600,
        marginRight: '0.5rem'
      }
    };
    
    // Create visualization props from chart data with enhanced styling
    const visualizationProps = {
      type: chartData.type || 'bar',
      data: chartData.data,
      xKey: chartData.xKey,
      yKey: chartData.yKey,
      series: chartData.series,
      labels: {
        ...chartData.labels,
        // Enhanced text styling for better readability
        style: textStyles
      },
      options: {
        ...chartData.options,
        useMultipleColors: chartData.type === 'bar' ? true : false,
        theme,
        darkMode: isDarkMode,
        // Enhanced options for better dark mode support
        grid: gridStyles,
        tooltip: tooltipStyles,
        // Enhanced legend options
        legend: {
          enabled: true,
          position: 'bottom',
          align: 'center',
          verticalAlign: 'bottom',
          layout: 'horizontal',
          itemStyle: textStyles.legend
        },
        // Enhanced axis options
        xAxis: {
          tickSize: isWidgetExpanded ? 5 : 3,
          tickPadding: isWidgetExpanded ? 8 : 5,
          tickRotation: 0,
          legendOffset: isWidgetExpanded ? 40 : 30,
          legendPosition: 'middle',
          textStyle: textStyles.tick
        },
        yAxis: {
          tickSize: isWidgetExpanded ? 5 : 3,
          tickPadding: isWidgetExpanded ? 8 : 5,
          tickRotation: 0,
          legendOffset: isWidgetExpanded ? -40 : -30,
          legendPosition: 'middle',
          textStyle: textStyles.tick
        },
        // Enhanced animation for expanded view
        animate: true,
        animationDuration: isWidgetExpanded ? 800 : 500,
        // Enhanced padding for expanded view
        padding: isWidgetExpanded ? { top: 30, right: 30, bottom: 50, left: 60 } : { top: 20, right: 20, bottom: 40, left: 50 },
        // Enhanced responsive options
        responsive: true,
        maintainAspectRatio: false
      },
      height: isWidgetExpanded ? 500 : 300,
      width: '100%'
    };
    
    // Add specific enhancements for different chart types
    if (chartData.type === 'pie') {
      visualizationProps.options = {
        ...visualizationProps.options,
        // Enhanced pie chart options
        innerRadius: isWidgetExpanded ? 0.3 : 0.2,
        padAngle: 0.5,
        cornerRadius: 4,
        activeOuterRadiusOffset: isWidgetExpanded ? 10 : 8,
        arcLabelsTextColor: isDarkMode ? '#f3f4f6' : '#1f2937',
        arcLabelsSkipAngle: 10,
        arcLinkLabelsColor: isDarkMode ? '#9ca3af' : '#6b7280',
        arcLinkLabelsThickness: 2,
        arcLinkLabelsStraightLength: isWidgetExpanded ? 16 : 12
      };
    } else if (chartData.type === 'bar') {
      visualizationProps.options = {
        ...visualizationProps.options,
        // Enhanced bar chart options
        borderRadius: 4,
        borderWidth: 0,
        padding: isWidgetExpanded ? 0.3 : 0.2,
        labelTextColor: isDarkMode ? '#f3f4f6' : '#1f2937',
        gridYValues: 5
      };
    } else if (chartData.type === 'line' || chartData.type === 'area') {
      visualizationProps.options = {
        ...visualizationProps.options,
        // Enhanced line/area chart options
        lineWidth: isWidgetExpanded ? 3 : 2,
        pointSize: isWidgetExpanded ? 8 : 6,
        pointBorderWidth: isWidgetExpanded ? 2 : 1,
        pointBorderColor: isDarkMode ? '#1f2937' : '#ffffff',
        enableArea: chartData.type === 'area',
        areaOpacity: isDarkMode ? 0.2 : 0.15,
        enablePointLabel: isWidgetExpanded,
        pointLabelYOffset: -12
      };
    }
    
        return (
      <div className={`visualization-content h-full transition-all duration-300 ${isWidgetExpanded ? 'scale-100' : 'scale-95'}`}>
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
          <NoDataVisualization />
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