import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Area Chart Component
 * Renders a simplified area chart visualization
 */
const AreaChart: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  xKey = 'x',
  yKey = 'y',
  series,
  labels,
  options = {}
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Use series data if provided, otherwise use single series from data
  const seriesData = series?.length ? series : [{ dataKey: yKey, name: yKey }];
  
  // Get custom colors and other options
  const colors = options.colors || ['#9333EA', '#A855F7', '#C084FC'];
  const showGradient = options.showGradient ?? true;
  const smoothCurve = options.smoothCurve ?? true;
  
  // Calculate chart dimensions and scales
  const padding = 40;
  const chartWidth100 = 100 - (padding * 2);
  const chartHeight100 = 100 - (padding * 2);
  
  // Get min/max values for scaling
  const allValues = data.map(item => item[yKey] || 0);
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);
  
  // Create points for the area
  const createAreaPath = (values: number[]) => {
    if (values.length < 2) return '';
    
    const points: Array<[number, number]> = [];
    const step = chartWidth100 / (values.length - 1);
    
    // Scale value to chart height
    const scaleY = (value: number) => {
      const range = maxValue - minValue;
      const scaled = ((value - minValue) / range) * chartHeight100;
      return 100 - (scaled + padding); // Invert Y axis
    };
    
    // Create points array
    values.forEach((value, index) => {
      const x = padding + (index * step);
      const y = scaleY(value);
      points.push([x, y]);
    });
    
    if (smoothCurve) {
      // Create smooth curve using cubic bezier
      let path = `M ${points[0][0]},${points[0][1]}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const midX = (current[0] + next[0]) / 2;
        
        path += ` C ${midX},${current[1]} ${midX},${next[1]} ${next[0]},${next[1]}`;
      }
      
      // Add bottom corners for area
      const lastX = padding + chartWidth100;
      path += ` L ${lastX},${100 - padding}`; // Bottom right
      path += ` L ${padding},${100 - padding}`; // Bottom left
      path += ' Z'; // Close path
      
      return path;
    } else {
      // Create straight lines
      let path = `M ${points[0][0]},${points[0][1]}`;
      
      // Add line to each point
      points.slice(1).forEach(point => {
        path += ` L ${point[0]},${point[1]}`;
      });
      
      // Add bottom corners for area
      const lastX = padding + chartWidth100;
      path += ` L ${lastX},${100 - padding}`; // Bottom right
      path += ` L ${padding},${100 - padding}`; // Bottom left
      path += ' Z'; // Close path
      
      return path;
    }
  };
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {labels?.title || 'Area Chart'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center w-full">
            <div className="relative w-full max-w-2xl mx-auto aspect-[2/1]">
              {/* Chart SVG */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Grid lines */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = padding + (i * (chartHeight100 / 4));
                  return (
                    <line
                      key={`grid-${i}`}
                      x1={padding}
                      y1={y}
                      x2={100 - padding}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                      className="dark:stroke-gray-700"
                    />
                  );
                })}
                
                {/* Area for each series */}
                {seriesData.map((s, index) => {
                  const seriesValues = data.map(item => item[s.dataKey] || 0);
                  const color = s.color || colors[index % colors.length];
                  
                  return (
                    <g key={s.dataKey}>
                      {/* Gradient definition */}
                      {showGradient && (
                        <defs>
                          <linearGradient id={`gradient-${index}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                          </linearGradient>
                        </defs>
                      )}
                      
                      {/* Area shape */}
                      <path
                        d={createAreaPath(seriesValues)}
                        fill={showGradient ? `url(#gradient-${index})` : 'none'}
                        stroke={color}
                        strokeWidth="1"
                        className="transition-all duration-300"
                      />
                    </g>
                  );
                })}
              </svg>
              
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-8 text-xs text-gray-500 dark:text-gray-400">
                {data.slice(0, 5).map((item, index) => (
                  <div key={index} className="transform -translate-x-1/2">
                    {item[xKey]}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              <p>{data.length} data points across {seriesData.length} series</p>
              <p>Range: {minValue} to {maxValue}</p>
              <p>Series: {seriesData.map(s => s.name).join(', ')}</p>
              {options.showLegend && (
                <p>Legend visible</p>
              )}
              <p>Curve: {smoothCurve ? 'Smooth' : 'Linear'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaChart; 