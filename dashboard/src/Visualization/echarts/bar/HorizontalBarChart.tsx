import React, { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { EnhancedBarChartProps } from './BarChart';

/**
 * Extended labels interface that includes series name
 */
interface HorizontalBarChartLabels {
  title?: string;
  subtitle?: string;
  xAxis?: string;
  yAxis?: string;
  series?: string;
}

/**
 * Props for Horizontal Bar Chart
 */
export interface HorizontalBarChartProps extends Omit<EnhancedBarChartProps, 'stack' | 'labels'> {
  // Horizontal specific options
  barColor?: string;
  highlightedBarColor?: string;
  highlightedIndices?: number[];
  barWidth?: number | string;
  valueFormatter?: (value: number) => string;
  showValues?: boolean;
  valueFontSize?: number;
  valueFontWeight?: string | number;
  valueDistance?: number;
  showBorder?: boolean;
  borderColor?: string;
  borderWidth?: number;
  barGap?: string | number; 
  barCategoryGap?: string | number;
  showYAxisLabel?: boolean;
  
  // Extended labels
  labels?: HorizontalBarChartLabels;
}

/**
 * Horizontal Bar Chart Component
 * 
 * A specialized bar chart that renders bars horizontally from left to right
 * with customizable formatting and value display.
 */
const HorizontalBarChart: React.FC<HorizontalBarChartProps> = (props) => {
  const {
    // Data and keys
    data = [],
    xKey = 'category',
    yKey = 'value',
    
    // Appearance options
    width,
    height,
    className,
    theme = 'light',
    
    // Bar specific options
    barColor = theme === 'dark' ? '#626681' : '#5470c6',
    highlightedBarColor = theme === 'dark' ? '#5470c6' : '#5470c6',
    highlightedIndices = [],
    barWidth = 25,
    valueFormatter = (value: number) => value.toFixed(1) + 'M',
    showValues = true,
    valueFontSize = 12,
    valueFontWeight = 'normal',
    valueDistance = 5,
    showBorder = false,
    borderColor = '#000',
    borderWidth = 0,
    barGap = '10%',
    barCategoryGap = '20%',
    showYAxisLabel = true,
    
    // General options
    options = {},
    labels,
    onEvents,
    loading,
    
    // Other props to pass through
    ...restProps
  } = props;

  // Generate chart options based on props
  const chartOption = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        title: labels?.title ? {
          text: labels.title,
          left: 'center'
        } : undefined,
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          }
        },
        xAxis: {
          type: 'value',
        },
        yAxis: {
          type: 'category',
          data: []
        },
        series: []
      };
    }

    // Extract categories from data for y-axis
    const categories = data.map(item => item[xKey] || 'Unknown');
    
    // Extract values for the bars
    const values = data.map(item => parseFloat(item[yKey] || 0));
    
    // Custom colors based on highlighted indices
    const barColors = values.map((_, index) => 
      highlightedIndices.includes(index) ? highlightedBarColor : barColor
    );
    
    // Format value labels
    const formattedLabels = values.map(value => {
      try {
        return valueFormatter(value);
      } catch (error) {
        return value.toString();
      }
    });
    
    return {
      title: labels?.title ? {
        text: labels.title,
        left: 'center'
      } : undefined,
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          const category = param.name;
          const value = param.value;
          let formatted;
          
          try {
            formatted = valueFormatter(value);
          } catch (error) {
            formatted = value;
          }
          
          return `${category}: ${formatted}`;
        },
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        top: 40,
        right: 70, // Extra space for value labels at the end
        bottom: 20,
        left: 120, // Extra space for category (location) names
        ...(options.grid || {})
      },
      legend: {
        show: !!labels?.series,
        data: labels?.series ? [labels.series] : [],
        left: 10,
        top: 10,
        textStyle: {
          color: theme === 'dark' ? '#ffffff' : '#333',
          fontWeight: 'normal',
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
          textShadowColor: 'transparent',
          textShadowBlur: 0,
          textBorderColor: 'transparent',
          textBorderWidth: 0
        }
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => {
            // Format axis labels
            return value.toString();
          },
          fontSize: 11,
          color: theme === 'dark' ? '#aaa' : '#666',
          ...(options.xAxis?.axisLabel || {})
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#555' : '#ccc'
          }
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? '#333' : '#eee'
          }
        },
        ...(options.xAxis || {})
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          show: showYAxisLabel,
          fontSize: 12,
          color: theme === 'dark' ? '#ddd' : '#333',
          padding: [0, 15, 0, 0], // Add right padding to prevent truncation
          ...(options.yAxis?.axisLabel || {})
        },
        axisTick: {
          alignWithLabel: true
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#555' : '#ccc'
          }
        },
        ...(options.yAxis || {})
      },
      series: [
        {
          name: labels?.series ? labels.series : 'Value',
          type: 'bar',
          data: values,
          itemStyle: {
            color: (params: any) => barColors[params.dataIndex],
            borderColor: showBorder ? borderColor : 'transparent',
            borderWidth: borderWidth
          },
          barWidth: barWidth,
          barGap: barGap,
          barCategoryGap: barCategoryGap,
          label: {
            show: showValues,
            position: 'right',
            distance: valueDistance,
            formatter: (params: any) => formattedLabels[params.dataIndex],
            fontSize: valueFontSize,
            fontWeight: valueFontWeight,
            color: theme === 'dark' ? '#ffffff' : '#333333',
            textBorderColor: 'transparent',
            textBorderWidth: 0,
            textShadowColor: 'transparent',
            textShadowBlur: 0
          },
          emphasis: {
            focus: 'self',
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ],
      textStyle: {
        fontFamily: 'Arial, sans-serif',
        color: theme === 'dark' ? '#ffffff' : '#333333',
        fontWeight: 'normal',
        fontSize: 12,
        textShadowColor: 'transparent',
        textShadowBlur: 0,
        textBorderColor: 'transparent',
        textBorderWidth: 0
      },
      // Additional options from props
      ...(options.extra || {})
    };
  }, [
    data,
    xKey,
    yKey,
    theme,
    barColor,
    highlightedBarColor,
    highlightedIndices,
    barWidth,
    valueFormatter,
    showValues,
    valueFontSize,
    valueFontWeight,
    valueDistance,
    showBorder,
    borderColor,
    borderWidth,
    barGap, 
    barCategoryGap,
    showYAxisLabel,
    options,
    labels
  ]);

  return (
    <BaseChart
      option={chartOption}
      theme={theme}
      style={{ width, height }}
      className={className}
      loading={loading}
      onEvents={onEvents}
      {...restProps}
    />
  );
};

export default HorizontalBarChart; 