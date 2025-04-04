import React from 'react';
import LineChart from './LineChart';
import { XYChartProps } from '../types';

/**
 * Area Chart Component using ECharts
 * 
 * This component is a specialized variant of LineChart with area filling enabled by default
 */
const AreaChart: React.FC<XYChartProps> = (props) => {
  return (
    <LineChart
      {...props}
      showArea={true}
    />
  );
};

export default AreaChart; 