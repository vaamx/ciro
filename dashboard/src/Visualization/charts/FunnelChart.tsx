import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Funnel Chart Component
 * Renders a simplified funnel chart visualization
 */
const FunnelChart: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  xKey = 'stage',
  yKey = 'value',
  series,
  labels,
  options = {}
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Calculate total value and conversion rates if available
  const totalValue = data.reduce((sum, item) => sum + (item[yKey] || 0), 0);
  const stageNames = data.map(item => item[xKey] || 'Unnamed Stage');
  
  // Use series data if provided, otherwise use single series from data
  const seriesData = series?.length ? series : [{ dataKey: yKey, name: yKey }];
  
  // Get custom colors from options or use defaults
  const colors = options.colors || ['#9333EA', '#A855F7', '#C084FC', '#D8B4FE', '#F0ABFC'];
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {labels?.title || 'Funnel Chart'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4 w-full">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Funnel Chart Visualization Placeholder
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              {data.length} stages in funnel
            </p>
            
            {/* Simple funnel shape visualization */}
            <div className="flex flex-col items-center gap-1 mx-auto max-w-sm">
              {data.map((item, index) => {
                const percentage = (item[yKey] / totalValue * 100).toFixed(1);
                const width = 100 - (index * (80 / data.length)); // Gradually decrease width
                
                return (
                  <div
                    key={index}
                    className="relative transition-all duration-200 hover:opacity-90"
                    style={{
                      width: `${width}%`,
                      backgroundColor: colors[index % colors.length],
                      height: '32px',
                      clipPath: 'polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%)'
                    }}
                    title={`${item[xKey]}: ${item[yKey]} (${percentage}%)`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                      {item[xKey]}: {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              <p>Total {yKey}: {totalValue}</p>
              <p>Stages: {stageNames.join(' → ')}</p>
              <p>Series: {seriesData.map(s => s.name).join(', ')}</p>
              {options.showPercentages && (
                <p>Showing conversion percentages</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunnelChart; 