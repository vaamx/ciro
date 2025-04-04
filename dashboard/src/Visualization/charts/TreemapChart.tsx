import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Treemap Chart Component
 * Renders a simplified treemap chart visualization for hierarchical data
 */
const TreemapChart: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Calculate depth of hierarchy if available
  const calculateDepth = (data: any) => {
    if (!data || !Array.isArray(data)) return 1;
    
    let maxDepth = 0;
    for (const item of data) {
      if (item.children && Array.isArray(item.children)) {
        const childDepth = 1 + calculateDepth(item.children);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }
    return maxDepth || 1;
  };
  
  const hierarchyDepth = calculateDepth(data);
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {options?.title || 'Treemap Chart'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Treemap Chart Visualization Placeholder
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {data.length} data items with hierarchy depth of {hierarchyDepth}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreemapChart; 