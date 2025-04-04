import React, { useMemo, useEffect, useRef } from 'react';
import { getEchartsInstance } from '../../services/echartsService';
import { registerThemes } from './themes';

// Ensure themes are registered
registerThemes();

export interface BaseChartProps {
  option: any;
  style?: React.CSSProperties;
  className?: string;
  theme?: 'light' | 'dark';  // Simplified to only light and dark
  notMerge?: boolean;
  lazyUpdate?: boolean;
  loading?: boolean;
  loadingOption?: object;
  optsConfig?: {
    renderer?: 'canvas' | 'svg';
    width?: number | string | 'auto';
    height?: number | string | 'auto';
    devicePixelRatio?: number;
  };
  showLoading?: boolean;
  onEvents?: Record<string, Function>;
  onChartReady?: (instance: any) => void;
}

/**
 * Base Chart Component for ECharts
 * This component serves as the foundation for all ECharts visualizations
 */
const BaseChart: React.FC<BaseChartProps> = React.memo(({
  option,
  style = {},
  className = '',
  theme = 'light',
  notMerge = false,
  lazyUpdate = false,
  loading = false,
  loadingOption = {},
  optsConfig = {},
  onEvents = {},
  onChartReady
}) => {
  const echarts = getEchartsInstance();
  const chartInstanceRef = useRef<any>(null);
  // Create a ref to hold the div element
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // Track previous theme to prevent unnecessary redraws
  const prevThemeRef = useRef<string>(theme);
  // Track render count
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  
  // Only log once at startup
  useEffect(() => {
    // Log only on first render, then never again
    console.log('BaseChart initialized, theme:', theme);
  }, []);
  
  const defaultStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    minHeight: '300px',
    ...style
  };
  
  const opts = useMemo(() => ({
    renderer: 'canvas' as 'canvas' | 'svg',
    width: 'auto',
    height: 'auto',
    devicePixelRatio: window.devicePixelRatio,
    ...optsConfig
  }), [optsConfig]);
  
  // Handle theme changes - only when theme changes between light and dark
  useEffect(() => {
    try {
      // Only process if chart exists and theme actually changed
      if (chartInstanceRef.current && prevThemeRef.current !== theme) {
        console.log('Applied theme:', theme);
        prevThemeRef.current = theme;
        
        // Resize to refresh rendering with new theme only if the instance exists
        // and has not been disposed
        setTimeout(() => {
          if (chartInstanceRef.current && typeof chartInstanceRef.current.resize === 'function') {
            try {
              chartInstanceRef.current.resize();
            } catch (resizeError) {
              // Instance might have been disposed between the check and the resize call
              console.warn('[ECharts] Resize failed, chart may have been disposed');
            }
          }
        }, 20);
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, [theme]);
  
  // Initialize the chart when component mounts
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Initialize the chart instance
    const chartInstance = echarts.init(chartContainerRef.current, theme, opts);
    chartInstanceRef.current = chartInstance;
    
    // Set options
    chartInstance.setOption(option, notMerge, lazyUpdate);
    
    // Handle events
    Object.keys(onEvents || {}).forEach(eventName => {
      const handler = onEvents[eventName];
      if (typeof handler === 'function') {
        // Cast the handler to any to avoid TypeScript error
        chartInstance.on(eventName, handler as any);
      }
    });
    
    // Call onChartReady
    if (onChartReady) {
      onChartReady(chartInstance);
    }
    
    // Handle loading state
    if (loading) {
      chartInstance.showLoading(loadingOption);
    } else {
      chartInstance.hideLoading();
    }
    
    // Cleanup on unmount
    return () => {
      if (chartInstance && !chartInstance.isDisposed()) {
        // Remove event handlers
        Object.keys(onEvents || {}).forEach(eventName => {
          const handler = onEvents[eventName];
          if (typeof handler === 'function') {
            chartInstance.off(eventName, handler as any);
          }
        });
        
        // Dispose the chart
        chartInstance.dispose();
      }
    };
  }, [option, theme, notMerge, lazyUpdate, loading, loadingOption, onChartReady]);
  
  // Update the chart when option changes
  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.setOption(option, notMerge, lazyUpdate);
    }
  }, [option, notMerge, lazyUpdate]);
  
  // Update loading state when it changes
  useEffect(() => {
    if (chartInstanceRef.current) {
      if (loading) {
        chartInstanceRef.current.showLoading(loadingOption);
      } else {
        chartInstanceRef.current.hideLoading();
      }
    }
  }, [loading, loadingOption]);
  
  return (
    <div 
      className={`echarts-container ${className || ''}`} 
      style={defaultStyle}
      ref={chartContainerRef}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Compare theme, loading, style
  if (prevProps.theme !== nextProps.theme ||
      prevProps.loading !== nextProps.loading) {
    return false; // Different, so re-render
  }
  
  // Deep compare style if it exists
  if (prevProps.style || nextProps.style) {
    // If one exists and the other doesn't, they're different
    if (!prevProps.style || !nextProps.style) {
      return false;
    }
    
    // Compare important style properties
    const prevKeys = Object.keys(prevProps.style);
    const nextKeys = Object.keys(nextProps.style);
    
    if (prevKeys.length !== nextKeys.length) {
      return false;
    }
    
    // Check for deep equality of important style properties only
    const importantProps = ['width', 'height', 'minWidth', 'minHeight'];
    for (const key of importantProps) {
      // Use type assertion to fix the TypeScript error
      if ((prevProps.style as Record<string, any>)[key] !== 
          (nextProps.style as Record<string, any>)[key]) {
        return false;
      }
    }
  }
  
  // Shallow compare for option - only check if references have changed
  // If it's a controlled component, parent should provide stable references
  if (prevProps.option !== nextProps.option) {
    // For options, we'll do a smarter comparison 
    // to only re-render if relevant parts changed
    
    // If series data changed, we need to re-render
    const prevData = prevProps.option?.series?.[0]?.data;
    const nextData = nextProps.option?.series?.[0]?.data;
    
    // If data references are different, need to re-render
    if (prevData !== nextData) {
      return false;
    }
    
    // Check if important option properties changed (title, colors, etc.)
    // Compare only top-level keys for performance
    const importantOptions = ['title', 'color', 'legend', 'tooltip', 'grid'];
    for (const key of importantOptions) {
      if (prevProps.option?.[key] !== nextProps.option?.[key]) {
        return false;
      }
    }
  }
  
  // No meaningful differences found, avoid re-render
  return true;
});

export default BaseChart; 