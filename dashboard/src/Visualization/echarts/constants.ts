/**
 * ECharts Constants
 * 
 * This file contains constants for the ECharts implementation
 */

// Color palettes
export const LIGHT_COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', 
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'
];

export const DARK_COLORS = [
  '#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9',
  '#05c091', '#ff9f7f', '#9d96f5', '#8378ea'
];

// Default options
export const DEFAULT_GRID = {
  containLabel: true,
  left: '3%',
  right: '4%',
  bottom: '3%',
  top: '8%'
};

export const DEFAULT_ANIMATION = {
  animationEasing: 'elasticOut',
  animationDelayUpdate: (idx: number) => idx * 5
};

// Chart type definitions for TypeScript
export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  SCATTER = 'scatter',
  RADAR = 'radar',
  HEATMAP = 'heatmap',
  TREE = 'tree',
  TREEMAP = 'treemap',
  SUNBURST = 'sunburst',
  BOXPLOT = 'boxplot',
  CANDLESTICK = 'candlestick',
  FUNNEL = 'funnel',
  GAUGE = 'gauge',
  GRAPH = 'graph',
  MAP = 'map',
  PARALLEL = 'parallel',
  SANKEY = 'sankey',
  THEMERIVER = 'themeRiver',
  CUSTOM = 'custom'
}

// Tooltip settings
export const DEFAULT_TOOLTIP = {
  trigger: 'axis',
  axisPointer: {
    type: 'shadow'
  }
};

export const ITEM_TOOLTIP = {
  trigger: 'item'
};

// Legend settings
export const DEFAULT_LEGEND = {
  type: 'scroll',
  orient: 'horizontal',
  bottom: 0,
  padding: [5, 10]
};

// Responsive breakpoints
export const BREAKPOINTS = {
  small: 576,
  medium: 768,
  large: 992,
  xlarge: 1200
};

// Default style for charts
export const DEFAULT_CONTAINER_STYLE = {
  minHeight: '300px',
  height: '100%',
  width: '100%'
};

// Export functions to create common chart elements

/**
 * Creates a basic axis configuration
 */
export function createAxis(name: string, options: any = {}) {
  return {
    name,
    nameLocation: 'middle',
    nameGap: 25,
    nameTextStyle: {
      fontWeight: 'bold'
    },
    axisLine: {
      lineStyle: {
        width: 1
      }
    },
    axisTick: {
      alignWithLabel: true
    },
    ...options
  };
}

/**
 * Helper to create a dataset from raw data
 */
export function createDataset(data: any[], options: any = {}) {
  return {
    source: data,
    ...options
  };
} 