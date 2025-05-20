import * as React from 'react';
import { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { XYChartProps } from '../types';
import { 
  DEFAULT_GRID, 
  DEFAULT_TOOLTIP, 
  DEFAULT_LEGEND,
  LIGHT_COLORS, 
  DARK_COLORS,
  createAxis
} from '../constants';
import { createTooltip, createLegend, createTitle } from '../../../services/echartsService';

/**
 * Extended props for enhanced Bar Chart
 */
export interface EnhancedBarChartProps extends XYChartProps {
  // Value display options
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
  
  // Indicator and annotation options
  showChangeIndicators?: boolean;
  changePercentages?: Array<{index: number, value: number}>;
  annotations?: Array<{value: string, xIndex: number, yOffset?: number}>;
  
  // Automatic indicator options
  showMonthOverMonthChange?: boolean;
  showYearOverYearChange?: boolean;
  showOverallGrowth?: boolean;
  
  // Highlight options
  highlightIndices?: number[];
  highlightColor?: string;
  
  // Label styling options
  valueFontSize?: number;
  valueFontWeight?: string | number;
  valuePosition?: 'top' | 'inside' | 'bottom';
  valueDistance?: number;
  valueFontColor?: string; // Text color for value labels
  valueStroke?: string; // Stroke/border color for value labels
  valueStrokeWidth?: number; // Stroke/border width for value labels
  
  // AC/PY labels
  acpyLabels?: boolean;
  
  // Previous Year data
  previousYearData?: Array<any>;
  previousYearKey?: string;
  showPreviousYear?: boolean;
  previousYearOpacity?: number;
  highlightExceeded?: boolean;
  exceededColor?: string;
}

/**
 * Enhanced Bar Chart Component using ECharts
 */
const BarChart: React.FC<EnhancedBarChartProps> = (props) => {
  const {
    data,
    xKey = 'category',
    yKey = 'value',
    width,
    height,
    className,
    series,
    labels,
    options = {},
    theme = 'light',
    onEvents,
    loading,
    stack = false,
    
    // Enhanced props with defaults
    showValues = false,
    valueFormatter = (value) => value.toString(),
    showChangeIndicators = false,
    changePercentages = [],
    annotations = [],
    
    // Automatic indicators
    showMonthOverMonthChange = false,
    showYearOverYearChange = false,
    showOverallGrowth = false,
    
    highlightIndices = [],
    highlightColor = '#5470c6', // ECharts blue
    valueFontSize = 12,
    valueFontWeight = 'normal',
    valuePosition = 'top',
    valueDistance = 5,
    valueFontColor = theme === 'dark' ? '#ffffff' : '#333333', // Default text color based on theme
    valueStroke = theme === 'dark' ? 'transparent' : '#ffffff', // Default stroke color based on theme
    valueStrokeWidth = theme === 'dark' ? 0 : 2, // Default stroke width based on theme
    acpyLabels = false,
    
    // Previous Year data
    previousYearData = [],
    previousYearKey = 'value',
    showPreviousYear = false,
    previousYearOpacity = 0.7, // Increased opacity to make PY bars more visible
    highlightExceeded = true,
    exceededColor = '#ee6666', // Bright red color for bars where PY > AC
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
    
    // Define color palette based on theme
    const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    
    // Calculate dynamic indicators if automatic options are enabled
    let calculatedChangePercentages = [...changePercentages];
    let calculatedAnnotations = [...annotations];
    
    // Month over Month change - calculate for the last data point
    if (showMonthOverMonthChange && data.length >= 2) {
      const lastIndex = data.length - 1;
      const currentValue = parseFloat(data[lastIndex][yKey] || 0);
      const previousValue = parseFloat(data[lastIndex - 1][yKey] || 0);
      
      if (!isNaN(currentValue) && !isNaN(previousValue) && previousValue !== 0) {
        const momChange = ((currentValue - previousValue) / previousValue) * 100;
        
        // Only add if not already defined for this index
        if (!calculatedChangePercentages.find(item => item.index === lastIndex)) {
          calculatedChangePercentages.push({
            index: lastIndex,
            value: momChange
          });
        }
      }
    }
    
    // Overall growth calculation (January to December)
    if (showOverallGrowth && data.length > 1) {
      // Get first and last values
      const firstIndex = 0;
      const lastIndex = data.length - 1;
      const firstValue = parseFloat(data[firstIndex][yKey] || 0);
      const lastValue = parseFloat(data[lastIndex][yKey] || 0);
      
      if (!isNaN(firstValue) && !isNaN(lastValue) && firstValue !== 0) {
        // Calculate overall growth percentage
        const overallGrowth = ((lastValue - firstValue) / firstValue) * 100;
        const sign = overallGrowth >= 0 ? '+' : '-';
        const absGrowth = Math.abs(overallGrowth).toFixed(1);
        
        // Format as string for display
        let formattedDiffText: string;
        try {
          const diffValue = Math.abs(lastValue - firstValue);
          formattedDiffText = valueFormatter(diffValue);
        } catch {
          // Fallback if formatter has issues
          const diffValue = Math.abs(lastValue - firstValue);
          formattedDiffText = diffValue.toFixed(1) + 'M';
        }
        
        // Add annotation for overall growth if not already defined
        const existingAnnotation = calculatedAnnotations.find(a => a.xIndex === firstIndex);
        if (!existingAnnotation) {
          calculatedAnnotations.push({
            value: `${sign}${formattedDiffText} (${sign}${absGrowth}%)`,
            xIndex: firstIndex,
            yOffset: 10  // Use 10 pixels from top instead of percentage
          });
        }
      }
    }
    
    // Year over Year change - calculate if we have previous year data
    if (showYearOverYearChange && 
        showPreviousYear && 
        Array.isArray(previousYearData) && 
        previousYearData.length > 0) {
      
      const firstIndex = 0;
      const firstValueAC = parseFloat(data[firstIndex][yKey] || 0);
      const firstValuePY = parseFloat(previousYearData[firstIndex][previousYearKey] || 0);
      
      // Calculate YoY change for first month and add as annotation
      if (!isNaN(firstValueAC) && !isNaN(firstValuePY) && firstValuePY !== 0) {
        const yoyChange = ((firstValueAC - firstValuePY) / firstValuePY) * 100;
        const sign = yoyChange >= 0 ? '+' : '-';
        
        // Format difference value
        let formattedDiffText: string;
        try {
          const diffValue = Math.abs(firstValueAC - firstValuePY);
          formattedDiffText = valueFormatter(diffValue);
        } catch {
          const diffValue = Math.abs(firstValueAC - firstValuePY);
          formattedDiffText = diffValue.toFixed(1) + 'M';
        }
        
        // Only add YoY annotation if overall growth isn't already shown
        if (!showOverallGrowth) {
          // Add annotation for YoY change if not already defined
          const existingAnnotation = calculatedAnnotations.find(a => a.xIndex === firstIndex);
          if (!existingAnnotation) {
            calculatedAnnotations.push({
              value: `${sign}${formattedDiffText} (${sign}${Math.abs(yoyChange).toFixed(1)}%)`,
              xIndex: firstIndex,
              yOffset: 2
            });
          }
        }
      }
    }
    
    // Series configuration
    let seriesData = [];
    
    // Determine if we need to show PY data and if it's valid
    const hasPreviousYearData = showPreviousYear && 
                               Array.isArray(previousYearData) && 
                               previousYearData.length > 0;
    
    // Initialize PY data values if available
    const previousYearValues = hasPreviousYearData 
                                ? previousYearData.map(item => item[previousYearKey] || 0)
                                : [];
    
    // Check which bars need to be highlighted due to PY > AC
    const exceededIndices = hasPreviousYearData && highlightExceeded
                           ? data.map((item, index) => {
                               const acValue = parseFloat(item[yKey] || 0);
                               const pyValue = parseFloat(previousYearValues[index] || 0);
                               return pyValue > acValue ? index : -1;
                             }).filter(index => index !== -1)
                           : [];
    
    // Add Previous Year series first (if enabled) so it appears in the background
    if (hasPreviousYearData) {
      seriesData.push({
        name: 'Previous Year',
        type: 'bar',
        itemStyle: {
          // Use a light gray color for previous year bars
          color: theme === 'dark' ? 'rgba(120, 120, 120, 0.7)' : 'rgba(180, 180, 180, 0.8)',
          opacity: previousYearOpacity
        },
        // Use a small negative barGap to position bars slightly to the left, but still visible
        barGap: '-85%',  
        barWidth: '60%', // Make PY bars slightly narrower
        // Use barCategoryGap to adjust positioning
        barCategoryGap: '20%',
        z: 1, // Lower z-index to ensure it's in the background
        data: previousYearData.map(item => item[previousYearKey] || 0),
        silent: false, // Enable interactions for tooltips
        label: {
          show: false // Don't show labels on PY bars
        }
      });
    }
    
    if (series && Array.isArray(series) && series.length > 0) {
      // Multi-series chart
      const seriesItems = series.map((s, index) => {
        const dataKey = s.dataKey || yKey;
        const color = s.color || colors[index % colors.length];
        
        // Create a new object without name and any overridden properties
        const { name, itemStyle, emphasis, ...restProps } = s;
        
        return {
          name,
          type: 'bar',
          stack: stack ? 'total' : undefined,
          z: 2, // Higher z-index for the AC bars
          itemStyle: {
            color,
            ...(itemStyle || {})
          },
          emphasis: {
            focus: 'series',
            ...(emphasis || {})
          },
          data: data.map(item => item[dataKey]),
          // Add label configuration for values on bars
          ...(showValues && {
            label: {
              show: true,
              position: valuePosition,
              distance: valueDistance,
              fontSize: valueFontSize,
              fontWeight: valueFontWeight,
              formatter: (params: any) => valueFormatter(params.value),
              color: valueFontColor,
              textBorderColor: valueStroke,
              textBorderWidth: valueStrokeWidth,
              textShadowColor: 'transparent',
              textShadowBlur: 0
            }
          }),
          ...restProps
        };
      });
      
      seriesData = [...seriesData, ...seriesItems];
    } else {
      // Single series chart with customizations for individual bars
      const itemStyles = data.map((_, index) => {
        // First check if this is a bar where PY > AC
        if (exceededIndices.includes(index)) {
          return { color: exceededColor };
        }
        // Then check if it should be highlighted for other reasons
        if (highlightIndices.includes(index)) {
          return { color: highlightColor };
        }
        return { color: colors[0] };
      });

      seriesData.push({
        name: labels?.yAxis || yKey,
        type: 'bar',
        z: 2, // Higher z-index for the AC bars
        // Use itemStyle callback for individual bar colors
        itemStyle: {
          color: function(params: any) {
            return itemStyles[params.dataIndex]?.color || colors[0];
          },
          ...options.itemStyle
        },
        emphasis: {
          focus: 'series',
          ...options.emphasis
        },
        data: data.map(item => item[yKey]),
        // Add label configuration for values on bars
        ...(showValues && {
          label: {
            show: true,
            position: valuePosition,
            distance: valueDistance,
            fontSize: valueFontSize,
            fontWeight: valueFontWeight,
            formatter: (params: any) => valueFormatter(params.value),
            color: valueFontColor,
            textBorderColor: valueStroke,
            textBorderWidth: valueStrokeWidth,
            textShadowColor: 'transparent',
            textShadowBlur: 0
          }
        })
      });
    }
    
    // Create graphic elements for annotations and indicators
    const graphicElements: any[] = [];
    
    // Add triangle indicators with percentage changes
    if (showChangeIndicators && calculatedChangePercentages.length > 0) {
      calculatedChangePercentages.forEach(change => {
        const isNegative = change.value < 0;
        const isLastBar = change.index === data.length - 1; // Check if this is the last bar (December)
        
        graphicElements.push({
          type: 'group',
          right: isLastBar ? '15px' : `${92 - change.index * (100 / categories.length)}%`,
          top: 10, // Use fixed pixel values for consistent positioning
          z: 100,
          children: [
            // Triangle using polygon
            {
              type: 'polygon',
              shape: {
                points: isNegative 
                  ? [[0, 0], [6, 10], [-6, 10]] // Down triangle 
                  : [[0, 10], [6, 0], [-6, 0]]  // Up triangle
              },
              style: {
                fill: isNegative ? '#ff6e76' : '#91cc75' // Red for negative, green for positive
              }
            },
            // Percentage text
            {
              type: 'text',
              style: {
                text: `${isNegative ? '' : '+'}${change.value.toFixed(1)}%`,
                fontSize: 12,
                textAlign: 'center',
                textVerticalAlign: 'bottom',
                fill: isNegative ? '#ff6e76' : '#91cc75',
                fontWeight: 'bold',
                x: 0,
                y: isNegative ? -5 : 20
              }
            }
          ]
        });
      });
    }
    
    // Add custom annotations
    calculatedAnnotations.forEach(annotation => {
      // Determine if value is positive or negative based on content
      const isNegative = annotation.value.includes('-');
      const textColor = isNegative ? '#ff6e76' : '#91cc75';
      
      // Determine position based on xIndex
      const isFirstBar = annotation.xIndex === 0;
      
      // Position appropriately based on whether it's for the first bar (January) or not
      graphicElements.push({
        type: 'text',
        // Use left positioning for first bar (January) value indicators
        ...(isFirstBar ? { 
          left: '15px'
        } : {
          right: `${92 - annotation.xIndex * (100 / categories.length)}%`
        }),
        top: annotation.yOffset !== undefined ? annotation.yOffset : 10, // Use pixel values for top positioning
        style: {
          text: annotation.value,
          fontSize: 14,
          fontWeight: 'bold',
          fill: textColor,
          textAlign: 'left'
        },
        z: 100
      });
    });
    
    // Add AC/PY labels if enabled
    if (acpyLabels && data.length > 0) {
      // AC label (top)
      graphicElements.push({
        type: 'text',
        left: '10px',
        top: '40%',
        style: {
          text: 'AC',
          fontSize: 12,
          fontWeight: 'bold',
          fill: theme === 'dark' ? '#ccc' : '#333'
        },
        z: 100
      });
      
      // PY label (bottom)
      graphicElements.push({
        type: 'text',
        left: '10px',
        top: '55%',
        style: {
          text: 'PY',
          fontSize: 12,
          fontWeight: 'bold',
          fill: theme === 'dark' ? '#ccc' : '#333'
        },
        z: 100
      });
    }
    
    // Complete chart options
    return {
      title: labels?.title ? createTitle(labels.title) : undefined,
      tooltip: createTooltip({
        ...DEFAULT_TOOLTIP,
        theme,
        trigger: 'item',
        formatter: options.tooltipFormatter || function(params: any) {
          // Handle array of params for multiple series
          if (Array.isArray(params)) {
            // The last param is the actual year data in our setup
            const acParam = params.find(p => p.seriesName !== 'Previous Year');
            const pyParam = params.find(p => p.seriesName === 'Previous Year');
            
            if (acParam && pyParam) {
              const acValue = acParam.value;
              const pyValue = pyParam.value;
              const diff = acValue - pyValue;
              const percentChange = ((diff / pyValue) * 100).toFixed(1);
              
              // Format values
              const acFormatted = valueFormatter(acValue);
              const pyFormatted = valueFormatter(pyValue);
              const diffFormatted = valueFormatter(Math.abs(diff));
              
              // Determine colors based on value comparison
              const diffColor = diff >= 0 ? '#91cc75' : '#ff6e76';
              
              return `
                <div style="padding: 5px 10px;">
                  <div style="font-weight: bold; margin-bottom: 5px;">${acParam.name}</div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>AC:</span>
                    <span style="font-weight: bold;">${acFormatted}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>PY:</span>
                    <span style="font-weight: bold;">${pyFormatted}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; color: ${diffColor}; font-weight: bold; margin-top: 5px; border-top: 1px solid rgba(200,200,200,0.3); padding-top: 5px;">
                    <span>YoY:</span>
                    <span>${diff >= 0 ? '+' : '-'}${diffFormatted} (${diff >= 0 ? '+' : ''}${percentChange}%)</span>
                  </div>
                </div>
              `;
            }
            
            // Default to the first param if we don't have both AC and PY
            const param = acParam || params[0];
            return `${param.name}: ${valueFormatter(param.value)}`;
          }
          
          // Single param case (most common)
          if (params && hasPreviousYearData) {
            const index = params.dataIndex;
            const acValue = data[index]?.[yKey] || 0;
            const pyValue = previousYearData[index]?.[previousYearKey] || 0;
            const diff = acValue - pyValue;
            const percentChange = ((diff / pyValue) * 100).toFixed(1);
            
            // Format values
            const acFormatted = valueFormatter(acValue);
            const pyFormatted = valueFormatter(pyValue);
            const diffFormatted = valueFormatter(Math.abs(diff));
            
            // Determine colors based on value comparison
            const diffColor = diff >= 0 ? '#91cc75' : '#ff6e76';
            
            return `
              <div style="padding: 5px 10px;">
                <div style="font-weight: bold; margin-bottom: 5px;">${params.name}</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                  <span>AC:</span>
                  <span style="font-weight: bold;">${acFormatted}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                  <span>PY:</span>
                  <span style="font-weight: bold;">${pyFormatted}</span>
                </div>
                <div style="display: flex; justify-content: space-between; color: ${diffColor}; font-weight: bold; margin-top: 5px; border-top: 1px solid rgba(200,200,200,0.3); padding-top: 5px;">
                  <span>YoY:</span>
                  <span>${diff >= 0 ? '+' : '-'}${diffFormatted} (${diff >= 0 ? '+' : ''}${percentChange}%)</span>
                </div>
              </div>
            `;
          }
          
          // Default case for single series without PY data
          return `${params.name}: ${valueFormatter(params.value)}`;
        }
      }),
      legend: hasPreviousYearData || series?.length ? createLegend({
        ...DEFAULT_LEGEND,
        data: (hasPreviousYearData || series?.length) ? 
          [
            // Only include Previous Year in legend if it exists as a series
            ...(hasPreviousYearData && Array.isArray(seriesData) && seriesData.some((s: any) => s.name === 'Previous Year') ? ['Previous Year'] : []),
            // Include actual series names from the series data
            ...(Array.isArray(seriesData) ? 
                seriesData
                  .map((s: any) => (typeof s === 'object' && s !== null && s.name !== 'Previous Year') ? s.name : null)
                  .filter((name): name is string => typeof name === 'string')
                : [])
          ] : undefined
      }) : undefined,
      grid: {
        ...DEFAULT_GRID,
        ...options.grid
      },
      xAxis: {
        type: 'category',
        data: categories,
        ...createAxis(labels?.xAxis || '', options.xAxis)
      },
      yAxis: {
        type: 'value',
        ...createAxis(labels?.yAxis || '', options.yAxis)
      },
      graphic: graphicElements.length > 0 ? graphicElements : undefined,
      series: seriesData,
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
      ...options.extra
    };
  }, [
    data, 
    xKey, 
    yKey, 
    series, 
    labels, 
    options, 
    theme, 
    stack, 
    showValues, 
    valueFormatter, 
    showChangeIndicators, 
    changePercentages, 
    annotations, 
    showMonthOverMonthChange,
    showYearOverYearChange,
    showOverallGrowth,
    highlightIndices, 
    highlightColor, 
    valueFontSize, 
    valueFontWeight, 
    valuePosition, 
    valueDistance,
    acpyLabels,
    previousYearData,
    previousYearKey,
    showPreviousYear,
    previousYearOpacity,
    highlightExceeded,
    exceededColor
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

export default BarChart; 