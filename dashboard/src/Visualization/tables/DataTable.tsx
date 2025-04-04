import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Data Table Component
 * Renders a simple data table visualization
 */
const DataTable: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options
}) => {
  // For now, render a placeholder with the data stats
  const tableHeight = typeof height === 'number' ? `${height}px` : height;
  const tableWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Get column headers from the first item
  const columns = data && data.length > 0 ? Object.keys(data[0]).slice(0, 5) : [];
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-auto" 
      style={{ width: tableWidth, height: tableHeight }}
    >
      <div className="flex flex-col h-full">
        <div className="text-center text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {options?.title || 'Data Table'}
        </div>
        
        {data.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th 
                      key={index}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.slice(0, 10).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}>
                    {columns.map((column, colIndex) => (
                      <td key={colIndex} className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        {String(row[column]).substring(0, 50)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {data.length > 10 && (
              <div className="text-center text-xs text-gray-500 mt-2 p-1">
                Showing 10 of {data.length} rows
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-gray-500 dark:text-gray-400">
                No data available
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataTable; 