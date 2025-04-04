import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Radar/Spider Chart Component
 * Renders a simplified radar chart visualization
 */
const RadarChart: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  xKey = 'axis',
  yKey = 'value',
  series,
  labels,
  options = {}
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Extract axis labels and values
  const axes = data.map(item => item[xKey] || 'Unnamed Axis');
  const values = data.map(item => {
    const val = parseFloat(item[yKey]);
    return isNaN(val) ? 0 : val; // Ensure we only have valid numbers
  });
  const maxValue = Math.max(...values, 0.1); // Ensure we never divide by zero
  
  // Use series data if provided, otherwise use single series from data
  const seriesData = series?.length ? series : [{ dataKey: yKey, name: yKey }];
  
  // Get custom colors and other options
  const colors = options.colors || ['#9333EA', '#A855F7', '#C084FC'];
  const axisCount = axes.length;
  const rings = options.rings || 4;
  
  // Calculate points for the radar shape
  const calculatePoint = (index: number, value: number, maxValue: number) => {
    // Additional safety check
    if (isNaN(value) || isNaN(maxValue) || maxValue === 0) {
      console.warn('Invalid value in RadarChart:', { index, value, maxValue });
      return '0,0'; // Return origin point as fallback
    }
    
    const angle = (index / axisCount) * 2 * Math.PI - Math.PI / 2;
    const radius = (value / maxValue) * 100;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    
    // Final safety check before returning coordinates
    if (isNaN(x) || isNaN(y)) {
      console.warn('NaN coordinates in RadarChart:', { index, value, maxValue, x, y });
      return '0,0';
    }
    
    return `${x},${y}`;
  };
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {labels?.title || 'Radar Chart'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center w-full">
            <div className="relative w-full max-w-sm mx-auto aspect-square">
              {/* Background rings */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Axis lines */}
                {axes.map((_, index) => (
                  <line
                    key={`axis-${index}`}
                    x1="50"
                    y1="50"
                    x2={calculatePoint(index, 100, 100).split(',')[0]}
                    y2={calculatePoint(index, 100, 100).split(',')[1]}
                    stroke="#E5E7EB"
                    strokeWidth="0.5"
                    className="dark:stroke-gray-700"
                  />
                ))}
                
                {/* Concentric rings */}
                {Array.from({ length: rings }).map((_, i) => {
                  const radius = ((i + 1) / rings) * 100;
                  return (
                    <circle
                      key={`ring-${i}`}
                      cx="50"
                      cy="50"
                      r={radius / 2}
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="0.5"
                      className="dark:stroke-gray-700"
                    />
                  );
                })}
                
                {/* Data polygon */}
                <polygon
                  points={values.length > 0 ? values.map((value, index) => 
                    calculatePoint(index, value, maxValue)
                  ).join(' ') : '0,0'}
                  fill={`${colors[0]}33`}
                  stroke={colors[0]}
                  strokeWidth="1"
                />
              </svg>
              
              {/* Axis labels */}
              {axes.map((axis, index) => {
                const point = calculatePoint(index, 115, 100).split(',');
                return (
                  <div
                    key={`label-${index}`}
                    className="absolute text-xs text-gray-500 dark:text-gray-400 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${point[0]}%`,
                      top: `${point[1]}%`
                    }}
                  >
                    {axis}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              <p>{axisCount} axes with {seriesData.length} series</p>
              <p>Max value: {maxValue}</p>
              <p>Series: {seriesData.map(s => s.name).join(', ')}</p>
              {options.showLegend && (
                <p>Legend visible</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RadarChart; 