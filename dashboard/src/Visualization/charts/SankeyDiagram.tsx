import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Sankey Diagram Component
 * Renders a simplified sankey diagram visualization for flow data
 */
const SankeyDiagram: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Extract nodes and links counts if available
  const nodeCount = options?.nodes?.length || 0;
  const linkCount = options?.links?.length || data.length;
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {options?.title || 'Sankey Diagram'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Sankey Diagram Visualization Placeholder
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {nodeCount} nodes with {linkCount} flow connections
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SankeyDiagram; 