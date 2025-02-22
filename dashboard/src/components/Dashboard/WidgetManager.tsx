import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings,
  Maximize2,
  ChevronDown,
  X,
  Move,
  Trash2,
  Plus
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export interface Widget {
  id: string;
  title: string;
  type: string;
  widget_type: string; // Required for backend communication
  size: 'small' | 'medium' | 'large';
  content: React.ReactNode | ((props: { isExpanded?: boolean }) => React.ReactNode);
  position?: number;
  settings?: {
    refreshInterval?: number;
    showTitle?: boolean;
    expandable?: boolean;
    [key: string]: any;
  };
}

interface WidgetManagerProps {
  widgets: Widget[];
  onWidgetsChange: (widgets: Widget[]) => void;
  isGridView: boolean;
  onDeleteWidget: (widgetId: string) => void;
  onEditWidget: (widget: Widget) => void;
  onAddWidget: () => void;
}

export const WidgetManager: React.FC<WidgetManagerProps> = ({
  widgets,
  onWidgetsChange,
  isGridView,
  onDeleteWidget,
  onEditWidget,
  onAddWidget
}) => {
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [settingsPosition, setSettingsPosition] = useState({ top: 0, left: 0 });
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSettingsClick = (widgetId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const button = event.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    
    const panelWidth = 320; // Width of our settings panel
    const viewportWidth = window.innerWidth;
    const buttonCenterX = rect.left + (rect.width / 2);
    
    // Calculate the ideal left position (centered on the button)
    let idealLeft = buttonCenterX - (panelWidth / 2);
    
    // Adjust if too close to left edge
    idealLeft = Math.max(16, idealLeft);
    
    // Adjust if too close to right edge
    if (idealLeft + panelWidth > viewportWidth - 16) {
      idealLeft = viewportWidth - panelWidth - 16;
    }

    setSettingsPosition({
      top: rect.bottom + scrollTop + 8, // 8px gap below the button
      left: idealLeft + scrollLeft // Add scroll offset
    });

    setShowSettings(showSettings === widgetId ? null : widgetId);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update positions after reordering while preserving all widget properties
    const updatedItems = items.map((item, index) => {
      // Ensure type and widget_type are explicitly set
      if (!item.type || !item.widget_type) {
        console.error('Widget missing type or widget_type during reorder:', item);
      }
      
      return {
        ...item,
        type: item.type || item.widget_type, // Use type or fallback to widget_type
        widget_type: item.widget_type || item.type, // Use widget_type or fallback to type
        position: index
      };
    });
    
    console.log('Reordered widgets:', updatedItems);
    onWidgetsChange(updatedItems);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="dashboard">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`grid gap-6 px-6 pb-6 ${
              isGridView
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            }`}
          >
            {widgets.map((widget, index) => (
              <Draggable key={widget.id} draggableId={widget.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`
                      relative bg-white dark:bg-gray-800 rounded-xl
                      shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]
                      hover:shadow-[0_8px_30px_-4px_rgba(145,115,225,0.2)] dark:hover:shadow-[0_8px_30px_-4px_rgba(145,115,225,0.3)]
                      border border-gray-200 dark:border-gray-700/80
                      transition-all duration-300 ease-out
                      group
                      ${snapshot.isDragging ? 'shadow-lg ring-2 ring-purple-400/30 dark:ring-purple-500/30 rotate-2 scale-[1.02]' : ''} 
                      ${expandedWidget === widget.id ? 'lg:col-span-2 row-span-2' : ''}
                      ${widget.size === 'large' ? 'lg:col-span-2' : ''}
                    `}
                  >
                    {/* Widget Header */}
                    <div className="flex items-center justify-between p-4 
                      border-b border-gray-200 dark:border-gray-700
                      bg-gray-50 dark:bg-gray-800/80">
                      <div className="flex items-center space-x-3" {...provided.dragHandleProps}>
                        <div className="cursor-move p-2 rounded-lg 
                          bg-white dark:bg-gray-700
                          group-hover:bg-purple-50 dark:group-hover:bg-purple-900/50
                          ring-1 ring-gray-200 dark:ring-gray-600
                          group-hover:ring-purple-200 dark:group-hover:ring-purple-700
                          transition-all duration-300">
                          <Move className="w-4 h-4 text-gray-600 dark:text-gray-300 
                            group-hover:text-purple-600 dark:group-hover:text-purple-400 
                            transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200
                            group-hover:text-purple-700 dark:group-hover:text-purple-300
                            transition-all duration-300">
                            {widget.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Draggable Widget
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => setExpandedWidget(expandedWidget === widget.id ? null : widget.id)}
                          className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                            hover:text-purple-600 dark:hover:text-purple-400 
                            hover:bg-purple-50 dark:hover:bg-purple-900/50
                            active:bg-purple-100 dark:active:bg-purple-900/70
                            transition-all duration-200"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => handleSettingsClick(widget.id, e)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            showSettings === widget.id
                              ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-700'
                              : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                          }`}
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onDeleteWidget(widget.id)}
                          className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                            hover:text-red-600 dark:hover:text-red-400 
                            hover:bg-red-50 dark:hover:bg-red-900/50
                            active:bg-red-100 dark:active:bg-red-900/70
                            transition-all duration-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Widget Content */}
                    <div className={`p-5 bg-white dark:bg-gray-800 
                      ${expandedWidget === widget.id ? 'flex-1 overflow-auto' : ''}`}>
                      {typeof widget.content === 'function' 
                        ? widget.content({ isExpanded: expandedWidget === widget.id }) 
                        : widget.content}
                    </div>

                    {/* Settings Panel */}
                    {showSettings === widget.id && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black/10 dark:bg-black/40 backdrop-blur-[1px] z-40" 
                          onClick={() => setShowSettings(null)} />
                        
                        {/* Panel */}
                        <div 
                          ref={settingsRef}
                          className="fixed bg-white dark:bg-gray-800 rounded-xl 
                            shadow-[0_8px_30px_-4px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.5)]
                            border border-gray-200 dark:border-gray-700 w-80 z-50 
                            transform transition-all duration-200 ease-out"
                          style={{ 
                            top: `${settingsPosition.top}px`, 
                            left: `${settingsPosition.left}px`
                          }}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between p-4 
                            border-b border-gray-200 dark:border-gray-700
                            bg-gray-50 dark:bg-gray-800/80">
                            <div>
                              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {widget.title}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Widget Settings</p>
                            </div>
                            <button 
                              onClick={() => setShowSettings(null)}
                              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400
                                hover:text-gray-700 dark:hover:text-gray-200 
                                hover:bg-gray-100 dark:hover:bg-gray-700
                                active:bg-gray-200 dark:active:bg-gray-600
                                transition-all duration-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {/* Content */}
                          <div className="p-4 space-y-4">
                            {/* Refresh Interval */}
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Refresh Interval
                              </label>
                              <select className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500">
                                <option value="manual">Manual</option>
                                <option value="30">30 seconds</option>
                                <option value="60">1 minute</option>
                                <option value="300">5 minutes</option>
                              </select>
                            </div>

                            {/* Settings Options */}
                            <div className="space-y-3">
                              {/* Show Title */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Show Title</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Display widget title</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" defaultChecked />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                </label>
                              </div>

                              {/* Expandable */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">Expandable</span>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Allow widget expansion</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" defaultChecked />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                </label>
                              </div>
                            </div>

                            {/* Advanced Settings Link */}
                            <button 
                              onClick={() => onEditWidget(widget)}
                              className="w-full mt-2 flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <span>Advanced Settings</span>
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Footer */}
                          <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => setShowSettings(null)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 rounded-lg transition-colors">
                                Save Changes
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {/* Add Widget Button */}
            <button
              onClick={onAddWidget}
              className="relative h-48 
                bg-white dark:bg-gray-800 rounded-xl
                border-2 border-dashed border-gray-300 dark:border-gray-600 
                hover:border-purple-400 dark:hover:border-purple-500
                hover:bg-purple-50/50 dark:hover:bg-purple-900/20
                shadow-sm hover:shadow-lg dark:shadow-gray-900/30
                transition-all duration-300 ease-out group
                overflow-hidden"
            >
              <div className="relative text-center">
                <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-gray-700
                  group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50
                  ring-1 ring-gray-200 dark:ring-gray-600
                  group-hover:ring-purple-300 dark:group-hover:ring-purple-700
                  shadow-sm group-hover:shadow
                  flex items-center justify-center mx-auto mb-3 
                  transition-all duration-300 ease-out
                  group-hover:scale-110">
                  <Plus className="w-6 h-6 text-gray-600 dark:text-gray-300 
                    group-hover:text-purple-600 dark:group-hover:text-purple-400 
                    transition-colors" />
                </div>
                <span className="block text-sm font-medium text-gray-600 dark:text-gray-300
                  group-hover:text-purple-700 dark:group-hover:text-purple-400
                  transition-all duration-300">
                  Add New Widget
                </span>
              </div>
              
              {/* Shine effect */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 
                  bg-gradient-to-r from-transparent via-white/20 dark:via-purple-400/10 to-transparent 
                  translate-x-[-100%] group-hover:translate-x-[100%] 
                  transition-all duration-1000 ease-out"></div>
              </div>
            </button>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}; 