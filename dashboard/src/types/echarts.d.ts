declare module 'echarts/core';

declare module 'echarts-for-react' {
  import { Component } from 'react';
  import * as echarts from 'echarts/core';

  export interface EChartsReactProps {
    option: any;
    notMerge?: boolean;
    lazyUpdate?: boolean;
    style?: React.CSSProperties;
    className?: string;
    theme?: string;
    onEvents?: Record<string, Function>;
    opts?: {
      renderer?: 'canvas' | 'svg';
      width?: number | string | 'auto';
      height?: number | string | 'auto';
      devicePixelRatio?: number;
    };
    showLoading?: boolean;
    loadingOption?: object;
    onChartReady?: (instance: any) => void;
    echarts?: any;
  }

  export default class ReactECharts extends Component<EChartsReactProps> {}
}

// Extend the Window interface to add any properties we might need
interface Window {
  // Add any global ECharts properties here if needed
  echartsInstance?: any;
  dashboardContext?: any;
} 