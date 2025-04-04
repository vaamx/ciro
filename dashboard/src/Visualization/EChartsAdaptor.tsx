import React, { useMemo } from 'react';
import { BarChart, LineChart, PieChart, BaseChart } from './echarts';
import { ChartType } from './echarts/constants';
import { ChartDataPoint } from './echarts/types';



/**
 * ECharts Adaptor Component
 * 
 * This component serves as a bridge between your existing visualization system
 * and the new ECharts implementation. It takes the visualization type and props
 * and returns the appropriate ECharts component.
 */
interface EChartsAdaptorProps {
  type: string;
  data: ChartDataPoint[];
  options?: any;
  width?: string | number;
  height?: string | number;
  xField?: string;
  yField?: string;
  series?: any[];
  theme?: 'light' | 'dark';
  className?: string;
  onEvents?: Record<string, Function>;
  loading?: boolean;
}

const EChartsAdaptor: React.FC<EChartsAdaptorProps> = ({
  type,
  data = [],
  options = {},
  width,
  height = 400,
  xField,
  yField,
  series,
  theme = 'light' as const,
  className,
  onEvents,
  loading
}) => {
  // Map legacy visualization type to ECharts chart type
  const chartType = useMemo(() => {
    switch (type?.toLowerCase()) {
      case 'bar':
      case 'barchart':
      case 'column':
        return ChartType.BAR;
      case 'line':
      case 'linechart':
        return ChartType.LINE;
      case 'pie':
      case 'piechart':
      case 'donut':
      case 'doughnut':
        return ChartType.PIE;
      case 'radar':
        return ChartType.RADAR;
      case 'scatter':
        return ChartType.SCATTER;
      case 'heatmap':
        return ChartType.HEATMAP;
      case 'funnel':
        return ChartType.FUNNEL;
      case 'gauge':
        return ChartType.GAUGE;
      case 'graph':
      case 'network':
        return ChartType.GRAPH;
      case 'sankey':
        return ChartType.SANKEY;
      case 'treemap':
        return ChartType.TREEMAP;
      case 'custom':
      default:
        return ChartType.CUSTOM;
    }
  }, [type]);

  // Common props for all chart types
  const commonProps = {
    data: data as ChartDataPoint[],
    xKey: xField,
    yKey: yField,
    width,
    height,
    theme: theme as 'light' | 'dark',
    labels: {
      title: options.title,
      xAxis: options.xAxis?.label,
      yAxis: options.yAxis?.label
    },
    series,
    onEvents,
    loading
  };

  // Handle special chart options
  const chartSpecificProps = useMemo(() => {
    switch (chartType) {
      case ChartType.LINE:
        return {
          smooth: options?.smooth,
          showSymbol: options?.showSymbol !== false,
          showArea: options?.area || options?.showArea
        };
      case ChartType.PIE:
        return {
          innerRadius: options?.innerRadius || (options?.donut ? '55%' : undefined),
          roseType: options?.roseType
        };
      case ChartType.BAR:
        return {
          stack: options?.stacked
        };
      default:
        return {};
    }
  }, [chartType, options]);

  // Handle direct ECharts options
  if (options?.echartsOption) {
    return (
      <BaseChart
        option={options.echartsOption}
        style={{ width, height }}
        className={className}
        theme={theme}
        onEvents={onEvents}
        loading={loading}
      />
    );
  }

  // Return appropriate chart component
  switch (chartType) {
    case ChartType.BAR:
      return <BarChart {...commonProps} {...chartSpecificProps} />;
    case ChartType.LINE:
      return <LineChart {...commonProps} {...chartSpecificProps} />;
    case ChartType.PIE:
      return <PieChart {...commonProps} {...chartSpecificProps} />;
    default:
      // For now, return a message for unsupported chart types
      // Later, you can add more chart type implementations
      return (
        <div 
          style={{ 
            width: width || '100%', 
            height: height || '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed #ccc',
            borderRadius: '4px'
          }}
          className={className}
        >
          <p>Chart type '{type}' will be implemented with ECharts soon.</p>
        </div>
      );
  }
};

export default EChartsAdaptor; 