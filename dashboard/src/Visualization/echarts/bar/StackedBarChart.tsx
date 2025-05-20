import React, { useMemo } from 'react';
import BarChart, { EnhancedBarChartProps } from './BarChart';

/**
 * Enhanced props for Stacked Bar Chart with additional stacked-specific features
 */
export interface StackedBarChartProps extends EnhancedBarChartProps {
  // Stack-specific options
  showStackTotal?: boolean;
  stackTotalPosition?: 'top' | 'inside';
  stackTotalFormatter?: (value: number) => string;
  stackTotalFontSize?: number;
  stackTotalColor?: string;
  stackTotalOffset?: number;
  
  // Stack labels for showing values within each segment
  showStackLabels?: boolean;
  stackLabelPosition?: 'inside' | 'center';
  stackLabelFormatter?: (value: number, dataIndex: number, seriesIndex: number) => string;
  
  // Percentage mode shows each stack as % of total
  percentageMode?: boolean;
}

/**
 * Stacked Bar Chart Component using ECharts
 * 
 * This component is a specialized variant of BarChart with stacking enabled by default
 * and additional features specific to stacked charts.
 */
const StackedBarChart: React.FC<StackedBarChartProps> = (props) => {
  const {
    // Stack-specific options with defaults
    showStackTotal = false,
    stackTotalPosition = 'top',
    stackTotalFormatter = (value: number) => value.toString(),
    stackTotalFontSize = 12,
    stackTotalColor = '#333',
    stackTotalOffset = 10,
    showStackLabels = false,
    stackLabelPosition = 'inside',
    stackLabelFormatter,
    percentageMode = false,
    
    // Base data and series configuration
    data = [],
    series = [],
    yKey = 'value',
    
    // Override some BarChart defaults for a better stacked experience
    valuePosition = 'inside',
    showValues = showStackLabels, // Link showValues to showStackLabels by default
    
    // Pass all other props to BarChart
    ...restProps
  } = props;

  // Calculate stack totals if needed
  const { enhancedData, enhancedSeries } = useMemo(() => {
    // If we don't need stack totals, return original data and series
    if (!showStackTotal && !percentageMode) {
      return { 
        enhancedData: data,
        enhancedSeries: series 
      };
    }

    // Get series data keys from the series config
    const seriesKeys = series.length > 0 
      ? series.map(s => s.dataKey || yKey)
      : [yKey];

    // Calculate stack totals for each data point
    const totals = data.map(item => {
      const values = seriesKeys.map(key => parseFloat(item[key] || 0));
      const total = values.reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0);
      return total;
    });

    // Handle percentage mode: convert all values to percentages of stack total
    let processedData = [...data];
    
    if (percentageMode) {
      // Transform data into percentage format
      processedData = data.map((item, dataIndex) => {
        const total = totals[dataIndex];
        if (total === 0) return { ...item }; // Avoid division by zero
        
        // Convert each value to percentage
        const itemWithPercentages = { ...item };
        seriesKeys.forEach(key => {
          const originalValue = parseFloat(item[key] || 0);
          itemWithPercentages[key] = (originalValue / total) * 100;
        });
        
        return itemWithPercentages;
      });
    }

    // Create an additional series for stack totals if needed
    let updatedSeries = [...series];
    
    if (showStackTotal) {
      // Add a special line series for stack totals
      updatedSeries.push({
        name: 'Stack Total',
        type: 'line',
        data: totals,
        symbol: 'none',
        symbolSize: 0,
        lineStyle: { width: 0, type: 'solid', color: 'rgba(0,0,0,0)' },
        label: {
          show: true,
          position: stackTotalPosition === 'inside' ? 'insideTop' : [0, -stackTotalOffset],
          formatter: (params: any) => {
            try {
              return stackTotalFormatter(params.value);
            } catch (error) {
              return params.value;
            }
          },
          fontSize: stackTotalFontSize,
          color: stackTotalColor,
          fontWeight: 'bold'
        },
        z: 10,
        stack: '' // Ensure totals don't get stacked with bars
      });
    }

    return { 
      enhancedData: processedData,
      enhancedSeries: updatedSeries 
    };
  }, [
    data, 
    series, 
    yKey, 
    showStackTotal, 
    percentageMode, 
    stackTotalPosition, 
    stackTotalFormatter,
    stackTotalFontSize,
    stackTotalColor,
    stackTotalOffset
  ]);

  // Create enhanced options object with stack-specific settings
  const enhancedOptions = useMemo(() => {
    const options = props.options || {};
    
    return {
      ...options,
      
      // Add stack total label configuration if enabled
      series: Array.isArray(options.series) ? options.series.map((series: any) => ({
        ...series,
        // Add label configuration if stack labels are enabled
        label: showStackLabels ? {
          show: true,
          position: stackLabelPosition,
          formatter: stackLabelFormatter,
          ...series?.label
        } : series?.label
      })) : undefined,
      
      // Add config for showing percentage mode if enabled
      yAxis: percentageMode ? {
        ...(options.yAxis || {}),
        axisLabel: {
          ...(options.yAxis?.axisLabel || {}),
          formatter: '{value}%'
        },
        max: 100
      } : options.yAxis
    };
  }, [
    props.options, 
    showStackLabels,
    stackLabelPosition,
    stackLabelFormatter,
    percentageMode
  ]);

  return (
    <BarChart
      {...restProps}
      data={enhancedData}
      series={enhancedSeries}
      stack={true}
      options={enhancedOptions}
      valuePosition={valuePosition}
      showValues={showValues}
    />
  );
};

export default StackedBarChart; 