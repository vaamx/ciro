import React, { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { XYChartProps } from '../types';
import { 
  DEFAULT_GRID, 
  DEFAULT_TOOLTIP, 
  createAxis,
  DEFAULT_ANIMATION
} from '../constants';
import { createTooltip, createTitle } from '../../../services/echartsService';

/**
 * Enhanced Area Chart Component using ECharts
 * 
 * Features:
 * - AC and PY comparison visualization
 * - Gray PY area at the bottom
 * - Green areas where AC > PY (using positiveAreaColor)
 * - Red areas where AC < PY
 * - Black AC line for better visibility
 * - Data point markers with labels
 * - Growth indicator display
 * - Highlighted month (e.g., September)
 * - Enhanced connecting lines between data points
 */
const EnhancedAreaChart: React.FC<XYChartProps & {
  previousYearData?: any[];
  previousYearKey?: string;
  showValues?: boolean;
  valueFormatter?: (value: any) => string;
  showOverallGrowth?: boolean;
  overallGrowthValue?: number | string;
  overallGrowthPosition?: 'topRight' | 'bottomRight';
  overallGrowthCompact?: boolean;
  acColor?: string;
  positiveAreaColor?: string;
  pyColor?: string;
  lowerColor?: string;
  highlightIndex?: number;
  highlightColor?: string;
  highlightMaxValue?: boolean;
  maxValueColor?: string;
  showConnectingLines?: boolean;
  connectingLineColor?: string;
  connectingLineWidth?: number;
  connectingLineStyle?: 'solid' | 'dashed' | 'dotted';
  isPreview?: boolean;
  symbolSize?: number;
  lineWidth?: number;
  hideAxisLabels?: boolean;
  showPyLabels?: boolean;
}> = (props) => {
  const {
    data,
    xKey = 'category',
    yKey = 'value',
    previousYearData = [],
    previousYearKey = 'value',
    width,
    height,
    className,
    labels,
    options = {},
    theme = 'light',
    onEvents,
    loading,
    smooth = false,
    showSymbol = true,
    showValues = true,
    valueFormatter = (value) => `${value}`,
    showOverallGrowth = false,
    overallGrowthValue,
    overallGrowthPosition = 'topRight',
    overallGrowthCompact = false,
    acColor = '#000000', // Black for AC line
    positiveAreaColor = '#8DC21F', // Green for positive areas
    pyColor = '#e0e0e0', // Light gray for PY
    lowerColor = '#FF6666', // Red for AC when lower
    highlightIndex = 8, // Default to September (0-indexed)
    highlightColor = '#FF6666', // Red highlight for the specified month
    highlightMaxValue = false, // Whether to highlight the max value
    maxValueColor = '#1890ff', // Blue color for max value highlight
    showConnectingLines = true,
    connectingLineColor = '#cccccc',
    connectingLineWidth = 1,
    connectingLineStyle = 'dashed',
    isPreview = false,
    symbolSize,
    lineWidth,
    hideAxisLabels = false,
    showPyLabels = false,
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
    
    // Calculate growth if not provided but showOverallGrowth is true
    let growthValue = overallGrowthValue;
    if (showOverallGrowth && !growthValue && data.length >= 2) {
      const firstValue = data[0][yKey];
      const lastValue = data[data.length - 1][yKey];
      if (typeof firstValue === 'number' && typeof lastValue === 'number') {
        const growth = ((lastValue - firstValue) / firstValue) * 100;
        growthValue = `+${growth.toFixed(1)}%`;
      }
    }
    
    // Prepare AC and PY data series
    const acValues = data.map(item => item[yKey]);
    const pyValues = previousYearData.map(item => item[previousYearKey]);
    
    // Find index of max value if highlighting max value
    let maxValueIndex = -1;
    if (highlightMaxValue) {
      let maxValue = -Infinity;
      acValues.forEach((value, index) => {
        if (value > maxValue) {
          maxValue = value;
          maxValueIndex = index;
        }
      });
    }
    
    // Create a new approach using custom rendering
    const chartSeries = [];
    
    // Add connecting vertical lines between data points if enabled
    if (showConnectingLines) {
      chartSeries.push({
        name: 'Connecting-Lines',
        type: 'custom',
        z: 0, // Behind everything
        renderItem: (params: any, api: any) => {
          if (params.dataIndex === acValues.length - 1) return;
          
          const acValue = acValues[params.dataIndex];
          
          const x = api.coord([params.dataIndex, 0])[0];
          const y0 = api.coord([0, 0])[1];
          const y1 = api.coord([0, acValue])[1];
          
          return {
            type: 'line',
            shape: {
              x1: x,
              y1: y0,
              x2: x,
              y2: y1
            },
            style: {
              stroke: connectingLineColor,
              lineWidth: connectingLineWidth,
              lineDash: connectingLineStyle === 'dashed' ? [4, 4] : 
                        connectingLineStyle === 'dotted' ? [2, 2] : 
                        [],
              opacity: 0.3, // Make more subtle
              shadowBlur: 1,
              shadowColor: 'rgba(0, 0, 0, 0.05)'
            }
          };
        },
        data: acValues.map((_, index) => index)
      });
    }
    
    // Add the PY series (gray)
    chartSeries.push({
      name: 'PY',
      type: 'line',
      smooth: false, // Use straight lines instead of curves
      z: 5, // Increased z-index (was 1)
      itemStyle: {
        color: pyColor
      },
      lineStyle: {
        width: 3, // Increased width (was 2)
        color: pyColor
      },
      areaStyle: {
        color: pyColor,
        opacity: isPreview ? 0.4 : 0.6,
        origin: 'start'
      },
      showSymbol,
      symbol: 'circle',
      symbolSize: (_: any, params: any) => {
        if (isPreview) {
          return symbolSize || 5; // Use small fixed size in preview mode
        }
        // Standard logic for normal view
        if (params.dataIndex === highlightIndex) return 12;
        if (highlightMaxValue && params.dataIndex === maxValueIndex) return 12;
        return 8;
      },
      data: pyValues.map((value, _index) => ({
        value,
        itemStyle: {
          color: pyColor
        },
        label: {
          show: showValues && showPyLabels,
          position: 'top',
          formatter: valueFormatter(value),
          fontSize: 11,
          color: theme === 'dark' ? '#ddd' : '#666'
        }
      }))
    });
    
    // Generate data for negative/positive areas
    const positiveSeries = [];
    const negativeSeries = [];
    
    // Create data for positive and negative areas
    for (let i = 0; i < acValues.length; i++) {
      const acValue = acValues[i];
      const pyValue = pyValues[i] || 0;
      
      if (acValue > pyValue) {
        // AC > PY - show green area from PY to AC
        positiveSeries.push([i, acValue]);
        negativeSeries.push([i, pyValue]);
      } else {
        // AC <= PY - show red area from AC to PY
        positiveSeries.push([i, pyValue]);
        negativeSeries.push([i, acValue]);
      }
    }
    
    // Add the AC line (with markers)
    chartSeries.push({
      name: 'AC',
      type: 'line',
      smooth: false, // Use straight lines
      showSymbol,
      symbol: 'circle',
      symbolSize: (_: any, params: any) => {
        if (isPreview) {
          return symbolSize || 5; // Use small fixed size in preview mode
        }
        // Standard logic for normal view
        if (params.dataIndex === highlightIndex) return 12;
        if (highlightMaxValue && params.dataIndex === maxValueIndex) return 12;
        return 8;
      },
      lineStyle: {
        width: lineWidth || 3,
        // Color the line based on AC vs PY comparison
        color: (params: any) => {
          const dataIndex = params.dataIndex;
          const acValue = acValues[dataIndex];
          const pyValue = pyValues[dataIndex] || 0;
          // Use highlight color for the specified index, otherwise use standard colors
          if (dataIndex === highlightIndex) {
            return highlightColor;
          }
          if (highlightMaxValue && dataIndex === maxValueIndex) {
            return maxValueColor;
          }
          return acValue >= pyValue ? acColor : lowerColor;
        },
        shadowBlur: 5,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffsetY: 2,
        cap: 'round',
        join: 'round'
      },
      z: 3, // Above the area but below the markers
      data: acValues.map((value, index) => {
        const pyValue = pyValues[index] || 0;
        const isHigher = value >= pyValue;
        // Use highlight color for the specified index, otherwise use standard colors
        let color = isHigher ? acColor : lowerColor;
        if (index === highlightIndex) {
          color = highlightColor;
        } else if (highlightMaxValue && index === maxValueIndex) {
          color = maxValueColor;
        }
        
        return {
          value,
          itemStyle: {
            color,
            borderWidth: (index === highlightIndex || (highlightMaxValue && index === maxValueIndex)) ? 3 : 0,
            borderColor: (index === highlightIndex || (highlightMaxValue && index === maxValueIndex)) ? '#ffffff' : 'transparent',
            shadowBlur: (index === highlightIndex || (highlightMaxValue && index === maxValueIndex)) ? 8 : 0,
            shadowColor: index === highlightIndex ? highlightColor : 
                          (highlightMaxValue && index === maxValueIndex) ? maxValueColor : 'transparent'
          },
          label: {
            show: showValues,
            position: 'top',
            formatter: valueFormatter(value),
            fontSize: (index === highlightIndex || (highlightMaxValue && index === maxValueIndex)) ? 14 : 12,
            fontWeight: 'bold',
            color,
            distance: 5,
            textBorderColor: 'rgba(255, 255, 255, 0.5)',
            textBorderWidth: 2,
            textShadowBlur: 2,
            textShadowColor: 'rgba(255, 255, 255, 0.8)'
          }
        };
      })
    });
    
    // Add a special highlight ring around the September point
    if (!isPreview && highlightIndex !== undefined && highlightIndex >= 0 && highlightIndex < acValues.length) {
      chartSeries.push({
        name: 'Highlight-Ring',
        type: 'scatter',
        symbolSize: 22, // Increased size
        z: 2,
        itemStyle: {
          color: 'transparent',
          borderColor: highlightColor,
          borderWidth: 2,
          shadowBlur: 15,
          shadowColor: highlightColor
        },
        data: Array(acValues.length).fill(null).map((_, index) => {
          if (index === highlightIndex) {
            return {
              value: [index, acValues[index]],
              symbolSize: 22 // Increased size
            };
          }
          return null;
        }).filter(item => item !== null)
      });
    }
    
    // Add highlight ring for max value if enabled
    if (!isPreview && highlightMaxValue && maxValueIndex >= 0 && maxValueIndex < acValues.length) {
      chartSeries.push({
        name: 'MaxValue-Ring',
        type: 'scatter',
        symbolSize: 22,
        z: 2,
        itemStyle: {
          color: 'transparent',
          borderColor: maxValueColor,
          borderWidth: 2,
          shadowBlur: 15,
          shadowColor: maxValueColor
        },
        data: Array(acValues.length).fill(null).map((_, index) => {
          if (index === maxValueIndex) {
            return {
              value: [index, acValues[index]],
              symbolSize: 22
            };
          }
          return null;
        }).filter(item => item !== null)
      });
    }
    
    // Add the red areas
    chartSeries.push({
      name: 'AC-Negative',
      type: 'custom',
      renderItem: (params: any, api: any) => {
        if (params.dataIndex === acValues.length - 1) return;
        
        const acValue = acValues[params.dataIndex];
        const pyValue = pyValues[params.dataIndex] || 0;
        const nextAcValue = acValues[params.dataIndex + 1];
        const nextPyValue = pyValues[params.dataIndex + 1] || 0;
        
        // Only continue if there's a crossing or both points are below
        const ac0AbovePy = acValue >= pyValue;
        const ac1AbovePy = nextAcValue >= nextPyValue;
        
        // Skip if both AC points are above PY (no red area)
        if (ac0AbovePy && ac1AbovePy) return;
        
        let points = [];
        const x0 = params.dataIndex;
        const x1 = params.dataIndex + 1;
        
        // Get coordinates for the points
        const ac0 = api.coord([x0, acValue]);
        const ac1 = api.coord([x1, nextAcValue]);
        const py0 = api.coord([x0, pyValue]);
        const py1 = api.coord([x1, nextPyValue]);
        
        // If lines cross, find intersection point
        if (ac0AbovePy !== ac1AbovePy) {
          // Calculate where AC and PY lines intersect
          const t = (pyValue - acValue) / ((nextAcValue - acValue) - (nextPyValue - pyValue));
          const intersectX = x0 + t;
          const intersectY = acValue + t * (nextAcValue - acValue);
          const intersect = api.coord([intersectX, intersectY]);
          
          if (ac0AbovePy) {
            // AC0 above, AC1 below - use point from intersection to end
            points = [
              intersect,
              ac1,
              py1,
              [intersect[0], py0[1] + (py1[1] - py0[1]) * t]
            ];
          } else {
            // AC0 below, AC1 above - use point from start to intersection
            points = [
              ac0,
              intersect,
              [intersect[0], py0[1] + (py1[1] - py0[1]) * t],
              py0
            ];
          }
        } else {
          // Both points below PY - simple rectangle
          points = [ac0, ac1, py1, py0];
        }
        
        return {
          type: 'polygon',
          shape: {
            points
          },
          style: {
            fill: lowerColor,
            opacity: 0.9
          }
        };
      },
      data: acValues.map((_, index) => index),
      z: 2
    });
    
    // Add the positive areas (using positiveAreaColor)
    chartSeries.push({
      name: 'AC-Positive',
      type: 'custom',
      renderItem: (params: any, api: any) => {
        if (params.dataIndex === acValues.length - 1) return;
        
        const acValue = acValues[params.dataIndex];
        const pyValue = pyValues[params.dataIndex] || 0;
        const nextAcValue = acValues[params.dataIndex + 1];
        const nextPyValue = pyValues[params.dataIndex + 1] || 0;
        
        // Only continue if there's a crossing or both points are above
        const ac0AbovePy = acValue >= pyValue;
        const ac1AbovePy = nextAcValue >= nextPyValue;
        
        // Skip if both AC points are below PY (no green area)
        if (!ac0AbovePy && !ac1AbovePy) return;
        
        let points = [];
        const x0 = params.dataIndex;
        const x1 = params.dataIndex + 1;
        
        // Get coordinates for the points
        const ac0 = api.coord([x0, acValue]);
        const ac1 = api.coord([x1, nextAcValue]);
        const py0 = api.coord([x0, pyValue]);
        const py1 = api.coord([x1, nextPyValue]);
        
        // If lines cross, find intersection point
        if (ac0AbovePy !== ac1AbovePy) {
          // Calculate where AC and PY lines intersect
          const t = (pyValue - acValue) / ((nextAcValue - acValue) - (nextPyValue - pyValue));
          const intersectX = x0 + t;
          const intersectY = acValue + t * (nextAcValue - acValue);
          const intersect = api.coord([intersectX, intersectY]);
          
          if (ac0AbovePy) {
            // AC0 above, AC1 below - use point from start to intersection
            points = [
              ac0,
              intersect,
              [intersect[0], py0[1] + (py1[1] - py0[1]) * t],
              py0
            ];
          } else {
            // AC0 below, AC1 above - use point from intersection to end
            points = [
              intersect,
              ac1,
              py1,
              [intersect[0], py0[1] + (py1[1] - py0[1]) * t]
            ];
          }
        } else {
          // Both points above PY - simple rectangle
          points = [ac0, ac1, py1, py0];
        }
        
        return {
          type: 'polygon',
          shape: {
            points
          },
          style: {
            fill: positiveAreaColor,
            opacity: 0.9
          }
        };
      },
      data: acValues.map((_, index) => index),
      z: 2
    });

    // Update the grid settings based on preview mode
    const gridSettings = {
      ...DEFAULT_GRID,
      right: isPreview ? 40 : 60,
      top: isPreview ? 30 : 60,
      bottom: isPreview ? 30 : 40,
      left: isPreview ? 40 : 40,
      ...options.grid
    };

    // Complete chart options
    const areaOptions = {
      title: labels?.title ? createTitle(labels.title) : undefined,
      tooltip: createTooltip({
        ...DEFAULT_TOOLTIP,
        theme,
        formatter: (params: any) => {
          if (Array.isArray(params)) {
            // Filter out our helper series from tooltip
            params = params.filter((p: any) => 
              p.seriesName !== 'AC-Positive' && 
              p.seriesName !== 'AC-Negative' && 
              p.seriesName !== 'Connecting-Lines' && 
              p.seriesName !== 'Highlight-Ring' &&
              p.seriesName !== 'MaxValue-Ring' &&
              p.componentSubType !== 'markArea'
            );
            
            const pyItem = params.find((p: any) => p.seriesName === 'PY');
            const acItem = params.find((p: any) => p.seriesName === 'AC');
            
            if (acItem && pyItem) {
              const acValue = acItem.value;
              const pyValue = pyItem.value;
              const diff = acValue - pyValue;
              const diffPercent = pyValue !== 0 ? (diff / pyValue) * 100 : 0;
              const diffFormatted = diffPercent >= 0 ? `+${diffPercent.toFixed(1)}%` : `${diffPercent.toFixed(1)}%`;
              const diffColor = diffPercent >= 0 ? positiveAreaColor : lowerColor;
              
              // Highlight the tooltip for the highlighted month
              const isHighlighted = acItem.dataIndex === highlightIndex || 
                                   (highlightMaxValue && acItem.dataIndex === maxValueIndex);
              const tooltipHighlightColor = acItem.dataIndex === highlightIndex ? highlightColor :
                                           (highlightMaxValue && acItem.dataIndex === maxValueIndex) ? maxValueColor :
                                           'transparent';
              
              // Create background color based on highlight status
              const backgroundColor = isHighlighted ? 
                                    (acItem.dataIndex === highlightIndex ? 'rgba(255,102,102,0.1)' : 'rgba(24,144,255,0.1)') : 
                                    'rgba(255,255,255,0.8)';
              const borderColor = isHighlighted ? tooltipHighlightColor : '#e0e0e0';
              
              // Set the dot color correctly depending on whether AC > PY
              const acDotColor = diffPercent >= 0 ? positiveAreaColor : lowerColor;
              
              return `
                <div style="padding: 12px; background-color: ${backgroundColor}; border-left: 4px solid ${borderColor}; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #333;">${acItem.name}</div>
                  <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${acDotColor}; margin-right: 8px;"></span>
                      <span style="font-size: 13px; color: #555;">AC: </span>
                      <span style="font-weight: bold; font-size: 14px; color: #333;">${valueFormatter(acValue)}</span>
                    </div>
                    <div style="font-weight: bold; color: ${diffColor}; margin-left: 20px; font-size: 14px; display: flex; align-items: center;">
                      <span style="margin-right: 3px;">${diffPercent >= 0 ? '↑' : '↓'}</span>
                      ${diffFormatted}
                    </div>
                  </div>
                  <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid #eee;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${pyColor}; margin-right: 8px;"></span>
                    <span style="font-size: 13px; color: #555;">PY: </span>
                    <span style="font-weight: bold; font-size: 14px; color: #666;">${valueFormatter(pyValue)}</span>
                  </div>
                </div>
              `;
            }
          }
          
          // Default formatting
          return params.seriesName + ': ' + valueFormatter(params.value);
        }
      }),
      legend: {
        data: ['AC', 'PY'],
        bottom: 5,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: theme === 'dark' ? '#ddd' : '#333',
          fontSize: 12
        },
        formatter: function(name: string) {
          // Only show AC and PY in the legend
          return (name === 'AC-Positive' || name === 'AC-Negative' || 
                 name === 'Connecting-Lines' || name === 'Highlight-Ring' || 
                 name === 'MaxValue-Ring') ? '' : name;
        }
      },
      grid: gridSettings,
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        show: !hideAxisLabels,
        axisLine: {
          show: !hideAxisLabels,
          lineStyle: {
            color: '#cccccc'
          }
        },
        splitLine: {
          show: false
        },
        ...createAxis(labels?.xAxis || '', options.xAxis)
      },
      yAxis: {
        type: 'value',
        show: !hideAxisLabels,
        axisLine: {
          show: !hideAxisLabels,
          lineStyle: {
            color: '#dddddd'
          }
        },
        splitLine: {
          show: !hideAxisLabels,
          lineStyle: {
            color: ['#eeeeee'],
            type: 'dashed',
            width: 1,
            opacity: 0.5
          }
        },
        ...createAxis(labels?.yAxis || '', options.yAxis)
      },
      ...DEFAULT_ANIMATION,
      series: chartSeries,
      ...options.extra
    };
    
    // Add growth indicator if needed
    if (showOverallGrowth && growthValue) {
      const textStyle = {
        fontSize: isPreview ? 14 : 16,
        fontWeight: 'bold',
        color: positiveAreaColor // Use green for growth indicator
      };
      
      // Adjust arrow size for preview
      const arrowScale = isPreview ? 0.8 : 1;

      // Growth arrow and text
      const growthGraphic = [
        // Text for the growth percentage
        {
          type: 'text',
          right: 5,
          top: overallGrowthCompact ? 1 : (isPreview ? 3 : 10),
          style: {
            text: growthValue,
            fontSize: overallGrowthCompact ? 10 : (isPreview ? 12 : 16),
            fontWeight: textStyle.fontWeight,
            fill: positiveAreaColor, // Use green for growth text
            textAlign: 'right',
            textShadowBlur: overallGrowthCompact ? 0 : 2,
            textShadowColor: 'rgba(255, 255, 255, 0.8)'
          },
          z: 100
        }
      ];
      
      // Only add arrow if not in compact mode or if in preview but not compact
      if (!overallGrowthCompact || !isPreview) {
        // Add the arrow line as a separate element
        growthGraphic.push({
          type: 'line',
          right: 20,
          top: overallGrowthCompact ? 10 : (isPreview ? 18 : 33),
          shape: {
            x1: 0,  // Vertical line
            y1: 0,  // Start at the top
            x2: 0,  // Vertical line
            y2: overallGrowthCompact ? 15 : (isPreview ? 25 : 50)  // Shorter line in compact/preview
          },
          style: {
            stroke: positiveAreaColor, // Use green for growth line
            lineWidth: overallGrowthCompact ? 1 : 2,
            lineCap: 'round',
            shadowBlur: overallGrowthCompact ? 0 : 5,
            shadowColor: 'rgba(141, 194, 31, 0.3)' // Green shadow
          },
          z: 100
        } as any);  // Add type assertion for the entire object
        
        // Add the arrow head as a separate element
        growthGraphic.push({
          type: 'polygon',
          right: 20,
          top: overallGrowthCompact ? 10 : (isPreview ? 18 : 33),
          shape: {
            points: [
              [0, 0],   // Bottom point of arrow
              [-6 * (overallGrowthCompact ? 0.5 : arrowScale), 10 * (overallGrowthCompact ? 0.5 : arrowScale)],  // Left point
              [6 * (overallGrowthCompact ? 0.5 : arrowScale), 10 * (overallGrowthCompact ? 0.5 : arrowScale)]    // Right point
            ]
          },
          style: {
            fill: positiveAreaColor, // Use green for growth arrow head
            shadowBlur: overallGrowthCompact ? 0 : 5,
            shadowColor: 'rgba(141, 194, 31, 0.3)' // Green shadow
          },
          z: 100
        } as any);  // Add type assertion for the entire object
      }
      
      if (!areaOptions.graphic) {
        areaOptions.graphic = growthGraphic;
      } else if (Array.isArray(areaOptions.graphic)) {
        areaOptions.graphic = [...areaOptions.graphic, ...growthGraphic];
      } else {
        areaOptions.graphic = [areaOptions.graphic, ...growthGraphic];
      }
    }
    
    // Only add labels if not in preview mode or hideAxisLabels is false
    if (!isPreview) {
      areaOptions.graphic = [...(areaOptions.graphic || []), {
        type: 'group',
        left: 5,
        top: 'middle',
        children: [
          {
            type: 'text',
            style: {
              text: 'AC',
              fontSize: 14,
              fontWeight: 'bold',
              fill: theme === 'dark' ? '#eee' : '#333',
              x: 0,
              y: 0
            }
          }
        ]
      }];
    }
    
    return areaOptions;
  }, [data, xKey, yKey, previousYearData, previousYearKey, labels, options, theme, smooth, showSymbol, 
      showValues, valueFormatter, showOverallGrowth, overallGrowthValue, overallGrowthPosition, overallGrowthCompact,
      acColor, positiveAreaColor, pyColor, lowerColor, highlightIndex, highlightColor, highlightMaxValue, maxValueColor,
      showConnectingLines, connectingLineColor, connectingLineWidth, connectingLineStyle, isPreview, symbolSize, lineWidth, hideAxisLabels, showPyLabels]);

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

export default EnhancedAreaChart; 