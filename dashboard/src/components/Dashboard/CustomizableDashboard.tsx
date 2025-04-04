// @ts-ignore
import React, { useState } from 'react';
import { 
  DragDropContext, 
  Droppable, 
  Draggable,
  type DropResult,
  type DroppableProvided,
  type DraggableProvided
} from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { InteractiveVisualization } from '../../Visualization/InteractiveVisualization';

// Icons
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
  </svg>
);

const PaletteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
  </svg>
);

// Types
interface DashboardItem {
  id: string;
  type: 'visualization';
  title: string;
  config: any;
  width: number; // 1-12 (for a 12-column grid)
  height: number; // in pixels
  position: number;
  theme?: 'light' | 'dark';
}

interface Dashboard {
  id: string;
  name: string;
  items: DashboardItem[];
  createdAt: string;
  updatedAt: string;
}

interface CustomizableDashboardProps {
  initialDashboard?: Dashboard;
  onSave?: (dashboard: Dashboard) => void;
  availableVisualizations?: any[];
  theme?: 'light' | 'dark';
}

export const CustomizableDashboard: React.FC<CustomizableDashboardProps> = ({
  initialDashboard,
  onSave,
  availableVisualizations = [],
  theme = 'light'
}) => {
  const [dashboard, setDashboard] = useState<Dashboard>(
    initialDashboard || {
      id: `dashboard-${Date.now()}`,
      name: 'New Dashboard',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(dashboard.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Save dashboard
  const handleSave = () => {
    const updatedDashboard = {
      ...dashboard,
      updatedAt: new Date().toISOString()
    };
    
    setDashboard(updatedDashboard);
    
    if (onSave) {
      onSave(updatedDashboard);
    }
    
    setIsEditing(false);
  };

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(dashboard.items);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update positions
    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index
    }));
    
    setDashboard({
      ...dashboard,
      items: updatedItems
    });
  };

  // Add a new visualization
  const handleAddVisualization = (visualization: any) => {
    const newItem: DashboardItem = {
      id: `item-${Date.now()}`,
      type: 'visualization',
      title: visualization.title || 'New Visualization',
      config: visualization.config,
      width: 6, // Default to half width
      height: 300, // Default height
      position: dashboard.items.length,
      theme
    };
    
    setDashboard({
      ...dashboard,
      items: [...dashboard.items, newItem]
    });
    
    setShowAddMenu(false);
  };

  // Remove a visualization
  const handleRemoveItem = (id: string) => {
    const updatedItems = dashboard.items
      .filter(item => item.id !== id)
      .map((item, index) => ({
        ...item,
        position: index
      }));
    
    setDashboard({
      ...dashboard,
      items: updatedItems
    });
  };

  // Update item width
  const handleUpdateItemWidth = (id: string, width: number) => {
    const updatedItems = dashboard.items.map(item => 
      item.id === id ? { ...item, width } : item
    );
    
    setDashboard({
      ...dashboard,
      items: updatedItems
    });
  };

  // Update item height
  const handleUpdateItemHeight = (id: string, height: number) => {
    const updatedItems = dashboard.items.map(item => 
      item.id === id ? { ...item, height } : item
    );
    
    setDashboard({
      ...dashboard,
      items: updatedItems
    });
  };

  // Update item theme
  const handleUpdateItemTheme = (id: string, itemTheme: 'light' | 'dark') => {
    const updatedItems = dashboard.items.map(item => 
      item.id === id ? { ...item, theme: itemTheme } : item
    );
    
    setDashboard({
      ...dashboard,
      items: updatedItems
    });
  };

  // Export dashboard as image
  const handleExportImage = async () => {
    try {
      const dashboardElement = document.getElementById('customizable-dashboard');
      if (!dashboardElement) return;
      
      // Use html2canvas or similar library to capture the dashboard
      // This is a placeholder - you would need to import html2canvas
      // const canvas = await html2canvas(dashboardElement);
      // const dataUrl = canvas.toDataURL('image/png');
      
      // Create a download link
      // const link = document.createElement('a');
      // link.download = `${dashboard.name}.png`;
      // link.href = dataUrl;
      // link.click();
      
      alert('Export functionality would be implemented here with html2canvas');
    } catch (error) {
      console.error('Error exporting dashboard:', error);
    }
  };

  return (
    <div className="customizable-dashboard-container">
      <div className="dashboard-header flex justify-between items-center mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {isEditing ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => {
              setDashboard({
                ...dashboard,
                name: editingTitle
              });
            }}
            className="px-2 py-1 border rounded"
          />
        ) : (
          <h2 className="text-xl font-bold">{dashboard.name}</h2>
        )}
        
        <div className="dashboard-actions flex space-x-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isEditing ? "Save changes" : "Edit dashboard"}
          >
            {isEditing ? <SaveIcon /> : <EditIcon />}
          </button>
          
          {isEditing && (
            <>
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Add visualization"
              >
                <PlusIcon />
              </button>
              
              <button 
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Change theme"
              >
                <PaletteIcon />
              </button>
            </>
          )}
          
          <button 
            onClick={handleExportImage}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Export as image"
          >
            <DownloadIcon />
          </button>
          
          {isEditing && (
            <button 
              onClick={handleSave}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>
      
      {showAddMenu && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="add-menu mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
        >
          <h3 className="text-lg font-medium mb-2">Add Visualization</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableVisualizations.length > 0 ? (
              availableVisualizations.map((viz, index) => (
                <div 
                  key={index}
                  onClick={() => handleAddVisualization(viz)}
                  className="viz-option p-2 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="h-20 bg-gray-200 dark:bg-gray-600 rounded mb-2 flex items-center justify-center">
                    {viz.type}
                  </div>
                  <p className="font-medium">{viz.title}</p>
                </div>
              ))
            ) : (
              <p>No visualizations available. Create one first.</p>
            )}
          </div>
        </motion.div>
      )}
      
      {showColorPicker && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="color-picker mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
        >
          <h3 className="text-lg font-medium mb-2">Theme Settings</h3>
          <div className="flex space-x-3">
            <button 
              onClick={() => {
                if (selectedItemId) {
                  handleUpdateItemTheme(selectedItemId, 'light');
                }
              }}
              className={`p-2 rounded border ${theme === 'light' ? 'border-blue-500' : 'border-gray-300'}`}
            >
              Light
            </button>
            <button 
              onClick={() => {
                if (selectedItemId) {
                  handleUpdateItemTheme(selectedItemId, 'dark');
                }
              }}
              className={`p-2 rounded border ${theme === 'dark' ? 'border-blue-500' : 'border-gray-300'}`}
            >
              Dark
            </button>
          </div>
        </motion.div>
      )}
      
      <div 
        id="customizable-dashboard"
        className="dashboard-content"
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard-items" direction="vertical">
            {(provided: DroppableProvided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-12 gap-4"
              >
                {dashboard.items.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={item.id}
                    index={index}
                    isDragDisabled={!isEditing}
                  >
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`col-span-${item.width} dashboard-item relative`}
                      >
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                          <div 
                            className="dashboard-item-header p-2 bg-gray-100 dark:bg-gray-700 flex justify-between items-center"
                            {...(isEditing ? provided.dragHandleProps : {})}
                          >
                            <h3 className="font-medium">{item.title}</h3>
                            
                            {isEditing && (
                              <div className="flex space-x-1">
                                <select
                                  value={item.width}
                                  onChange={(e) => handleUpdateItemWidth(item.id, parseInt(e.target.value))}
                                  className="text-xs p-1 rounded border"
                                >
                                  <option value="3">25%</option>
                                  <option value="4">33%</option>
                                  <option value="6">50%</option>
                                  <option value="8">66%</option>
                                  <option value="12">100%</option>
                                </select>
                                
                                <button
                                  onClick={() => {
                                    setSelectedItemId(item.id);
                                    setShowColorPicker(true);
                                  }}
                                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                  <PaletteIcon />
                                </button>
                                
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                  <DeleteIcon />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="dashboard-item-content p-2">
                            {item.type === 'visualization' && (
                              <InteractiveVisualization
                                config={item.config}
                                height={item.height}
                                width="100%"
                                theme={item.theme || theme}
                                enableDrillDown={true}
                              />
                            )}
                          </div>
                          
                          {isEditing && (
                            <div className="dashboard-item-footer p-2 bg-gray-50 dark:bg-gray-700 flex justify-end">
                              <select
                                value={item.height}
                                onChange={(e) => handleUpdateItemHeight(item.id, parseInt(e.target.value))}
                                className="text-xs p-1 rounded border"
                              >
                                <option value="200">Small</option>
                                <option value="300">Medium</option>
                                <option value="400">Large</option>
                                <option value="500">X-Large</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        {dashboard.items.length === 0 && (
          <div className="empty-state p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              This dashboard is empty. Add visualizations to get started.
            </p>
            {isEditing && (
              <button
                onClick={() => setShowAddMenu(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Add Visualization
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 