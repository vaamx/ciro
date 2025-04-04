import React, { useMemo } from 'react';
import BaseChart from '../BaseChart';
import { PieChartProps } from '../types';
import { 
  ITEM_TOOLTIP, 
  DEFAULT_LEGEND,
  LIGHT_COLORS, 
  DARK_COLORS,
  DEFAULT_ANIMATION
} from '../constants';
import { createTooltip, createLegend, createTitle } from '../../../services/echartsService';

/**
 * Pie Chart Component using ECharts
 */
const PieChart: React.FC<PieChartProps> = (props) => {
  const {
    data,
    width,
    height,
    className,
    labels,
    options = {},
    theme = 'light',
    onEvents,
    loading,
    valueKey = 'value',
    nameKey = 'name',
    innerRadius,
    roseType
  } = props;

  // Generate chart options based on props
  const chartOption = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        title: labels?.title ? createTitle(labels.title) : undefined,
        tooltip: createTooltip(ITEM_TOOLTIP),
        series: [{
          type: 'pie',
          data: []
        }]
      };
    }

    // Define color palette based on theme
    const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    
    // Process data for pie chart
    const pieData = data.map((item, index) => ({
      value: item[valueKey],
      name: item[nameKey] || `Item ${index + 1}`,
      itemStyle: {
        color: item.color || colors[index % colors.length]
      }
    }));

    // Determine if we should use a donut chart
    const radius = innerRadius ? ['40%', '70%'] : '70%';
    const roseTypeValue = roseType === true ? 'radius' : roseType || false;
    
    // Complete chart options
    return {
      title: labels?.title ? createTitle(labels.title) : undefined,
      tooltip: createTooltip({
        ...ITEM_TOOLTIP,
        theme,
        formatter: options.tooltipFormatter || '{b}: {c} ({d}%)'
      }),
      legend: createLegend({
        ...DEFAULT_LEGEND,
        type: 'scroll',
        orient: 'horizontal',
        bottom: 0,
        data: pieData.map(item => item.name),
        ...options.legend
      }),
      series: [{
        name: labels?.title || 'Pie Chart',
        type: 'pie',
        radius,
        roseType: roseTypeValue,
        itemStyle: {
          borderRadius: 4,
          ...options.itemStyle
        },
        label: {
          formatter: '{b}: {d}%',
          ...options.label
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          },
          ...options.emphasis
        },
        data: pieData,
        ...options.series
      }],
      ...DEFAULT_ANIMATION,
      ...options.extra
    };
  }, [data, valueKey, nameKey, labels, options, theme, innerRadius, roseType]);

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

export default PieChart; 