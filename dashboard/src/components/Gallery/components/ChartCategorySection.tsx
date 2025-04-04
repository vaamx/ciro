import React from 'react';
import { ChartCategory, ChartConfig } from '../data/chartConfigs';
import { ChartCard } from './ChartCard';

interface ChartCategorySectionProps {
  category: ChartCategory;
  filteredCharts: ChartConfig[];
  theme: string;
  onSelectChart: (chart: ChartConfig) => void;
  onZoomChart: (chart: ChartConfig) => void;
  chartConfig?: any;
}

/**
 * Component for displaying a category section with its charts in the gallery
 */
export const ChartCategorySection: React.FC<ChartCategorySectionProps> = ({
  category,
  filteredCharts,
  theme,
  onSelectChart,
  onZoomChart,
  chartConfig
}) => {
  if (filteredCharts.length === 0) {
    return null;
  }

  return (
    <div 
      id={`section-${category.id}`}
      className="mb-10 pb-4 section-container"
    >
      <h2 className="flex items-center text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <category.icon className="w-6 h-6 mr-2" />
        {category.name}
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCharts.map(chart => (
          <ChartCard 
            key={chart.id}
            chart={chart}
            theme={theme}
            onSelect={onSelectChart}
            onZoom={onZoomChart}
            chartConfig={chartConfig}
          />
        ))}
      </div>
    </div>
  );
}; 