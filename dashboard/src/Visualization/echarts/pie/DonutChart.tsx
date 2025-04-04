import React from 'react';
import PieChart from './PieChart';
import { PieChartProps } from '../types';

/**
 * Donut Chart Component using ECharts
 * 
 * This component is a specialized variant of PieChart with inner radius enabled by default
 */
const DonutChart: React.FC<PieChartProps> = (props) => {
  const { innerRadius = '50%', ...rest } = props;
  
  return (
    <PieChart
      {...rest}
      innerRadius={innerRadius}
    />
  );
};

export default DonutChart; 