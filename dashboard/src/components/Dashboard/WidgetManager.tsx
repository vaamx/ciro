/**
 * Widget Manager Component
 * Manages the display and interaction with dashboard widgets
 */
import React, { useState, useEffect, Suspense } from 'react';
import { 
  Maximize2,
  X,
  Move,
  Trash2,
  Plus,
  Minimize2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Add a flag to control debug logging
const DEBUG_MODE = false;

// Replace console.log calls with a custom logger
const logDebug = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

// Add these styles to the top of the file, after imports
const widgetStyles = `
  .widget-container {
    background-color: white;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease-in-out;
    overflow: hidden;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .dark .widget-container {
    background-color: rgba(30, 41, 59, 0.8);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
  }
  
  .widget-container:hover {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  
  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(229, 231, 235, 0.5);
    background-color: rgba(249, 250, 251, 0.8);
  }
  
  .dark .widget-header {
    border-bottom: 1px solid rgba(55, 65, 81, 0.5);
    background-color: rgba(30, 41, 59, 0.5);
  }
  
  .widget-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .dark .widget-title {
    color: #f3f4f6;
  }
  
  .widget-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .widget-action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    background-color: transparent;
    color: #6b7280;
    transition: all 0.15s ease-in-out;
    cursor: pointer;
    border: none;
    outline: none;
  }
  
  .widget-action-button:hover {
    background-color: rgba(243, 244, 246, 0.8);
    color: #4b5563;
  }
  
  .dark .widget-action-button {
    color: #9ca3af;
  }
  
  .dark .widget-action-button:hover {
    background-color: rgba(55, 65, 81, 0.5);
    color: #e5e7eb;
  }
  
  .widget-content {
    flex: 1;
    overflow: auto;
    padding: 0.75rem;
    position: relative;
  }
  
  .widget-dragging {
    opacity: 0.7;
    transform: scale(1.02);
    z-index: 10;
  }
  
  .widget-drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    color: #9ca3af;
    margin-right: 0.5rem;
  }
  
  .widget-drag-handle:hover {
    background-color: rgba(243, 244, 246, 0.8);
    color: #4b5563;
  }
  
  .dark .widget-drag-handle {
    color: #6b7280;
  }
  
  .dark .widget-drag-handle:hover {
    background-color: rgba(55, 65, 81, 0.5);
    color: #9ca3af;
  }
  
  .widget-empty-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    background-color: rgba(243, 244, 246, 0.5);
    border: 2px dashed #e5e7eb;
    border-radius: 0.75rem;
    color: #6b7280;
  }
  
  .dark .widget-empty-placeholder {
    background-color: rgba(30, 41, 59, 0.3);
    border: 2px dashed #374151;
    color: #9ca3af;
  }
  
  .widget-add-button {
    margin-top: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.15s ease-in-out;
    border: none;
    cursor: pointer;
  }
  
  .widget-add-button:hover {
    background-color: #2563eb;
  }
  
  .dark .widget-add-button {
    background-color: #4f46e5;
  }
  
  .dark .widget-add-button:hover {
    background-color: #4338ca;
  }
  
  /* Settings panel styles */
  .settings-panel {
    position: absolute;
    z-index: 50;
    width: 320px;
    background-color: white;
    border-radius: 0.75rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }
  
  .dark .settings-panel {
    background-color: #1f2937;
    border-color: #374151;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
  }
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }
  
  .dark .settings-header {
    border-color: #374151;
    background-color: #111827;
  }
  
  .settings-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #1f2937;
  }
  
  .dark .settings-title {
    color: #f3f4f6;
  }
  
  .settings-content {
    padding: 1rem;
  }
  
  .settings-section {
    margin-bottom: 1.5rem;
  }
  
  .settings-section-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #4b5563;
    margin-bottom: 0.75rem;
  }
  
  .dark .settings-section-title {
    color: #d1d5db;
  }
  
  .settings-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  
  .settings-option-label {
    font-size: 0.875rem;
    color: #1f2937;
  }
  
  .dark .settings-option-label {
    color: #f3f4f6;
  }
  
  .settings-option-description {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }
  
  .dark .settings-option-description {
    color: #9ca3af;
  }
  
  .settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }
  
  .dark .settings-footer {
    border-color: #374151;
    background-color: #111827;
  }
  
  .settings-button {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.15s ease-in-out;
    cursor: pointer;
  }
  
  .settings-button-secondary {
    background-color: transparent;
    color: #4b5563;
    border: 1px solid #d1d5db;
  }
  
  .settings-button-secondary:hover {
    background-color: #f3f4f6;
    border-color: #9ca3af;
  }
  
  .dark .settings-button-secondary {
    color: #d1d5db;
    border-color: #4b5563;
  }
  
  .dark .settings-button-secondary:hover {
    background-color: #374151;
    border-color: #6b7280;
  }
  
  .settings-button-primary {
    background-color: #3b82f6;
    color: white;
    border: none;
  }
  
  .settings-button-primary:hover {
    background-color: #2563eb;
  }
  
  .dark .settings-button-primary {
    background-color: #4f46e5;
  }
  
  .dark .settings-button-primary:hover {
    background-color: #4338ca;
  }
  
  /* Expanded widget styles */
  .expanded-widget {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 85%;
    height: 85%;
    z-index: 40;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border-radius: 0.75rem;
    overflow: hidden;
    background-color: white;
    transition: all 0.3s ease-in-out;
  }
  
  .dark .expanded-widget {
    background-color: #1e293b;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  }
  
  .expanded-widget .widget-header {
    padding: 1rem 1.25rem;
    border-bottom-width: 2px;
  }
  
  .expanded-widget .widget-title {
    font-size: 1rem;
  }
  
  .expanded-widget .widget-content {
    padding: 1.25rem;
  }
  
  .expanded-widget-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 30;
    backdrop-filter: blur(2px);
    animation: fadeIn 0.2s ease-in-out;
  }
  
  .dark .expanded-widget-overlay {
    background-color: rgba(0, 0, 0, 0.7);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .expanded-widget-enter {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  
  .expanded-widget-enter-active {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    transition: opacity 0.3s, transform 0.3s;
  }
  
  .expanded-widget-exit {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  
  .expanded-widget-exit-active {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
    transition: opacity 0.3s, transform 0.3s;
  }
`;

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
    visualization?: any;
    [key: string]: any;
  };
}

