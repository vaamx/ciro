import React, { useEffect, useCallback, useState, useRef } from 'react';
import { 
  PlusCircle,
  Hash,
  RefreshCw,
  Calendar,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { WidgetManager, Widget } from './WidgetManager';
import { AddWidgetModal } from './AddWidgetModal';
import { useDashboard } from '../../contexts/DashboardContext';
import { AddMetricModal } from './AddMetricModal';
import { AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
// Import MetricCard type from types
import { MetricCard } from '../../types/dashboard';
import { PerformanceMetrics } from './PerformanceMetrics';
import { StatsOverview } from './StatsOverview';

interface EnhancedOverviewProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const EnhancedOverview: React.FC<EnhancedOverviewProps> = () => {
  const [isGridView, setIsGridView] = React.useState(true);
  const [showAddWidget, setShowAddWidget] = React.useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricCard | undefined>();
  const { currentDashboard, updateWidgets, updateMetrics } = useDashboard();
  const [timeRange, setTimeRange] = useState('30d');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  
  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Log metrics data when it changes
  useEffect(() => {
    console.log('Dashboard metrics data:', getDisplayMetrics());
  }, [currentDashboard?.metrics]);

  // Debounced update function
  const debouncedUpdateWidgets = useCallback(
    (widgets: Widget[]) => {
      console.log('Updating widgets (debounced):', widgets);
      updateWidgets(widgets);
    },
    [updateWidgets]
  );

  // Initialize widgets from default if none exist and dashboard was just created
  useEffect(() => {
    if (currentDashboard && 
        (!currentDashboard.widgets || currentDashboard.widgets.length === 0)) {
      console.log('Dashboard has no widgets - showing static charts');
    } else if (currentDashboard?.widgets && currentDashboard.widgets.length > 0) {
      console.log(`Dashboard has ${currentDashboard.widgets.length} widgets`);
    }
  }, [currentDashboard]);

  // Simple grid view refresh function
  const handleForceInitialize = () => {
    setIsGridView(true);
  };

  const handleAddWidget = (newWidget: Omit<Widget, "id">) => {
    if (!currentDashboard) return;

    const widgetWithId = {
      ...newWidget,
      id: uuidv4()
    };

    const updatedWidgets = [...(currentDashboard.widgets || []), widgetWithId];
    console.log('Updated widgets array:', updatedWidgets);
    debouncedUpdateWidgets(updatedWidgets);
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (!currentDashboard) return;
    
    const updatedWidgets = currentDashboard.widgets.filter(w => w.id !== widgetId);
    debouncedUpdateWidgets(updatedWidgets);
  };

  const handleAddMetric = (metric: Omit<MetricCard, 'id'>) => {
    if (!currentDashboard) return;
    
    const newMetric: MetricCard = {
      ...metric,
      id: uuidv4() // Generate a unique ID
    };
    
    const updatedMetrics = [...(currentDashboard.metrics || []), newMetric];
    updateMetrics(updatedMetrics);
    setShowAddMetric(false);
  };
  
  const handleEditMetric = (metric: MetricCard) => {
    if (!currentDashboard?.metrics) return;
    
    const updatedMetrics = currentDashboard.metrics.map(m => 
      m.id === metric.id ? metric : m
    );
    
    updateMetrics(updatedMetrics);
    setEditingMetric(undefined);
    setShowAddMetric(false);
  };
  
  const getDisplayMetrics = (): MetricCard[] => {
    return currentDashboard?.metrics || [];
  };

  // Render content for the dashboard
  const renderDashboardContent = () => {
    return (
      <div className="h-full w-full flex flex-col">
        {/* Dashboard tools */}
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center space-x-1.5">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Dashboard</h1>
            
            {/* Time Range selector */}
            <div className="relative ml-2" ref={filterMenuRef}>
              <button
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                className="flex items-center space-x-1 px-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{timeRange}</span>
              </button>
              
              {isFilterMenuOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-100 dark:border-gray-700 z-10">
                  <div className="p-1">
                    {['7d', '30d', '90d', '12m'].map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setTimeRange(range);
                          setIsFilterMenuOpen(false);
                        }}
                        className={`
                          w-full text-left px-3 py-1.5 text-sm rounded-md
                          ${timeRange === range ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                        `}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowAddMetric(true)}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
              title="Add Metric"
            >
              <Hash className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowAddWidget(true)}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
              title="Add Widget"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleForceInitialize}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Stats Overview Section */}
          <div className={`bg-gray-50 dark:bg-gray-900/70 p-5 rounded-xl border border-gray-200 dark:border-gray-800 transition-all duration-300 shadow-sm ${isStatsExpanded ? 'mb-6' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-100 flex items-center">
                <svg className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2H11C6.02944 2 2 6.02944 2 11V13C2 17.9706 6.02944 22 11 22H13C17.9706 22 22 17.9706 22 13V11C22 6.02944 17.9706 2 13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 7V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1" fill="currentColor"/>
                </svg>
                Platform Status
              </h2>
              <button 
                onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                title={isStatsExpanded ? "Collapse" : "Expand"}
              >
                {isStatsExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${isStatsExpanded ? 'max-h-[800px]' : 'max-h-[140px]'}`}>
              <StatsOverview isExpanded={isStatsExpanded} />
            </div>
          </div>
          
          {/* Performance Metrics Section */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <PerformanceMetrics />
          </div>
          
          {/* Visualizations Section */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-100 flex items-center">
                <svg className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 14.5V17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M11.5 11V17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 7.5V17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Visualizations
              </h2>
              <button 
                onClick={() => setShowAddWidget(true)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
                title="Add Visualization"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <WidgetManager
                widgets={currentDashboard?.widgets || []}
                onWidgetsChange={updateWidgets}
                isGridView={isGridView}
                onDeleteWidget={handleDeleteWidget}
                onAddWidget={() => setShowAddWidget(true)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main content */}
      <div className="flex-1 overflow-hidden px-5 py-3.5">
        {renderDashboardContent()}
      </div>
      
      {/* Add Widget Modal */}
      <AnimatePresence>
        {showAddWidget && (
          <AddWidgetModal 
            isOpen={showAddWidget}
            onClose={() => setShowAddWidget(false)} 
            onAddWidget={handleAddWidget}
            availableDataSources={[
              { id: 'sales', name: 'Sales Data', type: 'table' },
              { id: 'users', name: 'User Metrics', type: 'api' },
              { id: 'performance', name: 'System Performance', type: 'timeseries' }
            ]}
          />
        )}
      </AnimatePresence>
      
      {/* Add/Edit Metric Modal */}
      <AnimatePresence>
        {showAddMetric && (
          <AddMetricModal 
            isOpen={showAddMetric}
            onClose={() => {
              setShowAddMetric(false);
              setEditingMetric(undefined);
            }}
            onSave={editingMetric 
              ? (metric) => handleEditMetric({ ...metric, id: editingMetric.id })
              : handleAddMetric
            }
            editingMetric={editingMetric}
          />
        )}
      </AnimatePresence>
    </div>
  );
}; 