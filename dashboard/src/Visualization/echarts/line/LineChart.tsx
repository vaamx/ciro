import React, { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { XYChartProps } from '../types';
import { 
  DEFAULT_GRID, 
  DEFAULT_TOOLTIP, 
  DEFAULT_LEGEND,
  LIGHT_COLORS, 
  DARK_COLORS,
  createAxis,
  DEFAULT_ANIMATION
} from '../constants';
import { createTooltip, createLegend, createTitle } from '../../../services/echartsService';

/**
 * Line Chart Component using ECharts
 */
const LineChart: React.FC<XYChartProps> = (props) => {
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
    smooth = false,
    showSymbol = true,
    showArea = false
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
    
    // Series configuration
    let seriesData;
    
    if (series && Array.isArray(series) && series.length > 0) {
      // Multi-series chart
      seriesData = series.map((s, index) => {
        const dataKey = s.dataKey || yKey;
        const color = s.color || colors[index % colors.length];
        
        // Create a new object without properties that will be merged
        const { 
          name, 
          lineStyle, 
          areaStyle, 
          itemStyle, 
          emphasis, 
          smooth: seriesSmooth,
          showSymbol: seriesShowSymbol,
          ...restProps 
        } = s;
        
        return {
          name,
          type: 'line',
          smooth: seriesSmooth !== undefined ? seriesSmooth : smooth,
          showSymbol: seriesShowSymbol !== undefined ? seriesShowSymbol : showSymbol,
          lineStyle: {
            color,
            width: 2,
            ...(lineStyle || {})
          },
          // Only add areaStyle if showArea is true or if explicit areaStyle is provided
          ...(showArea || areaStyle ? {
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                  offset: 0,
                  color: color // Start with the line color
                }, {
                  offset: 1,
                  color: 'rgba(255, 255, 255, 0)' // Fade to transparent
                }],
                ...(areaStyle || {})
              }
            }
          } : {}),
          itemStyle: {
            color,
            ...(itemStyle || {})
          },
          emphasis: {
            focus: 'series',
            ...(emphasis || {})
          },
          data: data.map(item => item[dataKey]),
          ...restProps
        };
      });
    } else {
      // Single series chart
      seriesData = [{
        name: labels?.yAxis || yKey,
        type: 'line',
        smooth,
        showSymbol,
        lineStyle: {
          color: colors[0],
          width: 2,
          ...options.lineStyle
        },
        ...(showArea ? {
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: colors[0] // Start with the line color
              }, {
                offset: 1,
                color: 'rgba(255, 255, 255, 0)' // Fade to transparent
              }],
              ...options.areaStyle
            }
          }
        } : {}),
        itemStyle: {
          color: colors[0],
          ...options.itemStyle
        },
        emphasis: {
          focus: 'series',
          ...options.emphasis
        },
        data: data.map(item => item[yKey])
      }];
    }
    
    // Complete chart options
    return {
      title: labels?.title ? createTitle(labels.title) : undefined,
      tooltip: createTooltip({
        ...DEFAULT_TOOLTIP,
        theme,
        formatter: options.tooltipFormatter
      }),
      legend: series?.length ? createLegend({
        ...DEFAULT_LEGEND,
        data: seriesData.map(item => item.name)
      }) : undefined,
      grid: {
        ...DEFAULT_GRID,
        ...options.grid
      },
      xAxis: {
        type: 'category',
        boundaryGap: false, // Start drawing from the edge for line charts
        data: categories,
        ...createAxis(labels?.xAxis || '', options.xAxis)
      },
      yAxis: {
        type: 'value',
        ...createAxis(labels?.yAxis || '', options.yAxis)
      },
      ...DEFAULT_ANIMATION,
      series: seriesData,
      ...options.extra
    };
  }, [data, xKey, yKey, series, labels, options, theme, smooth, showSymbol, showArea]);

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

export default LineChart; 