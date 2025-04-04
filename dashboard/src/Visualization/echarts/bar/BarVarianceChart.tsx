import React, { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { EnhancedBarChartProps } from './BarChart';

/**
 * Props for Bar Variance Chart
 */
export interface BarVarianceChartProps extends Omit<EnhancedBarChartProps, 'stack'> {
  // Variance display options
  positiveColor?: string;
  negativeColor?: string;
  barWidth?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  labelPosition?: 'top' | 'inside';
  labelOffset?: number;
  labelFontSize?: number;
  labelFontWeight?: string | number;
  showLabel?: boolean;
  labelColor?: string;
  labelStroke?: string;
  labelStrokeWidth?: number;
}

/**
 * Bar Variance Chart Component
 * 
 * A specialized bar chart that visualizes positive and negative variances
 * with appropriate coloring and formatting for dollar/value figures.
 */
const BarVarianceChart: React.FC<BarVarianceChartProps> = (props) => {
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
    
    // Variance specific options
    positiveColor = theme === 'dark' ? '#7cffb2' : '#91cc75',
    negativeColor = theme === 'dark' ? '#ff6e76' : '#ee6666',
    barWidth = 30,
    valuePrefix = '',
    valueSuffix = 'M',
    labelPosition = 'top',
    labelOffset = 10,
    labelFontSize = 12,
    labelFontWeight = 'bold',
    showLabel = true,
    labelColor = theme === 'dark' ? '#ffffff' : '#333333',
    labelStroke = theme === 'dark' ? 'transparent' : '#ffffff',
    labelStrokeWidth = theme === 'dark' ? 0 : 2,
    
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
          type: 'category',
          data: []
        },
        yAxis: {
          type: 'value'
        },
        series: []
      };
    }

    // Extract categories from data for x-axis
    const categories = data.map(item => item[xKey] || 'Unknown');
    
    // Extract values and determine positive/negative status
    const values = data.map(item => parseFloat(item[yKey] || 0));
    const isPositive = values.map(value => value >= 0);
    
    // Format value labels
    const formattedLabels = values.map(value => {
      const prefix = value >= 0 ? '+' : '';
      return `${prefix}${valuePrefix}${Math.abs(value).toFixed(1)}${valueSuffix}`;
    });
    
    // Create two series - one for positive values, one for negative
    // This allows us to color them differently
    const positiveValues = values.map((value, index) => isPositive[index] ? value : null);
    const negativeValues = values.map((value, index) => !isPositive[index] ? value : null);
    
    return {
      title: labels?.title ? {
        text: labels.title,
        left: 'center'
      } : undefined,
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          // Only show non-null series data in tooltip
          const validParams = params.filter((param: any) => param.value !== null);
          if (validParams.length === 0) return '';
          
          const param = validParams[0];
          const category = param.name;
          const index = param.dataIndex;
          const value = values[index];
          const sign = value >= 0 ? '+' : '';
          
          return `${category}: ${sign}${valuePrefix}${Math.abs(value).toFixed(1)}${valueSuffix}`;
        },
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        top: 40,
        right: 20,
        bottom: 40,
        left: 40,
        ...(options.grid || {})
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: categories.length > 12 ? 30 : 0,
          fontSize: 12,
          ...(options.xAxis?.axisLabel || {})
        },
        axisTick: {
          alignWithLabel: true
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#555' : '#ccc'
          }
        },
        ...(options.xAxis || {})
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: `{value}${valueSuffix}`
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? '#333' : '#eee'
          }
        },
        ...(options.yAxis || {})
      },
      series: [
        {
          name: 'Positive Variance',
          type: 'bar',
          stack: 'variance',
          data: positiveValues,
          itemStyle: {
            color: positiveColor
          },
          barWidth: barWidth,
          label: {
            show: showLabel,
            position: labelPosition,
            distance: labelOffset,
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            formatter: (params: any) => {
              const index = params.dataIndex;
              return isPositive[index] ? formattedLabels[index] : '';
            },
            color: theme === 'dark' ? '#ffffff' : '#333333',
            textBorderColor: 'transparent',
            textBorderWidth: 0,
            textShadowColor: 'transparent',
            textShadowBlur: 0
          },
          emphasis: {
            focus: 'series'
          }
        },
        {
          name: 'Negative Variance',
          type: 'bar',
          stack: 'variance',
          data: negativeValues,
          itemStyle: {
            color: negativeColor
          },
          barWidth: barWidth,
          label: {
            show: showLabel,
            position: labelPosition,
            distance: labelOffset,
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            formatter: (params: any) => {
              const index = params.dataIndex;
              return !isPositive[index] ? formattedLabels[index] : '';
            },
            color: theme === 'dark' ? '#ffffff' : '#333333',
            textBorderColor: 'transparent',
            textBorderWidth: 0,
            textShadowColor: 'transparent',
            textShadowBlur: 0
          },
          emphasis: {
            focus: 'series'
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
    positiveColor,
    negativeColor,
    barWidth,
    valuePrefix,
    valueSuffix,
    labelPosition,
    labelOffset,
    labelFontSize,
    labelFontWeight,
    showLabel,
    labelColor,
    labelStroke,
    labelStrokeWidth,
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

export default BarVarianceChart; 