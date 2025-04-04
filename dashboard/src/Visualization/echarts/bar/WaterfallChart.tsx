import React, { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { XYChartProps } from '../types';
import {
  DEFAULT_TOOLTIP,
  createAxis
} from '../constants';
import { createTooltip, createTitle } from '../../../services/echartsService';

export interface WaterfallChartProps extends XYChartProps {
  positiveColor?: string;
  negativeColor?: string;
  markerColor?: string;
  baselineLabel?: string;
  showConnectingLine?: boolean;
  lineWidth?: number;
  markerSize?: number;
  percentFormat?: boolean;
  showLabels?: boolean;
  fontSize?: number;
  labelColor?: string;
  xAxisColor?: string;
  xAxisWidth?: number;
  showValueLabels?: boolean;
  minLineHeight?: number;
  useLogScale?: boolean;
  theme?: 'light' | 'dark';
}

// Helper type for ECharts renderItem
interface CustomSeriesRenderItemParams {
  coordSys: { x: number; y: number; width: number; height: number };
  seriesIndex: number;
  seriesName: string;
  dataIndex: number;
  dataIndexInside: number;
  dataInsideIndex: number;
  value: any;
}

interface CustomSeriesRenderItemAPI {
  value: (dimension?: number | string) => number;
  coord: (point: [number, number]) => [number, number];
  size: (dimension?: number | string) => number;
  style: (userProps: any) => any;
}

/**
 * Waterfall Chart Component using ECharts
 * Displays a variance chart with positive and negative changes
 */
const WaterfallChart: React.FC<WaterfallChartProps> = (props) => {
  const {
    data,
    xKey = 'category',
    yKey = 'value',
    width,
    height,
    className,
    labels,
    options = {},
    theme = 'light',
    onEvents,
    loading,
    positiveColor,
    negativeColor,
    markerColor,
    baselineLabel = 'ΔPY%',
    showConnectingLine = true,
    lineWidth = 4,
    markerSize = 5,
    percentFormat = true,
    showLabels = true,
    fontSize = 11,
    labelColor,
    xAxisColor,
    xAxisWidth = 1,
    showValueLabels = true,
    minLineHeight = 20,
    useLogScale = false
  } = props;

  // Generate chart options based on props
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
    
    // Apply custom colors or defaults
    const posColor = positiveColor || '#7cffb2'; // Green
    const negColor = negativeColor || '#ff6e76'; // Red
    const circleColor = markerColor || (theme === 'dark' ? '#fff' : '#000'); // Black or white dots
    const textColor = labelColor || (theme === 'dark' ? '#ddd' : '#333'); // Black or white text
    const axisColor = xAxisColor || (theme === 'dark' ? '#666' : '#888'); // Gray axis
    
    // Parse values from data
    const values = data.map(item => parseFloat(item[yKey] || 0));
    
    // Find y-axis range for better spacing
    const yMax = Math.max(...values.map(v => Math.abs(v))) * 1.2;
    
    // Scale factor for log scale if enabled
    const useScaledValues = useLogScale || values.some(v => Math.abs(v) < 10);
    
    // Function to scale values for better visibility
    const scaleValue = (value: number) => {
      if (!useScaledValues) return value;
      
      // Sign preservation with log-like scaling for small values
      const sign = Math.sign(value);
      const absValue = Math.abs(value);
      
      // Log-like scaling with preservation of relative sizes
      // Use logarithmic scale with base 10 plus a small offset to handle near-zero values
      return sign * (Math.log10(absValue + 1) * 20);
    };
    
    // Create scaled values for visualization
    const scaledValues = values.map(scaleValue);
    const scaledYMax = useScaledValues ? Math.max(...scaledValues.map(v => Math.abs(v))) * 1.2 : yMax;
    
    // Add the x-axis line (zero line) if enabled
    const xAxisLine = showConnectingLine ? {
      name: 'Baseline',
      type: 'line',
      symbol: 'none',
      lineStyle: {
        color: axisColor,
        type: 'solid',
        width: xAxisWidth
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: {
          color: axisColor,
          type: 'solid',
          width: xAxisWidth
        },
        data: [{ yAxis: 0 }]
      }
    } : null;
    
    // Create individual series for each data point
    const allSeries: any[] = [];
    
    // Add the baseline
    if (xAxisLine) {
      allSeries.push(xAxisLine);
    }
    
    // For each data point, create a custom line + circle
    values.forEach((value, index) => {
      // Skip if the value is 0
      if (value === 0) return;
      
      const isPositive = value >= 0;
      const color = isPositive ? posColor : negColor;
      
      // Format the percentage value
      const formattedValue = percentFormat 
        ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
        : `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
        
      // Create vertical line with circle
      allSeries.push({
        name: `point-${index}`,
        type: 'custom',
        renderItem: (_params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
          const xValue = api.value(0);
          const yValue = api.value(1);
          const start = api.coord([xValue, 0]);
          const end = api.coord([xValue, yValue]);
          
          // Apply minimum line height for very small values
          const minHeight = minLineHeight; // Minimum pixel height for visibility
          const actualHeight = Math.abs(end[1] - start[1]);
          
          // If the line is too short, extend it
          if (actualHeight < minHeight && value !== 0) {
            const direction = isPositive ? -1 : 1; // Up for positive, down for negative
            end[1] = start[1] + (direction * minHeight);
          }
          
          // Calculate label position (above/below the marker)
          const labelY = isPositive 
            ? end[1] - markerSize - 15 // Above for positive values
            : end[1] + markerSize + 15; // Below for negative values
            
          // Build the elements array with proper typing
          const elements = [];
          
          // Create the elements with explicit zlevel to ensure proper layering
          // First the circle with lowest zlevel
          elements.push({
            type: 'circle',
            shape: { cx: end[0], cy: end[1], r: markerSize },
            style: { fill: circleColor },
            silent: true,
            zlevel: 0 // Ensures dots are always rendered at the bottom layer
          });
          
          // Then the line with higher zlevel
          elements.push({
            type: 'line',
            shape: { x1: start[0], y1: start[1], x2: end[0], y2: end[1] },
            style: { stroke: color, lineWidth: lineWidth },
            silent: true,
            zlevel: 1 // Ensures lines are always rendered above dots
          });
          
          // Add value label as text element with highest zlevel
          if (showValueLabels) {
            elements.push({
              type: 'text',
              style: {
                text: formattedValue,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fontWeight: 'bold',
                fontSize: fontSize,
                fill: color,
                x: end[0],
                y: isPositive ? labelY - 5 : labelY + 5
              },
              silent: true,
              zlevel: 2 // Ensures labels are always at the top
            });
          }
          
          // Return all elements as a group
          return {
            type: 'group',
            children: elements,
            silent: false, // Make the entire group interactive for tooltips
            zlevel: 1 // Set group zlevel to ensure proper rendering order
          };
        },
        
        // Simplify the label configuration - rely on our custom text rendering
        label: { show: false },
        
        // Keep tooltip for additional information on hover
        tooltip: {
          show: true,
          formatter: (_params: any) => {
            return `${categories[index]}: ${formattedValue}`;
          }
        },
        data: [[index, useScaledValues ? scaleValue(value) : value]]
      });
    });
    
    // Complete chart options
    return {
      backgroundColor: 'transparent',
      title: labels?.title ? createTitle(labels.title) : undefined,
      tooltip: createTooltip({
        ...DEFAULT_TOOLTIP,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        theme,
        textStyle: {
          fontSize: fontSize
        },
        formatter: (_params: any) => {
          if (Array.isArray(_params) && _params[0] && _params[0].dataIndex !== undefined) {
            const index = _params[0].dataIndex;
            const value = index < values.length ? values[index] : 0;
            
            return `${categories[index]}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}${percentFormat ? '%' : ''}`;
          }
          return '';
        }
      }),
      legend: {
        show: false
      },
      grid: {
        top: '25%',
        bottom: '18%',
        left: '10%',
        right: '10%',
        ...options.grid
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: true,
        axisLine: {
          lineStyle: {
            color: axisColor,
            width: xAxisWidth
          }
        },
        axisTick: {
          show: false // No tick marks
        },
        axisLabel: {
          fontSize: fontSize,
          color: textColor,
          interval: 0,
          rotate: options.xAxis?.axisLabel?.rotate || 0
        },
        ...createAxis(labels?.xAxis || '', options.xAxis)
      },
      yAxis: {
        type: 'value',
        min: useScaledValues ? -scaledYMax : -yMax,
        max: useScaledValues ? scaledYMax : yMax,
        splitLine: {
          show: false // No horizontal grid lines
        },
        axisLine: {
          show: false // No y-axis line
        },
        axisTick: {
          show: false // No tick marks
        },
        axisLabel: {
          show: false // Hide y-axis labels for minimalist look
        },
        ...createAxis(labels?.yAxis || baselineLabel, options.yAxis)
      },
      series: allSeries,
      ...options.extra
    };
  }, [
    data, xKey, yKey, labels, options, theme, 
    positiveColor, negativeColor, markerColor,
    baselineLabel, showConnectingLine, lineWidth, markerSize,
    percentFormat, showLabels, fontSize, labelColor,
    xAxisColor, xAxisWidth, showValueLabels, minLineHeight, useLogScale
  ]);

  // Create style for the chart container
  const style = useMemo(() => ({
    width: width || '100%',
    height: height || '400px',
  }), [width, height]);

  return (
    <BaseChart
      option={chartOption}
      style={style}
      className={className}
      theme={theme}
      onEvents={onEvents}
      loading={loading}
    />
  );
};

export default WaterfallChart; 