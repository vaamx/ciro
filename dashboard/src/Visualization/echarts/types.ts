import { ChartType } from './constants';
import { BaseChartProps } from './BaseChart';

// Types for chart data
export interface ChartDataPoint {
  [key: string]: any;
}

export interface ChartSeries {
  name: string;
  dataKey?: string;
  type?: ChartType | string;
  color?: string;
  stack?: string;
  areaStyle?: any;
  lineStyle?: any;
  itemStyle?: any;
  emphasis?: any;
  label?: any;
  data?: any[];
  [key: string]: any;
}

// Common props for all chart types
export interface CommonChartProps {
  // Data
  data: ChartDataPoint[];
  
  // Data keys
  xKey?: string;
  yKey?: string;
  
  // Appearance
  width?: string | number;
  height?: string | number;
  className?: string;
  
  // Series configuration
  series?: ChartSeries[];
  
  // Labels for axes, title, etc.
  labels?: {
    title?: string;
    subtitle?: string;
    xAxis?: string;
    yAxis?: string;
  };
  
  // Theme
  theme?: 'light' | 'dark';
  
  // Additional options specific to the chart type
  options?: Record<string, any>;
  
  // Events
  onEvents?: Record<string, Function>;
  
  // Loading state
  loading?: boolean;
}

// Extended props for chart components - combines common props with BaseChart props
export type EChartsComponentProps = CommonChartProps & Omit<BaseChartProps, 'option' | 'theme'>;

// Type for option generators - functions that create ECharts options from props
export type OptionGenerator<T = CommonChartProps> = (props: T) => any;

// Types for specific chart variations
export interface XYChartProps extends CommonChartProps {
  stack?: boolean;
  smooth?: boolean;
  showSymbol?: boolean;
  showArea?: boolean;
  symbolSize?: number;
}

export interface PieChartProps extends CommonChartProps {
  valueKey?: string;
  nameKey?: string;
  innerRadius?: number | string;
  roseType?: boolean | 'radius' | 'area';
}

export interface RadarChartProps extends CommonChartProps {
  indicator?: Array<{
    name: string;
    max?: number;
  }>;
  shape?: 'polygon' | 'circle';
}

export interface TreeChartProps extends CommonChartProps {
  rootName?: string;
  layout?: 'orthogonal' | 'radial';
  orient?: 'LR' | 'RL' | 'TB' | 'BT';
}

export interface HeatmapChartProps extends CommonChartProps {
  valueKey?: string;
  xCategories?: string[];
  yCategories?: string[];
}

export interface SankeyChartProps extends CommonChartProps {
  nodes?: any[];
  links?: any[];
}

export interface FunnelChartProps extends CommonChartProps {
  sort?: 'ascending' | 'descending' | 'none';
  gap?: number;
}

export interface GaugeChartProps extends CommonChartProps {
  min?: number;
  max?: number;
  splitNumber?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface GraphChartProps extends CommonChartProps {
  nodes?: any[];
  links?: any[];
  layout?: 'none' | 'circular' | 'force';
}

export interface Map3DChartProps extends CommonChartProps {
  mapUrl?: string;
  mapName?: string;
  projection?: string;
}

// Define a type for chart factory functions
export type ChartFactory<T = CommonChartProps> = (props: T) => JSX.Element; 