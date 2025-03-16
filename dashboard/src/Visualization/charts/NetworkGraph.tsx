import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Network Graph Component
 * Renders a simplified network/graph visualization
 */
const NetworkGraph: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Extract nodes and edges counts if available
  const nodeCount = options?.nodes?.length || data.filter(item => item.type === 'node').length || data.length;
  const edgeCount = options?.edges?.length || data.filter(item => item.type === 'edge').length || 0;
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {options?.title || 'Network Graph'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Network Graph Visualization Placeholder
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {nodeCount} nodes and {edgeCount} edges
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkGraph; 