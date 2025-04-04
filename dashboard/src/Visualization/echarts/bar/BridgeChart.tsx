import React, { useMemo, useState } from 'react';
import BaseChart from '../BaseChart';
import { XYChartProps } from '../types';
import {
  DEFAULT_TOOLTIP,
  createAxis
} from '../constants';
import { createTooltip, createTitle } from '../../../services/echartsService';

export interface BridgeChartProps extends XYChartProps {
  startValueKey?: string;
  endValueKey?: string;
  positiveColor?: string;
  negativeColor?: string;
  startColor?: string;
  endColor?: string;
  markerColor?: string;
  markerSize?: number;
  lineColor?: string;
  connectingLineWidth?: number;
  lineWidth?: number;
  labelColor?: string;
  xAxisColor?: string;
  xAxisWidth?: number;
  showConnectingLine?: boolean;
  barWidth?: number;
  fontSize?: number;
  percentFormat?: boolean;
  valueFormat?: string;
  showLabels?: boolean;
  showValueLabels?: boolean;
  minLineHeight?: number;
  showEndPercentage?: boolean;
  breakAxis?: boolean;
  breakThreshold?: number;
  onChartReady?: (chart: any) => void;
  theme?: 'light' | 'dark'; // Match BaseChart theme type
}

/**
 * Bridge Chart Component using ECharts
 * Displays a financial bridge chart with bars and connecting lines
 */
