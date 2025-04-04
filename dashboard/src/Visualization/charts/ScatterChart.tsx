import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Scatter Chart Component
 * Renders a simplified scatter chart visualization
 */
const ScatterChart: React.FC<VisualizationProps> = ({
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
  const pointSize = options.pointSize || 3;
  const showConnectingLines = options.showConnectingLines ?? false;
  
  // Calculate chart dimensions and scales
  const padding = 40;
  const chartWidth100 = 100 - (padding * 2);
  const chartHeight100 = 100 - (padding * 2);
  
  // Get min/max values for scaling
  const allXValues = data.map(item => parseFloat(item[xKey]) || 0);
  const allYValues = data.map(item => parseFloat(item[yKey]) || 0);
  const xMin = Math.min(...allXValues);
  const xMax = Math.max(...allXValues);
  const yMin = Math.min(...allYValues);
  const yMax = Math.max(...allYValues);
  
  // Scale values to chart coordinates
  const scaleX = (value: number) => {
    const range = xMax - xMin;
    const scaled = ((value - xMin) / range) * chartWidth100;
    return scaled + padding;
  };
  
  const scaleY = (value: number) => {
    const range = yMax - yMin;
    const scaled = ((value - yMin) / range) * chartHeight100;
    return 100 - (scaled + padding); // Invert Y axis
  };
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {labels?.title || 'Scatter Chart'}
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
                      key={`grid-y-${i}`}
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
                {Array.from({ length: 5 }).map((_, i) => {
                  const x = padding + (i * (chartWidth100 / 4));
                  return (
                    <line
                      key={`grid-x-${i}`}
                      x1={x}
                      y1={padding}
                      x2={x}
                      y2={100 - padding}
                      stroke="#E5E7EB"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                      className="dark:stroke-gray-700"
                    />
                  );
                })}
                
                {/* Data points for each series */}
                {seriesData.map((s, seriesIndex) => {
                  const color = s.color || colors[seriesIndex % colors.length];
                  const points = data.map(item => ({
                    x: scaleX(parseFloat(item[s.dataKey || xKey]) || 0),
                    y: scaleY(parseFloat(item[yKey]) || 0)
                  }));
                  
                  return (
                    <g key={s.dataKey} className="transition-all duration-300">
                      {/* Connecting lines */}
                      {showConnectingLines && points.length > 1 && (
                        <path
                          d={`M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`}
                          fill="none"
                          stroke={color}
                          strokeWidth="1"
                          strokeOpacity="0.3"
                        />
                      )}
                      
                      {/* Points */}
                      {points.map((point, i) => (
                        <g key={i}>
                          <title>{`(${data[i][xKey]}, ${data[i][yKey]})`}</title>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={pointSize}
                            fill={color}
                            className="transition-all duration-300 hover:r-4"
                          />
                        </g>
                      ))}
                    </g>
                  );
                })}
              </svg>
              
              {/* Axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-8 text-xs text-gray-500 dark:text-gray-400">
                <div>{xMin.toFixed(1)}</div>
                <div>{xMax.toFixed(1)}</div>
              </div>
              <div className="absolute top-0 bottom-0 left-2 flex flex-col justify-between py-8 text-xs text-gray-500 dark:text-gray-400">
                <div>{yMax.toFixed(1)}</div>
                <div>{yMin.toFixed(1)}</div>
              </div>
            </div>
            
            <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              <p>{data.length} data points across {seriesData.length} series</p>
              <p>X Range: {xMin.toFixed(1)} to {xMax.toFixed(1)}</p>
              <p>Y Range: {yMin.toFixed(1)} to {yMax.toFixed(1)}</p>
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

export default ScatterChart; 