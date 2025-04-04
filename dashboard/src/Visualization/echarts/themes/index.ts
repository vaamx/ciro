/**
 * ECharts Theme Manager
 * 
 * This file handles the registration and management of themes for ECharts.
 * Simplified to only support Light and Dark modes.
 */
import * as echarts from 'echarts/core';

// Track registered themes to avoid duplicate registration
let themesRegistered = false;

// Define the dark theme
const darkTheme = {
  color: [
    '#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9',
    '#05c091', '#ff9f7f', '#9d96f5', '#8378ea'
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

// Register all themes with ECharts
export function registerThemes(): void {
  // Only register themes once to avoid duplicate registrations
  if (themesRegistered) {
    console.log('Themes already registered, skipping registration');
    return;
  }

  try {
    // Register built-in 'dark' theme
    echarts.registerTheme('dark', darkTheme);
    
    // Mark themes as registered
    themesRegistered = true;
    
    console.log('Successfully registered ECharts themes: light, dark');
  } catch (error) {
    console.error('Failed to load ECharts themes:', error);
  }
}

/**
 * Get a list of all available themes
 */
export function getAvailableThemes(): string[] {
  // Always ensure themes are registered when getting available themes
  if (!themesRegistered) {
    registerThemes();
  }
  
  return ['light', 'dark']; // Only light and dark themes
}

/**
 * Apply a theme to an ECharts instance
 */
export function applyTheme(chart: any, theme: string): void {
  if (!chart) return;
  
  try {
    // Store current options
    const currentOption = chart.getOption();
    
    // Dispose the current instance
    chart.dispose();
    
    // Create a new instance with the desired theme
    const newChart = echarts.init(chart.getDom(), theme);
    
    // Apply the stored options
    newChart.setOption(currentOption);
    
    // Don't return anything since function is declared to return void
  } catch (error) {
    console.error('Error applying theme:', error);
  }
}

// Register themes immediately when this module is imported
registerThemes();

export default {
  registerThemes,
  getAvailableThemes,
  applyTheme
}; 