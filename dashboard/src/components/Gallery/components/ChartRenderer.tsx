import React from 'react';
import { BaseChart } from '../../../Visualization/echarts';
import { ChartConfig } from '../data/chartConfigs';

interface ChartRendererProps {
  chartConfig: ChartConfig;
  theme?: string;
  isPreview?: boolean;
  customProps?: any;
  customConfig?: any;
}

/**
 * Renders a chart based on the provided configuration
 */
export const ChartRenderer: React.FC<ChartRendererProps> = ({ 
  chartConfig, 
  theme = 'light', 
  isPreview = false, 
  customProps,
  customConfig
}) => {
  const { component, sampleData, props, id } = chartConfig;
  
  // Create memoized chart options to prevent unnecessary re-renders
  const chartOptions = React.useMemo(() => {
    // Use customProps if provided, otherwise call the props function
    let options = customProps || (props ? props(theme) : {});
    
    // Apply custom configuration if provided
    if (customConfig) {
      // Apply configuration settings that affect the chart
      if (customConfig.showValues !== undefined) {
        options.showValues = customConfig.showValues;
      }
      
      if (customConfig.showGridlines !== undefined && options.options) {
        // Configure gridlines for axes
        if (options.options.xAxis) {
          options.options.xAxis.splitLine = { 
            show: customConfig.showGridlines 
          };
        }
        
        if (options.options.yAxis) {
          options.options.yAxis.splitLine = { 
            show: customConfig.showGridlines 
          };
        }
      }
      
      // Apply animation settings
      if (customConfig.animationSpeed !== undefined && options.options) {
        const duration = 
          customConfig.animationSpeed === 'slow' ? 2000 :
          customConfig.animationSpeed === 'medium' ? 1000 :
          customConfig.animationSpeed === 'fast' ? 500 : 0;
        
        options.options.animation = customConfig.animationSpeed !== 'none';
        options.options.animationDuration = duration;
      }
    }
    
    // Ensure adequate height and width for all chart renderings
    if (options.height && typeof options.height === 'number') {
      options.height = isPreview && id?.includes('bridge') 
        ? 280 
        : Math.max(options.height, isPreview ? 300 : options.height);
    }
    
    // Ensure width is set for all charts in preview mode
    if (isPreview && !options.width) {
      options.width = '100%';
    }
    
    // Add special handling for Enhanced Area Chart in preview mode
    if (isPreview && id === 'enhanced-area-chart') {
      // Adjust grid settings for EnhancedAreaChart for better preview appearance
      options.options = {
        ...options.options,
        grid: {
          ...options.options?.grid,
          top: 30,     // Adjusted top margin
          right: 30,   // Adjusted right margin
          bottom: 5,   // Minimum bottom margin
          left: 20     // Minimum left margin
        },
        yAxis: {
          ...options.options?.yAxis,
          show: false, // Hide y-axis in preview
          axisLabel: {
            ...options.options?.yAxis?.axisLabel,
            show: false // Hide y-axis labels in preview
          }
        },
        xAxis: {
          ...options.options?.xAxis,
          show: false, // Hide x-axis in preview
          axisLabel: {
            ...options.options?.xAxis?.axisLabel,
            show: false // Hide x-axis labels in preview
          }
        }
      };
      
      // Adjust data point sizes and labels for preview
      options.showValues = false;       // Hide value labels in preview
      options.showSymbol = true;        // Show data points
      options.symbolSize = 4;           // Smaller symbols
      options.showPY = true;            // Show PY line
      options.lineWidth = 2;            // Thinner lines
      options.showConnectingLines = false; // Hide connecting lines in preview
      options.isPreview = true;         // Explicitly set preview mode
      options.hideAxisLabels = true;    // Hide all axis labels
      
      // More compact growth indicator
      options.overallGrowthCompact = true; // Enable compact growth indicator
    }
    
    // Add special handling for YoY Comparison Bar Chart in preview mode
    if (isPreview && id === 'yoy-comparison-bar-chart') {
      // Create a completely clean chart with minimal elements
      options.options = {
        ...options.options,
        title: {
          show: false
        },
        tooltip: {
          show: false
        },
        legend: {
          show: false
        },
        grid: {
          top: 5,
          right: 25,
          bottom: 15,
          left: 15
        },
        xAxis: {
          show: false,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        },
        yAxis: {
          show: false,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      };
      
      // Only show bars without any additional elements
      options.showValues = false;        // Hide value labels
      options.showAllPercentages = false; // Hide percentage indicators
      options.viewType = 'gallery';      // Use gallery view type for simplified rendering
      options.isPreview = true;          // Set preview mode
    }
    
    // Add extra bottom padding for bar charts in preview mode
    if (isPreview && (id?.includes('bar') || component.name === 'BarChart')) {
      options.options = {
        ...options.options,
        grid: {
          ...options.options?.grid,
          bottom: 120  // Reduced padding since we're hiding x-axis labels
        },
        xAxis: {
          ...options.options?.xAxis,
          axisLabel: {
            ...options.options?.xAxis?.axisLabel,
            show: false // Hide x-axis labels in preview mode
          }
        }
      };
    }
    
    return options;
  }, [props, theme, isPreview, id, customProps, component, customConfig]);
  
  // Add error boundary to prevent entire app from crashing on chart errors
  try {
    // For BaseChart with direct option
    if (component === BaseChart) {
      return <BaseChart {...chartOptions} />;
    }
    
    // For other chart types that expect data
    if (sampleData) {
      return React.createElement(component, {
        data: sampleData,
        ...chartOptions
      });
    }
    
    // For charts with no sample data
    return React.createElement(component, chartOptions);
  } catch (error) {
    console.error("Error rendering chart:", error);
    return (
      <div className="flex items-center justify-center h-full bg-red-50 dark:bg-red-900/30 p-4 rounded-md">
        <div className="text-center text-red-600 dark:text-red-300">
          <p className="font-semibold">Chart rendering error</p>
          <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }
}; 