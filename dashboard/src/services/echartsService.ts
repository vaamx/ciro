/**
 * ECharts Service
 * 
 * This service provides utilities for working with Apache ECharts throughout the application
 * Simplified to only support Light and Dark themes
 */
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, PieChart, ScatterChart, CustomChart, RadarChart, EffectScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  MarkPointComponent,
  MarkLineComponent,
  GraphicComponent
} from 'echarts/components';

// Register the required components
echarts.use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  CustomChart,
  RadarChart,
  EffectScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  MarkPointComponent,
  MarkLineComponent,
  GraphicComponent
]);

// Register themes, custom renderers, etc.
export function initializeECharts(): void {
  // Register dark mode theme
  const darkTheme = {
    color: [
      '#5470c6',
      '#91cc75',
      '#fac858',
      '#ee6666',
      '#73c0de',
      '#3ba272',
      '#fc8452',
      '#9a60b4',
      '#ea7ccc'
    ],
    backgroundColor: '#0f172a',
    textStyle: {
      color: '#e2e8f0'
    },
    title: {
      textStyle: {
        color: '#e2e8f0'
      }
    },
    legend: {
      textStyle: {
        color: '#e2e8f0'
      }
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: {
        color: '#e2e8f0'
      }
    },
    axisPointer: {
      lineStyle: {
        color: '#475569'
      },
      crossStyle: {
        color: '#475569'
      }
    },
    xAxis: {
      axisLine: {
        lineStyle: {
          color: '#475569'
        }
      },
      axisTick: {
        lineStyle: {
          color: '#475569'
        }
      },
      axisLabel: {
        color: '#cbd5e1'
      },
      splitLine: {
        lineStyle: {
          color: ['#334155']
        }
      }
    },
    yAxis: {
      axisLine: {
        lineStyle: {
          color: '#475569'
        }
      },
      axisTick: {
        lineStyle: {
          color: '#475569'
        }
      },
      axisLabel: {
        color: '#cbd5e1'
      },
      splitLine: {
        lineStyle: {
          color: ['#334155']
        }
      }
    }
  };

  echarts.registerTheme('dark', darkTheme);
  console.log('Registered dark theme for ECharts');

  // Add echarts to window for debugging purposes
  if (typeof window !== 'undefined') {
    (window as any).echartsInstance = echarts;
  }
}

// Initialize ECharts
if (typeof window !== 'undefined') {
  initializeECharts();
}

// Export utility functions
export function getEchartsInstance(): typeof echarts {
  return echarts;
}

// Export some common chart options creators

/**
 * Creates a tooltip configuration with consistent styling
 */
export function createTooltip(options: any = {}) {
  // Detect if theme is available in options, default to light
  const theme = options.theme || 'light';
  const isDark = theme === 'dark';
  
  return {
    trigger: 'item',
    backgroundColor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    borderColor: isDark ? '#444' : '#e2e8f0',
    borderWidth: 1,
    padding: [8, 10],
    textStyle: {
      color: isDark ? '#eee' : '#334155',
    },
    ...options
  };
}

/**
 * Creates a legend configuration with consistent styling
 */
export function createLegend(options: any = {}) {
  return {
    type: 'scroll',
    orient: 'horizontal',
    bottom: 0,
    padding: [0, 10, 5, 10],
    itemGap: 20,
    itemWidth: 14,
    itemHeight: 14,
    textStyle: {
      fontSize: 12,
    },
    ...options
  };
}

/**
 * Creates a title configuration with consistent styling
 */
export function createTitle(text: string, options: any = {}) {
  return {
    text,
    left: 'center',
    textStyle: {
      fontWeight: 'bold',
      fontSize: 16,
    },
    padding: [10, 10, 20, 10],
    ...options
  };
}

// Export chart type specific utilities
export const utils = {
  // Add more utility functions as needed
  formatNumber: (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  }
};

export default {
  getEchartsInstance,
  createTooltip,
  createLegend,
  createTitle,
  utils
}; 