interface WidgetManagerProps {
  widgets: Widget[];
  onWidgetsChange: (widgets: Widget[]) => void;
  isGridView: boolean;
  onDeleteWidget: (widgetId: string) => void;
  onAddWidget: () => void;
}

// Import the VisualizationWidget component
import { VisualizationWidget } from './VisualizationWidget';

// Loading fallback for charts
const ChartLoadingFallback = () => (
  <div style={{
    height: '100%',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: '8px'
  }}>
    <div style={{ 
      width: '30px', 
      height: '30px', 
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #3498db', 
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
  </div>
);

// Update the validateVisualizationConfig function to return an object with isValid and error properties
const validateVisualizationConfig = (vizSettings: any, widgetId: string): { isValid: boolean; error?: string } => {
  try {
    // Check if data exists and is an array
    if (!vizSettings.data || !Array.isArray(vizSettings.data)) {
      logDebug(`WidgetManager: Widget ${widgetId} has no data or invalid data`);
      return { isValid: false, error: 'Missing or invalid data array' };
    }
    
    // Check if data is empty
    if (vizSettings.data.length === 0) {
      logDebug(`WidgetManager: Widget ${widgetId} has empty data array`);
      return { isValid: false, error: 'Data array is empty' };
    }
    
    // Check if type is supported
  const supportedTypes = ['bar', 'line', 'pie', 'area', 'scatter', 'table'];
    if (vizSettings.type && !supportedTypes.includes(vizSettings.type)) {
      logDebug(`WidgetManager: Widget ${widgetId} has unsupported visualization type: ${vizSettings.type}`);
      logDebug(`WidgetManager: Supported types are: ${supportedTypes.join(', ')}`);
      return { isValid: false, error: `Unsupported visualization type: ${vizSettings.type}` };
    }
    
    // Check if required keys exist
    if (!vizSettings.xKey || !vizSettings.yKey) {
      logDebug(`WidgetManager: Widget ${widgetId} is missing required keys (xKey or yKey)`);
      return { isValid: false, error: 'Missing required keys (xKey or yKey)' };
    }
    
    // Check if the first data item has the required keys
    const firstItem = vizSettings.data[0];
    if (!firstItem[vizSettings.xKey] && firstItem[vizSettings.xKey] !== 0) {
      logDebug(`WidgetManager: Widget ${widgetId} data is missing xKey: ${vizSettings.xKey}`);
      return { isValid: false, error: `Data is missing xKey: ${vizSettings.xKey}` };
    }
    
    if (!firstItem[vizSettings.yKey] && firstItem[vizSettings.yKey] !== 0) {
      logDebug(`WidgetManager: Widget ${widgetId} data is missing yKey: ${vizSettings.yKey}`);
      return { isValid: false, error: `Data is missing yKey: ${vizSettings.yKey}` };
    }
    
    return { isValid: true };
  } catch (error) {
    logDebug(`WidgetManager: Error validating visualization config for widget ${widgetId}:`, error);
    return { isValid: false, error: `Validation error: ${error instanceof Error ? error.message : String(error)}` };
  }
};

export const WidgetManager: React.FC<WidgetManagerProps> = ({
  widgets,
  onWidgetsChange,
  isGridView,
  onDeleteWidget,
  onAddWidget
}) => {
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  
  // Handle widget expansion toggle
  const toggleWidgetExpand = (widgetId: string) => {
    // If we're expanding a widget, add a class to the body to prevent scrolling
    if (expandedWidgetId !== widgetId) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    
    setExpandedWidgetId(expandedWidgetId === widgetId ? null : widgetId);
  };
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);
  
  // Handle escape key to close expanded widget
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedWidgetId) {
        toggleWidgetExpand(expandedWidgetId);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [expandedWidgetId]);
  
  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update positions
    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index
    }));
    
    console.log('Reordered widgets:', updatedItems);
    onWidgetsChange(updatedItems);
  };

  const renderWidget = (widget: Widget) => {
    const isVisualizationWidget = 
      widget.content === "visualization-widget" ||
      widget.widget_type === "visualization-widget" ||
      widget.type === "visualization-widget";
    
    // Validate visualization settings if needed
    if (isVisualizationWidget && widget.settings?.visualization) {
      const validationResult = validateVisualizationConfig(widget.settings.visualization, widget.id);
      if (!validationResult.isValid) {
        logDebug(`WidgetManager: Widget ${widget.id} has invalid visualization config: ${validationResult.error}`);
      }
    }
    
    // Check if this widget is expanded
    const isExpanded = expandedWidgetId === widget.id;

  return (
      <Draggable key={widget.id} draggableId={widget.id} index={widget.position || 0}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
            className={`widget-wrapper ${snapshot.isDragging ? 'widget-dragging' : ''}`}
            style={{
              ...provided.draggableProps.style,
              height: '100%',
              minHeight: '200px'
            }}
          >
            <div className="widget-container">
              <div className="widget-header">
                <div className="widget-title-area flex items-center overflow-hidden">
                  <div
                    {...provided.dragHandleProps}
                    className="widget-drag-handle"
                    title="Drag to reorder"
                  >
                    <Move size={16} />
                        </div>
                  <div className="widget-title">
                            {widget.title}
                        </div>
                      </div>
                <div className="widget-actions">
                        <button 
                    className="widget-action-button"
                    onClick={() => toggleWidgetExpand(widget.id)}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button 
                    className="widget-action-button"
                          onClick={() => onDeleteWidget(widget.id)}
                    title="Delete widget"
                  >
                    <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
              <div className="widget-content">
                {isVisualizationWidget ? (
                  <Suspense fallback={<ChartLoadingFallback />}>
                    <VisualizationWidget 
                      settings={widget.settings || {}} 
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleWidgetExpand(widget.id)}
                    />
                  </Suspense>
                ) : (
                  typeof widget.content === 'function' ? 
                    widget.content({ isExpanded }) : 
                    widget.content
                )}
              </div>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  // Render expanded widget overlay
  const renderExpandedWidgetOverlay = () => {
    if (!expandedWidgetId) return null;
    
    const expandedWidget = widgets.find(w => w.id === expandedWidgetId);
    if (!expandedWidget) return null;
    
    const isVisualizationWidget = 
      expandedWidget.content === "visualization-widget" ||
      expandedWidget.widget_type === "visualization-widget" ||
      expandedWidget.type === "visualization-widget";
    
    return (
      <>
        <div 
          className="expanded-widget-overlay" 
          onClick={() => toggleWidgetExpand(expandedWidgetId)}
          aria-label="Close expanded view"
        />
        <div className="expanded-widget">
          <div className="widget-header">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <div className="widget-title">
                  {expandedWidget.title}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="widget-action-button"
                  onClick={() => toggleWidgetExpand(expandedWidgetId)}
                  title="Close expanded view"
                  aria-label="Close expanded view"
                >
                  <X size={18} />
                </button>
                      </div>
                    </div>
          </div>
          <div className="widget-content">
            {isVisualizationWidget ? (
              <Suspense fallback={<ChartLoadingFallback />}>
                <VisualizationWidget 
                  settings={expandedWidget.settings || {}} 
                  isExpanded={true}
                  onToggleExpand={() => toggleWidgetExpand(expandedWidgetId)}
                />
              </Suspense>
            ) : (
              typeof expandedWidget.content === 'function' ? 
                expandedWidget.content({ isExpanded: true }) : 
                expandedWidget.content
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="widget-manager">
      <style>{widgetStyles}</style>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets" direction={isGridView ? 'horizontal' : 'vertical'}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`widgets-container ${isGridView ? 'grid-layout' : 'list-layout'}`}
              style={{
                display: 'grid',
                gridTemplateColumns: isGridView ? 'repeat(auto-fill, minmax(350px, 1fr))' : '1fr',
                gap: '1rem',
                padding: '1rem',
                width: '100%'
              }}
            >
              {widgets.length > 0 ? (
                widgets
                  .sort((a, b) => (a.position || 0) - (b.position || 0))
                  .map(widget => renderWidget(widget))
              ) : (
                <div className="widget-empty-placeholder">
                  <div className="text-lg font-medium mb-2">No widgets added yet</div>
                  <p className="text-sm mb-4">Add widgets to your dashboard to visualize your data</p>
                  <button className="widget-add-button" onClick={onAddWidget}>
                    <Plus size={16} />
                    Add Widget
                  </button>
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Expanded Widget Overlay */}
      {expandedWidgetId && renderExpandedWidgetOverlay()}
                </div>
  );
}; 