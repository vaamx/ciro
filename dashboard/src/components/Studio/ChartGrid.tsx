import React, { useState } from 'react';
import { Maximize2, Move, MessageSquare, Trash } from 'lucide-react';

export interface ChartGridItem {
  id: string;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  dataSourceId?: string;
  content: React.ReactNode;
  isLoading?: boolean;
}

interface ChartGridProps {
  items: ChartGridItem[];
  activeItemId?: string;
  onSelectItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onResizeItem: (id: string, size: ChartGridItem['size']) => void;
  onAddComment?: (id: string) => void;
  className?: string;
}

/**
 * A responsive chart grid layout using TailwindCSS grid system
 */
export const ChartGrid: React.FC<ChartGridProps> = ({
  items,
  activeItemId,
  onSelectItem,
  onDeleteItem,
  onResizeItem,
  onAddComment,
  className = ''
}) => {
  // Dragging state for custom drag-and-drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Get grid classes based on item size
  const getGridClasses = (size: ChartGridItem['size']) => {
    switch (size) {
      case 'small':
        return 'col-span-1 row-span-1'; // 1/3 width, 1 row height
      case 'medium':
        return 'col-span-2 row-span-1'; // 2/3 width, 1 row height
      case 'large':
        return 'col-span-2 row-span-2'; // 2/3 width, 2 rows height
      case 'full':
        return 'col-span-3 row-span-2'; // Full width, 2 rows height
      default:
        return 'col-span-1 row-span-1';
    }
  };
  
  // Handle item resize
  const handleResize = (id: string, currentSize: ChartGridItem['size']) => {
    // Define size progression
    const sizeProgression: ChartGridItem['size'][] = ['small', 'medium', 'large', 'full'];
    const currentIndex = sizeProgression.indexOf(currentSize);
    
    // Get next size in the progression (cycle back to small if already full)
    const nextSize = sizeProgression[(currentIndex + 1) % sizeProgression.length];
    
    onResizeItem(id, nextSize);
  };
  
  return (
    <div className={`grid grid-cols-3 gap-4 ${className}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`
            ${getGridClasses(item.size)}
            bg-white dark:bg-gray-800
            border ${item.id === activeItemId ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}
            rounded-lg shadow-sm
            transition-all duration-200
            ${draggingId === item.id ? 'ring-2 ring-blue-500 opacity-90 z-10 cursor-grabbing' : ''}
            overflow-hidden flex flex-col
          `}
          onClick={() => onSelectItem(item.id)}
        >
          {/* Chart header with title and actions */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
            <div 
              className="flex items-center cursor-move"
              onMouseDown={() => setDraggingId(item.id)}
              onMouseUp={() => setDraggingId(null)}
            >
              <Move className="w-3.5 h-3.5 mr-2 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {item.title}
              </h3>
            </div>
            
            <div className="flex items-center space-x-1">
              {onAddComment && (
                <button
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddComment(item.id);
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                </button>
              )}
              
              <button
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResize(item.id, item.size);
                }}
              >
                <Maximize2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </button>
              
              <button
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item.id);
                }}
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          {/* Chart content */}
          <div className="flex-1 overflow-hidden relative">
            {item.isLoading && (
              <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
            {item.content}
          </div>
          
          {/* Data source label */}
          {item.dataSourceId && (
            <div className="px-3 py-1 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Data source: {item.dataSourceId}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChartGrid; 