const BridgeChart: React.FC<BridgeChartProps> = (props) => {
  const {
    data,
    xKey = 'category',
    yKey = 'value',
    startValueKey = 'startValue',
    endValueKey = 'endValue',
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
    startColor,
    endColor,
    lineColor,
    showConnectingLine = true,
    barWidth = 20,
    percentFormat = true,
    valueFormat,
    showLabels = true,
    fontSize = 16,
    labelColor,
    xAxisColor,
    xAxisWidth = 1,
    showValueLabels = true,
    showEndPercentage = true,
    markerSize = 4,
    markerColor,
    lineWidth = 1,
    connectingLineWidth = 1,
    breakAxis = true,
    breakThreshold = 25
  } = props;

  // Add state for tracking if axis is broken - initialize to true to always show broken axis
  const [isAxisBroken, setIsAxisBroken] = useState(true);

  // Toggle function for axis break
  const toggleAxisBreak = () => {
    setIsAxisBroken(!isAxisBroken);
    // Call any custom event handler if provided
    if (onEvents && onEvents.breakAxis) {
      onEvents.breakAxis(!isAxisBroken);
    }
  };

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
    const posColor = positiveColor || '#91cc75'; // Green
    const negColor = negativeColor || '#ee6666'; // Red
    const dotColor = markerColor || (theme === 'dark' ? '#fff' : '#000'); // Black or white dots
    const textColor = labelColor || (theme === 'dark' ? '#ddd' : '#333'); // Black or white text
    const axisColor = xAxisColor || (theme === 'dark' ? '#666' : '#888'); // Gray axis
    const startBarColor = startColor || '#333'; // Dark gray for start bar
    const endBarColor = endColor || '#333'; // Dark gray for end bar
    const connLineColor = lineColor || (theme === 'dark' ? '#666' : '#888'); // Line color
    
    // Find start and end values
    const startValue = data[0]?.[startValueKey] || 0;
    const endValue = data[data.length - 1]?.[endValueKey] || 0;
    const percentChange = ((endValue - startValue) / startValue) * 100;
    
    // Determine if we should break the axis based on value difference
    const valueDifference = Math.abs(endValue - startValue);
    const maxValue = Math.max(startValue, endValue);
    const shouldBreakAxis = breakAxis && (valueDifference / maxValue > breakThreshold / 100);

    // Create graphic elements for axis break indicators positioned at PY and AC columns
    const graphicElements = shouldBreakAxis ? [
      {
        name: 'break-indicator-left', // Name for click detection
        // Left column (PY) break indicators
        type: 'group',
        top: '60%',    // Position from top
        left: '7%',    // Position from left 
        z: 500,        // Very high z-index to ensure visibility
        children: [
          // Background rectangle for break visualization
          {
            type: 'rect',
            shape: {
              x: -20,
              y: -15,
              width: 40,
              height: 30,
              r: 0
            },
            style: {
              fill: theme === 'dark' ? '#333' : '#fff',
              stroke: theme === 'dark' ? '#000' : '#000',
              lineWidth: 3
            }
          },
          // First break line - diagonal when broken, horizontal when not
          {
            type: 'line',
            shape: {
              x1: -15,
              y1: isAxisBroken ? -10 : -5,
              x2: 15,
              y2: isAxisBroken ? 5 : -5
            },
            style: {
              stroke: theme === 'dark' ? '#fff' : '#000',
              lineWidth: 3
            }
          },
          // Second break line - diagonal when broken, horizontal when not
          {
            type: 'line',
            shape: {
              x1: -15,
              y1: isAxisBroken ? 10 : 5,
              x2: 15,
              y2: isAxisBroken ? -5 : 5
            },
            style: {
              stroke: theme === 'dark' ? '#fff' : '#000',
              lineWidth: 3
            }
          },
          // Invisible larger clickable area
          {
            type: 'rect',
            shape: {
              x: -25,
              y: -20,
              width: 50,
              height: 40
            },
            style: {
              fill: 'rgba(0, 0, 0, 0)',  // Transparent
              cursor: 'pointer'
            }
          }
        ]
      },
      {
        name: 'break-indicator-right', // Name for click detection
        // Right column (AC) break indicators
        type: 'group',
        top: '60%',    // Position from top
        right: '7%',   // Position from right
        z: 500,        // Very high z-index to ensure visibility
        children: [
          // Background rectangle for break visualization
          {
            type: 'rect',
            shape: {
              x: -20,
              y: -15,
              width: 40,
              height: 30,
              r: 0
            },
            style: {
              fill: theme === 'dark' ? '#333' : '#fff',
              stroke: theme === 'dark' ? '#000' : '#000',
              lineWidth: 3
            }
          },
          // First break line - diagonal when broken, horizontal when not
          {
            type: 'line',
            shape: {
              x1: -15,
              y1: isAxisBroken ? -10 : -5,
              x2: 15,
              y2: isAxisBroken ? 5 : -5
            },
            style: {
              stroke: theme === 'dark' ? '#fff' : '#000',
              lineWidth: 3
            }
          },
          // Second break line - diagonal when broken, horizontal when not
          {
            type: 'line',
            shape: {
              x1: -15,
              y1: isAxisBroken ? 10 : 5,
              x2: 15,
              y2: isAxisBroken ? -5 : 5
            },
            style: {
              stroke: theme === 'dark' ? '#fff' : '#000',
              lineWidth: 3
            }
          },
          // Invisible larger clickable area
          {
            type: 'rect',
            shape: {
              x: -25,
              y: -20,
              width: 50,
              height: 40
            },
            style: {
              fill: 'rgba(0, 0, 0, 0)',  // Transparent
              cursor: 'pointer'
            }
          }
        ]
      }
    ] : [];
    
    // Calculate all the cumulative values for proper waterfall/bridge effect
    const values: number[] = [];
    const cumulative: number[] = [];
    
    // Start value
    values.push(startValue);
    cumulative.push(startValue);
    
    // Get sum of all intermediate values to check if adjustment is needed
    const intermediateValues = data.slice(1, data.length - 1).map(item => parseFloat(item[yKey] || 0));
    const intermediateSum = intermediateValues.reduce((sum, val) => sum + val, 0);
    
    // If the intermediate values don't precisely bridge start to end, we'll need to adjust
    // This ensures the chart visually bridges from start to end value correctly
    const targetDifference = endValue - startValue;
    const adjustmentNeeded = targetDifference - intermediateSum;
    
    // Flag to determine if we need to apply proportional adjustment
    const needsProportionalAdjustment = Math.abs(adjustmentNeeded) > 0.01;
    
    // Calculate adjustment factor if needed (will be 1.0 if no adjustment needed)
    // This will scale all intermediate values proportionally to reach the end value exactly
    const adjustmentFactor = needsProportionalAdjustment && intermediateSum !== 0 ? 
                            targetDifference / intermediateSum : 1.0;
    
    // Intermediate values - with potential adjustment to ensure proper bridging
    for (let i = 1; i < data.length - 1; i++) {
        let value = parseFloat(data[i][yKey] || 0);
        
        // Apply proportional adjustment if needed
        if (needsProportionalAdjustment) {
            value = value * adjustmentFactor;
        }
        
        values.push(value);
        cumulative.push(cumulative[i-1] + value);
    }
    
    // End value - ensure the last cumulative value exactly matches endValue
    values.push(endValue - cumulative[cumulative.length - 1]);
    cumulative.push(endValue);
    
    // Series array
    const allSeries: any[] = [];
    
    // 1. Add the start bar with a different color
    allSeries.push({
      name: 'Start',
      type: 'bar',
      barWidth: barWidth,
      stack: 'waterfall',
      itemStyle: { color: startBarColor },
      label: {
        show: true,
        position: 'top',
        formatter: valueFormat ? `${startValue.toFixed(1)}${valueFormat}` : `${startValue.toFixed(1)}`,
        color: textColor,
        offset: [0, 0], // No offset for start label
        fontSize: fontSize * 2/3 // Reduce font size by 1/3
      },
      data: [{ value: startValue }, ...Array(categories.length - 1).fill('-')]
    });
    
    // 2. Add the end bar with a different color
    allSeries.push({
      name: 'End',
      type: 'bar',
      barWidth: barWidth,
      stack: 'waterfall',
      itemStyle: { color: endBarColor },
      label: {
        show: true,
        position: 'top',
        formatter: (_params: any) => {
          const baseText = valueFormat ? `${endValue.toFixed(1)}${valueFormat}` : `${endValue.toFixed(1)}`;
          if (showEndPercentage) {
            const percentText = `+${percentChange.toFixed(1)}%`;
            return [baseText, percentText].join('\n');
          }
          return baseText;
        },
        color: textColor,
        offset: [0, 0], // No offset for end label
        fontSize: fontSize * 2/3 // Reduce font size by 1/3
      },
      data: [...Array(categories.length - 1).fill('-'), { value: endValue }]
    });
    
    // 3. Add the invisible "auxiliary" bars for proper stacking
    for (let i = 1; i < data.length - 1; i++) {
      const value = values[i]; // Use adjusted value from our values array
      
      // Always add auxiliary bars for consistent stacking, even for 0 values
      const prevCumulative = cumulative[i-1];
      
      // Calculate invisible auxiliary bar for proper stacking
      allSeries.push({
        name: `Auxiliary-${i}`,
        type: 'bar',
        stack: 'waterfall',
        silent: true,
        z: 1,
        barWidth: barWidth,
        itemStyle: { 
          color: 'rgba(0,0,0,0)',
          borderWidth: 0 
        },
        data: [
          ...Array(i).fill('-'),
          { value: prevCumulative },
          ...Array(categories.length - i - 1).fill('-')
        ]
      });
      
      // Add the actual value bar with proper color (even for 0 values to maintain spacing)
      const isPositive = value >= 0;
      
      // Only show value if it's not zero
      if (Math.abs(value) > 0.01) {
        allSeries.push({
          name: `Value-${i}`,
          type: 'bar',
          stack: 'waterfall',
          barWidth: barWidth,
          z: 2,
          itemStyle: { 
            color: isPositive ? posColor : negColor,
            borderWidth: 0
          },
          emphasis: {
            // Disable focus blur effect on hover
            focus: 'none',
            scale: false
          },
          data: [
            ...Array(i).fill('-'),
            {
              value: Math.abs(value),
              itemStyle: { color: isPositive ? posColor : negColor },
              label: {
                show: showValueLabels,
                position: isPositive ? 'top' : 'bottom',
                distance: isPositive ? 5 : 10,
                formatter: percentFormat 
                  ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
                  : `${value >= 0 ? '+' : ''}${value.toFixed(1)}`,
                fontSize: fontSize * 2/3,
                color: isPositive ? posColor : negColor
              }
            },
            ...Array(categories.length - i - 1).fill('-')
          ]
        });
      }
    }
    
    // 4. Add connecting line at the top if enabled
    if (showConnectingLine) {
      // Base connecting line first (lowest z-index)
      allSeries.push({
        name: 'ConnectingLine',
        type: 'line',
        symbol: 'none',
        smooth: false,
        step: 'middle', // Use middle for better visual alignment
        z: 1, // Lower z-index so it appears behind other elements
        lineStyle: {
          color: connLineColor,
          width: connectingLineWidth
        },
        data: categories.map((_, index) => [index, cumulative[index]])
      });
      
      // Add segmented colored lines to show increases/decreases (middle z-index)
      for (let i = 0; i < categories.length - 1; i++) {
        const from = cumulative[i];
        const to = cumulative[i + 1];
        const isPositive = to >= from;
        
        if (Math.abs(from - to) > 0.01) { // Only add if there's a notable change
          allSeries.push({
            name: `Segment-${i}`,
            type: 'line',
            symbol: 'none',
            smooth: false,
            step: 'middle', // Use middle for better visual alignment
            z: 2, // Higher than base line
            emphasis: {
              // Disable focus blur effect on hover
              focus: 'none',
              scale: false
            },
            lineStyle: {
              color: isPositive ? posColor : negColor,
              width: connectingLineWidth
            },
            data: [[i, from], [i + 1, to]]
          });
        }
      }
      
      // Add markers at each connecting point last (highest z-index)
      allSeries.push({
        name: 'Markers',
        type: 'scatter',
        symbolSize: markerSize * 0.85, // Make markers slightly smaller (reduced by ~15%)
        z: 3, // Highest z-index to appear on top
        emphasis: {
          // Disable focus blur effect on hover
          focus: 'none',
          scale: false
        },
        itemStyle: { color: dotColor },
        // Use data mapper to create individual style for each point
        data: categories.map((_, index) => ({
          value: [index, cumulative[index]],
          itemStyle: { color: dotColor }
        }))
      });
    }
    
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
          fontSize: fontSize * 2/3 // Reduce tooltip font size to match
        },
        formatter: (_params: any) => {
          if (Array.isArray(_params)) {
            const index = _params[0].dataIndex;
            
            if (index === 0) {
              return `Start: ${startValue.toFixed(1)}${valueFormat || ''}`;
            } else if (index === data.length - 1) {
              return `End: ${endValue.toFixed(1)}${valueFormat || ''} (${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%)`;
            } else {
              // Use the adjusted value
              const value = values[index];
              const cumulativeValue = cumulative[index];
              
              // Format the tooltip to show both the original and adjusted values if needed
              let tooltipText = `${categories[index]}: ${cumulativeValue.toFixed(1)}${valueFormat || ''}`;
              tooltipText += `<br/>Change: ${value >= 0 ? '+' : ''}${value.toFixed(1)}${percentFormat ? '%' : ''}`;
              
              // Show original value if adjustment was applied
              if (needsProportionalAdjustment && Math.abs(adjustmentFactor - 1.0) > 0.01) {
                const originalValue = parseFloat(data[index][yKey] || 0);
                tooltipText += `<br/><span style="color:#999;font-size:0.9em;">(Original: ${originalValue.toFixed(1)}${percentFormat ? '%' : ''})</span>`;
              }
              
              return tooltipText;
            }
          }
          return '';
        }
      }),
      legend: {
        show: false
      },
      grid: {
        top: isAxisBroken ? '15%' : '25%',
        bottom: '18%',
        left: '5%',
        right: '5%',
        ...(isAxisBroken ? {
          // When axis is broken, use different layout to better visualize the break
          height: '65%'
        } : {}),
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
          fontSize: fontSize * 2/3,
          color: textColor,
          interval: 0,
          rotate: options.xAxis?.axisLabel?.rotate || 30
        },
        ...createAxis(labels?.xAxis || '', options.xAxis)
      },
      yAxis: {
        type: 'value',
        min: isAxisBroken ? startValue * 0.95 : 0, // Adjust min based on break state
        max: isAxisBroken ? endValue * 1.05 : Math.max(startValue, endValue, ...cumulative) * 1.1,
        splitLine: {
          show: isAxisBroken, // Show gridlines only when axis is broken
          lineStyle: {
            type: 'dashed',
            color: theme === 'dark' ? 'rgba(100, 100, 100, 0.2)' : 'rgba(200, 200, 200, 0.3)'
          }
        },
        axisLine: {
          show: false // No y-axis line
        },
        axisTick: {
          show: false // No tick marks
        },
        axisLabel: {
          show: isAxisBroken, // Show labels only when axis is broken
          color: theme === 'dark' ? '#aaa' : '#666',
          fontSize: fontSize * 2/3,
          formatter: (value: number) => {
            // In broken mode, hide labels in the middle section
            if (isAxisBroken && value > startValue * 1.2 && value < endValue * 0.8) {
              return '';
            }
            return valueFormat ? `${value.toFixed(0)}${valueFormat}` : value.toFixed(0);
          }
        },
        ...(isAxisBroken ? {
          // When axis is broken, additional settings for better visualization
          splitNumber: 4,
          interval: (endValue - startValue) / 4,
          // Use scale to prevent distortion
          scale: true
        } : {}),
        ...createAxis(labels?.yAxis || '', options.yAxis)
      },
      graphic: [...graphicElements],
      series: allSeries
    };
  }, [
    data, xKey, yKey, startValueKey, endValueKey, labels, options, theme, 
    positiveColor, negativeColor, startColor, endColor, lineColor,
    showConnectingLine, barWidth, percentFormat, valueFormat,
    showLabels, fontSize, labelColor, xAxisColor, xAxisWidth, 
    showValueLabels, showEndPercentage, markerSize, markerColor,
    lineWidth, connectingLineWidth, breakAxis, breakThreshold,
    isAxisBroken, onEvents
  ]);

  // Add click handler for axis break toggling
  const handleChartEvents = useMemo(() => ({
    click: (_params: any) => {
      if (onEvents && onEvents.click) {
        onEvents.click();
      }
    },
    ...onEvents
  }), [onEvents, toggleAxisBreak]);

  return (
    <BaseChart
      option={chartOption}
      style={{ width, height }}
      className={className}
      theme={theme as 'light' | 'dark'}
      onEvents={handleChartEvents}
      loading={loading}
    />
  );
};

export default BridgeChart; 