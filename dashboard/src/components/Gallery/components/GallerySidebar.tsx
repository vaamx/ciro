import React from 'react';
import { Palette, Search } from 'lucide-react';
import { ChartCategory } from '../data/chartConfigs';

interface GallerySidebarProps {
  categories: ChartCategory[];
  selectedCategoryId: string;
  searchTerm: string;
  onCategorySelect: (categoryId: string) => void;
  onSearchChange: (term: string) => void;
}

/**
 * Sidebar component with filters and categories for the visualization gallery
 */
export const GallerySidebar: React.FC<GallerySidebarProps> = ({
  categories,
  selectedCategoryId,
  searchTerm,
  onCategorySelect,
  onSearchChange
}) => {
  return (
    <div className="w-full lg:w-1/6 xl:w-[12%] border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-3">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">Visualization Gallery</h1>
        <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
          Discover ECharts visualizations by type
        </p>
        
        <div className="relative w-full my-3">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search visualizations..."
            className="pl-7 pr-3 py-1.5 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col space-y-1 mt-4">
          <button
            className={`px-3 py-2 rounded-md text-sm flex items-center ${
              selectedCategoryId === 'all'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
            }`}
            onClick={() => onCategorySelect('all')}
          >
            <Palette className="w-4 h-4 mr-2" />
            All Charts
          </button>
        
          {categories.map((category) => (
            <button
              key={category.id}
              className={`px-3 py-2 rounded-md text-sm flex items-center ${
                selectedCategoryId === category.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
              onClick={() => onCategorySelect(category.id)}
            >
              <category.icon className="w-4 h-4 mr-2" />
              {category.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}; 