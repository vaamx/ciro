import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Animated Chart Component
 * Renders a simplified animated chart visualization
 */
const AnimatedChart: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Extract frames and base type if available
  const frameCount = options?.frames?.length || 1;
  const baseType = options?.baseType || 'bar_chart';
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {options?.title || 'Animated Chart'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Animated {baseType.replace('_chart', '').charAt(0).toUpperCase() + baseType.replace('_chart', '').slice(1)} Chart Placeholder
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {data.length} data points with {frameCount} animation frame{frameCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedChart; 