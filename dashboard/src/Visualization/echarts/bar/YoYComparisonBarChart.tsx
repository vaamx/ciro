import * as React from 'react';
import { useMemo } from 'react';
import { EnhancedBarChartProps } from './BarChart';
import BaseChart from '../BaseChart';
import { createTooltip, createTitle } from '../../../services/echartsService';
import { DEFAULT_TOOLTIP } from '../constants';

/**
 * Props for Year-over-Year Comparison Bar Chart
 */
export interface YoYComparisonBarChartProps extends Omit<EnhancedBarChartProps, 'stack'> {
  // YoY specific options
  negativeVarianceColor?: string;
  positiveVarianceColor?: string;
  barColor?: string;
  previousYearBarColor?: string;
  showAllPercentages?: boolean;
  percentageFontSize?: number;
  percentageFontWeight?: string | number;
  negativeOnly?: boolean;
  // View type to adjust sizing
  viewType?: 'gallery' | 'sidebar' | 'modal';
}

/**
 * Year-over-Year Comparison Bar Chart Component
 * 
 * A specialized bar chart that visualizes current vs previous year data
 * with percentage variance indicators and styling optimized for YoY comparisons.
 */
const YoYComparisonBarChart: React.FC<YoYComparisonBarChartProps> = (props) => {
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
    
    // YoY specific options
    negativeVarianceColor = '#e74c3c', // Red for negative variance
    positiveVarianceColor = '#3ab45b', // Green for positive variance
    barColor = '#444444',
    negativeOnly = false, // Only show negative percentages (for cases where all variances are negative)
    
    // Required for YoY comparison
    previousYearData = [],
    previousYearKey = 'value',
    changePercentages = [],
    
    // Set good defaults for YoY comparison
    acpyLabels = true,
    
    // View type for responsive sizing
    viewType = 'modal',
    
    // General options
    options = {},
    labels,
    onEvents,
    loading,
  } = props;
  
  // Generate chart option with YoY comparison specific configuration
  const chartOption = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        title: labels?.title ? createTitle(labels.title) : undefined,
        tooltip: createTooltip(DEFAULT_TOOLTIP),
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
    
    // Responsive sizing based on the view type
    let gridLeft = 60;
    let axisLabelFontSize = 11;
    let barLabelFontSize = 10;
    let indicatorLabelFontSize = 11; 
    let showLegend = false;
    let titleFontSize = 16;
    let barWidthPercent = "70%";
    let yAxisNameGap = 35;
    let showYAxisName = true;
    let showBarLabels = true;
    
    if (viewType === 'gallery') {
      gridLeft = 40;
      axisLabelFontSize = 9;
      barLabelFontSize = 8;
      indicatorLabelFontSize = 9;
      showLegend = false;
      titleFontSize = 12;
      barWidthPercent = "60%";
      yAxisNameGap = 25;
      showYAxisName = false;
      showBarLabels = true;
    } else if (viewType === 'sidebar') {
      gridLeft = 50;
      axisLabelFontSize = 10;
      barLabelFontSize = 9;
      indicatorLabelFontSize = 10;
      showLegend = true;
      titleFontSize = 14;
      barWidthPercent = "65%";
      yAxisNameGap = 30;
      showYAxisName = true;
      showBarLabels = true;
    }
    
    // Create custom path for indicators based on percentage and direction
    const getCustomPath = (percentValue: number, isNegative: boolean) => {
      // Get absolute percentage value
      const absPercent = Math.abs(percentValue);
      
      // Scale the indicator height based on percentage value
      const maxYoy = changePercentages.length > 0 
        ? Math.max(...changePercentages.map(c => Math.abs(c.value)))
        : 50; // Default if no data available
      
      // Set constraints for indicator sizes
      const minBarHeight = 10;
      const maxBarHeight = 50;
      const triangleHeight = 8;
      const triangleWidth = 16;
      const barWidth = 18; // Width of the rectangle segment
      const gapSize = 6; // Increased gap between bar and indicator
      
      // Scale the bar height based on percentage
      const normalizedPercent = absPercent / maxYoy;
      const barHeight = Math.max(minBarHeight, Math.min(maxBarHeight, minBarHeight + normalizedPercent * (maxBarHeight - minBarHeight)));
      
      // Calculate half-widths for drawing
      const halfBarWidth = barWidth / 2;
      const halfTriangleWidth = triangleWidth / 2;
      
      // Add a vertical offset to position indicators above the bars
      const verticalOffset = 15;
      
      if (isNegative) {
        // For negative values: Flipped indicator with rectangle at bottom and triangle pointing DOWN
        return `path://
          M-${halfBarWidth},${gapSize + verticalOffset} 
          L${halfBarWidth},${gapSize + verticalOffset} 
          L${halfBarWidth},${barHeight + gapSize + verticalOffset} 
          L-${halfBarWidth},${barHeight + gapSize + verticalOffset} 
          L-${halfBarWidth},${gapSize + verticalOffset} 
          M-${halfTriangleWidth},${barHeight + gapSize + verticalOffset} 
          L${halfTriangleWidth},${barHeight + gapSize + verticalOffset} 
          L0,${barHeight + gapSize + triangleHeight + verticalOffset} 
          Z`;
      } else {
        // For positive values: Regular indicator with rectangle at bottom and triangle pointing UP
        return `path://
          M-${halfBarWidth},${gapSize} 
          L${halfBarWidth},${gapSize} 
          L${halfBarWidth},-${barHeight + gapSize} 
          L-${halfBarWidth},-${barHeight + gapSize} 
          L-${halfBarWidth},${gapSize} 
          M-${halfTriangleWidth},-${barHeight + gapSize} 
          L${halfTriangleWidth},-${barHeight + gapSize} 
          L0,-${barHeight + gapSize + triangleHeight} 
          Z`;
      }
    };
    
    // Determine legend entries - only include series that exist
    const legendData = [];
    
    // Add Current Year (AC) only if we have data
    if (data && data.length > 0) {
      legendData.push('Current Year (AC)');
    }
    
    // Only add Previous Year to legend if we have data and are creating the PY series
    if (previousYearData && previousYearData.length > 0) {
      legendData.push('Previous Year (PY)');
    }
    
    return {
      title: labels?.title ? createTitle(labels.title, {
        textStyle: {
          color: '#333333',
          fontWeight: 'bold',
          fontSize: titleFontSize
        },
        top: 10,
        left: 'center'
      }) : undefined,
      tooltip: createTooltip({
        ...DEFAULT_TOOLTIP,
        theme,
        trigger: 'axis',
        formatter: options.tooltipFormatter
      }),
      grid: {
        top: 40, // Reduced top margin since we removed the legend
        right: 30,
        bottom: 20,
        left: gridLeft,
        ...options.grid
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          interval: 0,
          rotate: viewType === 'gallery' && categories.length > 8 ? 45 : 0,
          fontSize: axisLabelFontSize
        },
        splitLine: {
          show: false
        },
        axisLine: {
          show: false
        },
        ...options.xAxis
      },
      yAxis: {
        type: 'value',
        max: function({ max }: { max: number }) {
          return Math.ceil(max * 1.5); // 50% extra space above highest bar
        },
        min: 0,
        interval: 1,
        name: showYAxisName ? 'AC vs PY Comparison' : '',
        nameGap: yAxisNameGap,
        nameLocation: 'middle',
        nameTextStyle: {
          fontSize: axisLabelFontSize + 1,
          fontWeight: 'bold',
        },
        axisLabel: {
          formatter: '{value}K',
          fontSize: axisLabelFontSize
        },
        splitLine: {
          show: false
        },
        axisLine: {
          show: false
        },
        ...options.yAxis
      },
      series: [
        // Current Year (AC) bars
        {
          name: 'Current Year (AC)',
          type: 'bar',
          barWidth: barWidthPercent,
          itemStyle: {
            color: barColor
          },
          emphasis: {
            focus: 'series'
          },
          data: data.map(item => item[yKey]),
          label: {
            show: showBarLabels,
            position: 'inside',
            distance: 0,
            fontSize: barLabelFontSize,
            fontWeight: 'bold',
            formatter: (params: any) => {
              // Only show label if value is above minimum threshold for readability
              if (params.value < 0.5) {
                return '';
              }
              return `${params.value.toFixed(1)}K`;
            },
            color: '#ffffff',
            backgroundColor: 'transparent',
            padding: [0, 0, 0, 0],
            borderRadius: 0
          },
          // YoY percentage indicator with bar + triangle
          markPoint: {
            symbol: (_: any, params: any) => {
              // Get the change value for this data point
              const index = params.dataIndex;
              const change = changePercentages.find(c => c.index === index);
              const isNegative = change ? change.value < 0 : true;
              const percentValue = change ? change.value : 0;
              
              // Use custom path for bar + triangle indicator
              return getCustomPath(percentValue, isNegative);
            },
            symbolSize: (_: any, params: any) => {
              // Size should accommodate both rectangle and triangle
              const index = params.dataIndex;
              const change = changePercentages.find(c => c.index === index);
              const percentValue = change ? change.value : 0;
              
              // Calculate maximum dimensions needed for the combined shape
              const maxYoy = changePercentages.length > 0 
                ? Math.max(...changePercentages.map(c => Math.abs(c.value)))
                : 50;
              
              const minBarHeight = 10;
              const maxBarHeight = 50;
              const triangleHeight = 8;
              const barWidth = 18;
              const gapSize = 6; // Match the gap size above
              
              // Scale bar height based on percentage
              const normalizedPercent = Math.abs(percentValue) / maxYoy;
              const barHeight = Math.max(minBarHeight, Math.min(maxBarHeight, minBarHeight + normalizedPercent * (maxBarHeight - minBarHeight)));
              
              // Total height for both positive and negative is bar + triangle + gap
              const totalHeight = barHeight + triangleHeight + gapSize;
              
              return [barWidth, totalHeight];
            },
            symbolOffset: [0, -30], // Much larger fixed offset to ensure separation
            itemStyle: {
              color: (params: any) => {
                const index = params.dataIndex;
                const change = changePercentages.find(c => c.index === index);
                return change && change.value < 0 ? negativeVarianceColor : positiveVarianceColor;
              },
              borderWidth: 0
            },
            label: {
              show: true,
              position: 'top',
              distance: 2, // Closer to the triangle
              fontSize: indicatorLabelFontSize,
              color: theme === 'dark' ? '#ffffff' : '#333333',
              fontWeight: 'bold',
              backgroundColor: 'transparent',
              padding: [0, 0, 0, 0],
              borderWidth: 0,
              formatter: (params: any) => {
                const index = params.dataIndex;
                const change = changePercentages.find(c => c.index === index);
                
                if (typeof params.data.value === 'string' && params.data.value.includes('%')) {
                  return `${change && change.value < 0 ? '-' : '+'}${params.data.value}`;
                }
                return params.data.value;
              }
            },
            data: categories.map((_, i) => {
              const barValue = data[i][yKey];
              const change = changePercentages.find(c => c.index === i);
              if (change) {
                const percentValue = change.value;
                
                return {
                  name: categories[i],
                  coord: [i, barValue], // Position at the top of the AC bar
                  symbolOffset: [0, -30], // Much larger fixed offset to ensure separation
                  value: `${Math.abs(percentValue).toFixed(1)}%`,
                  itemStyle: {
                    color: percentValue < 0 ? negativeVarianceColor : positiveVarianceColor
                  }
                };
              }
              return null;
            }).filter(Boolean)
          },
          // PY reference lines removed
        },
        // Add "invisible" Previous Year series for legend
        ...(previousYearData && previousYearData.length > 0 ? [{
          name: 'Previous Year (PY)',
          type: 'bar',
          barGap: '-100%', // Overlap with the main bars
          barWidth: 0, // Make it invisible
          stack: 'hidden',
          itemStyle: {
            color: 'rgba(0,0,0,0)' // Transparent
          },
          emphasis: {
            itemStyle: {
              color: 'rgba(0,0,0,0)' // Keep transparent on hover
            }
          },
          data: previousYearData.map(item => item[previousYearKey]),
          z: -1 // Put behind other elements
        }] : [])
      ],
      legend: showLegend ? {
        data: legendData,
        top: 20,
        right: 10,
        itemWidth: 15,
        itemHeight: 10,
        textStyle: {
          fontSize: axisLabelFontSize + 1
        },
        // Add custom icons for the legend items
        icon: 'rect',
        formatter: function(name: string) {
          return name;
        }
      } : undefined
    };
  }, [
    data, 
    xKey, 
    yKey, 
    labels, 
    theme,
    previousYearData,
    previousYearKey,
    changePercentages,
    barColor,
    negativeVarianceColor,
    positiveVarianceColor,
    options,
    acpyLabels,
    negativeOnly,
    viewType
  ]);
  
  // Extract only the props needed for BaseChart
  const baseChartProps = {
    option: chartOption,
    className,
    theme,
    loading,
    onEvents,
    style: {
      width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : '100%',
      height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : '400px'
    }
  };
  
  return <BaseChart {...baseChartProps} />;
};

export default YoYComparisonBarChart; 