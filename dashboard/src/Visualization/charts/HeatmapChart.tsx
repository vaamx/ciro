import React from 'react';
import { motion } from 'framer-motion';
import { VisualizationProps } from '../index';

/**
 * Heatmap Chart Component
 * Renders a heatmap visualization
 */
const HeatmapChart: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options
}) => {
  // For now, render a placeholder with the data stats
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Check if data has the expected format for a heatmap
  const isValidHeatmapData = Array.isArray(data) && data.length > 0 && Array.isArray(data[0]);
  
  if (!isValidHeatmapData) {
    return (
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
        style={{ width: chartWidth, height: chartHeight }}
      >
        <div className="flex flex-col h-full">
          <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {options?.title || 'Heatmap Chart'}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                Invalid heatmap data format
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Calculate columns for grid layout
  const cols = data[0].length;
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700" 
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {options?.title || 'Heatmap Chart'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
            }}
          >
            {data.map((row: number[], rowIndex: number) =>
              row.map((value: number, colIndex: number) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="aspect-square rounded"
                  style={{
                    backgroundColor: `rgba(147, 51, 234, ${value})`,
                    transition: 'background-color 0.3s ease'
                  }}
                  title={`Value: ${value}`}
                />
              ))
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart; 