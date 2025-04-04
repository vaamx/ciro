import React from 'react';
import { Maximize2, Tag } from 'lucide-react';
import { ChartConfig } from '../data/chartConfigs';
import { ChartRenderer } from './ChartRenderer';

interface ChartCardProps {
  chart: ChartConfig;
  theme: string;
  onSelect: (chart: ChartConfig) => void;
  onZoom: (chart: ChartConfig) => void;
  chartConfig?: any; // Add chartConfig prop
}

/**
 * Card component for displaying charts in the gallery grid
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  chart,
  theme,
  onSelect,
  onZoom,
  chartConfig
}) => {
  // Determine height based on chart type
  const getChartContainerHeight = () => {
    // Special handling for enhanced area chart
    if (chart.id === 'enhanced-area-chart') {
      return '280px'; // Reduced height for enhanced area chart
    }
    
    // Special handling for YoY comparison bar chart
    if (chart.id === 'yoy-comparison-bar-chart') {
      return '300px'; // Reduced height for YoY comparison chart
    }
    
    // Default height
    return '300px';
  };

  // Determine container class based on chart type
  const getContainerClass = () => {
    if (chart.id === 'enhanced-area-chart') {
      return 'h-[320px] p-2';
    }
    
    if (chart.id === 'yoy-comparison-bar-chart') {
      return 'h-[320px] p-0'; // No padding for YoY comparison chart
    }
    
    return 'h-[340px] p-4';
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={() => onSelect(chart)}
    >
      <div className={`${getContainerClass()} bg-gray-50 dark:bg-gray-900 flex items-center justify-center relative overflow-hidden`}>
        <div style={{ 
          width: '100%', 
          height: getChartContainerHeight(),
          margin: (chart.id === 'enhanced-area-chart' || chart.id === 'yoy-comparison-bar-chart') ? 0 : undefined,
          overflow: 'hidden'
        }}>
          <ChartRenderer 
            chartConfig={chart} 
            theme={theme} 
            isPreview={true} 
            customConfig={chartConfig}
          />
        </div>
        <button 
          className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none z-10 focus:ring-2 focus:ring-blue-500 group"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering card click
            onZoom(chart);
          }}
          title="Zoom chart"
          aria-label="Expand visualization"
        >
          <Maximize2 size={16} className="text-gray-700 dark:text-gray-300" />
          <span className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -mt-10 left-1/2 transform -translate-x-1/2 w-max">
            Zoom chart
          </span>
        </button>
      </div>
      
      <div className="p-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {chart.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
          {chart.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mt-3">
          {chart.tags.slice(0, 3).map((tag) => (
            <span 
              key={tag} 
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}; 