import React, { useState, useCallback, Suspense } from 'react';
import { validateVisualizationType } from './utils';
import { TableVisualization } from '../../../../Visualization/tables/TableVisualization';
import type { ChartSeries } from '../../../../Visualization/echarts/types';

// Loading placeholder for lazy-loaded components
export const VisualizationLoader = () => (
  <div className="animate-pulse rounded-lg overflow-hidden">
    <div className="h-64 bg-gray-200 dark:bg-gray-700"></div>
    <div className="h-4 mt-3 bg-gray-200 dark:bg-gray-700 w-3/4 rounded"></div>
    <div className="h-3 mt-2 bg-gray-200 dark:bg-gray-700 w-1/2 rounded"></div>
  </div>
);

/**
 * Configuration for visualization
 */
export interface VisualizationConfig {
  type: string;
  data: any[];
  config?: {
    xKey?: string;
    yKey?: string;
    series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
    labels?: { title?: string; xAxis?: string; yAxis?: string };
  };
  options?: Record<string, any>;
}

interface VisualizationRendererProps {
  visualizationConfig: VisualizationConfig;
  height?: number;
  showControls?: boolean;
  onAddToDashboard?: (config: VisualizationConfig) => void;
}

/**
 * A reusable component for rendering different types of visualizations
 * based on the provided configuration
 */
export const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({ 
  visualizationConfig, 
  height = 400, 
  showControls = true, 
  onAddToDashboard 
}) => {
  const [isAddingToDashboard, setIsAddingToDashboard] = useState(false);
  
  // Skip rendering if no config provided
  if (!visualizationConfig) {
    return <div className="text-gray-500">No visualization data available</div>;
  }
  
  const {
    type: vizType,
    data,
    config = {},
    options = {}
  } = visualizationConfig;
  
  // Validate visualization type
  const chartType = validateVisualizationType(vizType);
  
  // Handle adding to dashboard
  const handleAddToDashboard = useCallback(() => {
    if (onAddToDashboard) {
      setIsAddingToDashboard(true);
      try {
        onAddToDashboard(visualizationConfig);
      } finally {
        setIsAddingToDashboard(false);
      }
    }
  }, [visualizationConfig, onAddToDashboard]);
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-gray-500">No data available for visualization</div>;
  }
  
  // Ensure the config has proper theme settings
  const theme = document.documentElement.classList.contains('dark') ? 'dark' as const : 'light' as const;
  
  // Transform series format if provided
  const transformedSeries: ChartSeries[] | undefined = config.series?.map(item => ({
    name: item.name || item.dataKey,
    dataKey: item.dataKey,
    type: item.type,
    color: item.color
  }));
  
  // Determine which visualization component to render based on type
  const getVisualizationComponent = () => {
    switch (chartType) {
      case 'bar':
        return {
          component: React.lazy(() => import('../../../../Visualization/echarts').then(module => ({ default: module.BarChart }))),
          props: {
            data,
            xKey: config.xKey || Object.keys(data[0])[0],
            yKey: config.yKey || Object.keys(data[0])[1],
            height,
            series: transformedSeries,
            theme,
            labels: {
              title: config.labels?.title,
              xAxis: config.labels?.xAxis,
              yAxis: config.labels?.yAxis
            },
            ...options
          }
        };
      case 'line':
        return {
          component: React.lazy(() => import('../../../../Visualization/echarts').then(module => ({ default: module.LineChart }))),
          props: {
            data,
            xKey: config.xKey || Object.keys(data[0])[0],
            yKey: config.yKey || Object.keys(data[0])[1],
            height,
            series: transformedSeries,
            theme,
            labels: {
              title: config.labels?.title,
              xAxis: config.labels?.xAxis,
              yAxis: config.labels?.yAxis
            },
            ...options
          }
        };
      case 'pie':
        return {
          component: React.lazy(() => import('../../../../Visualization/echarts').then(module => ({ default: module.PieChart }))),
          props: {
            data,
            nameKey: config.xKey || Object.keys(data[0])[0],
            valueKey: config.yKey || Object.keys(data[0])[1],
            height,
            theme,
            labels: {
              title: config.labels?.title
            },
            ...options
          }
        };
      case 'table':
        return {
          component: React.lazy(() => 
            Promise.resolve({ default: (props: any) => <TableVisualization {...props} /> })
          ),
          props: {
            data,
            height,
            title: config.labels?.title,
            darkMode: theme === 'dark',
            ...options
          }
        };
      // Add more visualization types as needed
      default:
        // Fallback to table for unknown types
        return {
          component: React.lazy(() => 
            Promise.resolve({ default: (props: any) => <TableVisualization {...props} /> })
          ),
          props: {
            data,
            height,
            title: config.labels?.title || 'Data',
            darkMode: theme === 'dark',
            ...options
          }
        };
    }
  };
  
  const { component: VisualizationComponent, props: componentProps } = getVisualizationComponent();
  
  return (
    <div className="relative chart-container" style={{ height: `${height}px` }}>
      {showControls && (
        <div className="absolute top-2 right-2 z-10 flex space-x-2">
          {onAddToDashboard && (
            <button
              className="bg-white dark:bg-gray-800 p-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={handleAddToDashboard}
              disabled={isAddingToDashboard}
              title="Add to dashboard"
            >
              {isAddingToDashboard ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
      <Suspense fallback={<VisualizationLoader />}>
        {VisualizationComponent && <VisualizationComponent {...componentProps} />}
      </Suspense>
    </div>
  );
}; 