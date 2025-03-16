import React, { useEffect, useCallback, useState } from 'react';
import { 
  LayoutGrid,
  PlusCircle,
  BarChart2,
  Activity,
  Box,
  Plus,
  Hash
} from 'lucide-react';
import { WidgetManager, Widget } from './WidgetManager';
import { AddWidgetModal } from './AddWidgetModal';
import { StatsOverview } from './StatsOverview';
import { StaticMetricsCards } from './StaticMetricsCards';
import { ActivityTimeline } from './ActivityTimeline';
import { PerformanceMetrics } from './PerformanceMetrics';
import { useDashboard } from '../../contexts/DashboardContext';
import { AddMetricModal } from './AddMetricModal';
import type { MetricCard } from './StaticMetricsCards';

interface EnhancedOverviewProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabItems = [
  { id: 'overview', name: 'Overview', icon: LayoutGrid },
  { id: 'panels', name: 'Active Panels', icon: Box },
  { id: 'trends', name: 'Data Trends', icon: BarChart2 },
  { id: 'health', name: 'Automations Health', icon: Activity }
];

const defaultWidgets: Widget[] = [
  { 
    id: 'stats',
    title: 'Key Metrics',
    type: 'stats',
    widget_type: 'stats',
    size: 'medium',
    content: ({ isExpanded }) => <StatsOverview isExpanded={isExpanded} />,
    settings: {
      refreshInterval: 30,
      showTitle: true,
      expandable: true
    }
  },
  {
    id: 'activity',
    title: 'Activity Timeline',
    type: 'activity',
    widget_type: 'activity',
    size: 'large',
    content: <ActivityTimeline />,
    settings: {
      refreshInterval: 60,
      showTitle: true,
      expandable: true
    }
  },
  {
    id: 'performance',
    title: 'Performance Metrics',
    type: 'stats',
    widget_type: 'stats',
    size: 'medium',
    content: <PerformanceMetrics />,
    settings: {
      refreshInterval: 300,
      showTitle: true,
      expandable: true
    }
  }
];

export const EnhancedOverview: React.FC<EnhancedOverviewProps> = ({
  activeTab,
  onTabChange
}) => {
  const [isGridView, setIsGridView] = React.useState(true);
  const [showAddWidget, setShowAddWidget] = React.useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricCard | undefined>();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const { currentDashboard, updateWidgets, updateMetrics } = useDashboard();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        (!currentDashboard.widgets || currentDashboard.widgets.length === 0) &&
        // Check if dashboard was just created (within last minute)
        new Date(currentDashboard.createdAt).getTime() > Date.now() - 60000) {
      console.log('Initializing new dashboard with default widgets');
      debouncedUpdateWidgets(defaultWidgets);
    }
  }, [currentDashboard, debouncedUpdateWidgets]);

  const handleAddWidget = (newWidget: Omit<Widget, 'id'>) => {
    if (!currentDashboard) return;

    const widget: Widget = {
      id: `widget-${Date.now()}`,
      ...newWidget,
      widget_type: newWidget.type,
      position: currentDashboard.widgets?.length || 0
    };

    console.log('Adding new widget:', widget);
    const updatedWidgets = [...(currentDashboard.widgets || []), widget];
    console.log('Updated widgets array:', updatedWidgets);
    debouncedUpdateWidgets(updatedWidgets);
    setShowActionMenu(false);
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (!currentDashboard) return;
    
    const updatedWidgets = currentDashboard.widgets.filter(w => w.id !== widgetId);
    debouncedUpdateWidgets(updatedWidgets);
  };

  /* Unused function - commenting out to fix linter warning
  const handleEditWidget = (widget: Widget) => {
    if (!currentDashboard) return;
    
    const updatedWidgets = currentDashboard.widgets.map(w => 
      w.id === widget.id ? widget : w
    );
    debouncedUpdateWidgets(updatedWidgets);
  };
  */

  const handleAddMetric = (metric: Omit<MetricCard, 'id'>) => {
    if (!currentDashboard) return;

    const newMetric: MetricCard = {
      id: `metric-${Date.now()}`,
      ...metric
    };

    const updatedMetrics = [...(currentDashboard.metrics || []), newMetric];
    updateMetrics(updatedMetrics);
    
    setShowAddMetric(false);
    setShowActionMenu(false);
  };

  const handleEditMetric = (metric: MetricCard) => {
    if (!currentDashboard) return;

    const updatedMetrics = currentDashboard.metrics.map(m =>
      m.id === metric.id ? metric : m
    );
    updateMetrics(updatedMetrics);
    
    setShowAddMetric(false);
    setEditingMetric(undefined);
  };

  const handleDeleteMetric = (metricId: string) => {
    if (!currentDashboard) return;

    const updatedMetrics = currentDashboard.metrics.filter(m => m.id !== metricId);
    updateMetrics(updatedMetrics);
  };

  const renderActiveTab = (tab: {id: string, name: string, icon: React.ComponentType<any>}) => {
    const TabIcon = tab.icon;
    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`flex items-center p-3 ${
          activeTab === tab.id
            ? 'text-purple-700 dark:text-purple-300 border-b-2 border-purple-600 dark:border-purple-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <TabIcon className="w-5 h-5 sm:mr-2" />
        <span className={`${isMobile ? 'hidden' : 'block'}`}>{tab.name}</span>
      </button>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Metrics Section Title */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Key Metrics
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Track and monitor your most important business metrics and KPIs in real-time. Add custom metrics to stay on top of what matters most.
                </p>
              </div>
            </div>

            <StaticMetricsCards
              metrics={currentDashboard?.metrics || []}
              onAddMetric={() => {
                setShowAddMetric(true);
                setShowActionMenu(false);
              }}
              onEditMetric={(metric) => {
                setEditingMetric(metric);
                setShowAddMetric(true);
              }}
              onDeleteMetric={handleDeleteMetric}
            />

            {/* Widgets Section Title */}
            <div className="px-4 sm:px-6 pt-6 sm:pt-8">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Dashboard Widgets
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize your dashboard with interactive widgets to visualize data, track performance, and monitor system activities in real-time.
                </p>
              </div>
            </div>

            {currentDashboard && (
              <WidgetManager
                widgets={currentDashboard.widgets || []}
                onWidgetsChange={updateWidgets}
                isGridView={isGridView}
                onDeleteWidget={handleDeleteWidget}
                onAddWidget={() => {
                  setShowAddWidget(true);
                  setShowActionMenu(false);
                }}
              />
            )}
          </>
        );
      case 'panels':
        return (
          <div className="p-4 sm:p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-gray-900/30">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Panels</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Create and manage panels to view data, trends, and insights in a format that suits your needs.
              </p>
              
              {/* Sample Panels - Replace with real implementation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((panel) => (
                  <div key={panel} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Panel {panel}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Click to configure</div>
                  </div>
                ))}
                
                {/* Add Panel Card */}
                <button 
                  onClick={() => {
                    setShowAddWidget(true);
                    setShowActionMenu(false);
                  }}
                  className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700/30 
                    rounded-lg p-4 border border-dashed border-gray-300 dark:border-gray-600
                    hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-purple-400 dark:hover:border-purple-500
                    transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
                    <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Add New Panel</span>
                </button>
              </div>
            </div>
          </div>
        );
      case 'trends':
        return (
          <div className="p-4 sm:p-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-gray-900/30">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Trends</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Analyze and visualize important data trends over time to make better data-driven decisions.
              </p>
              
              {/* Sample Trends - Replace with real implementation */}
              <div className="space-y-6">
                {[1, 2].map((trend) => (
                  <div key={trend} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Trend Analysis {trend}</div>
                    <div className="h-32 bg-gray-100 dark:bg-gray-600/50 rounded-md flex items-center justify-center">
                      <BarChart2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                  </div>
                ))}
                
                {/* Add Trend Card */}
                <button 
                  onClick={() => {
                    setShowAddWidget(true);
                    setShowActionMenu(false);
                  }}
                  className="flex items-center justify-center bg-gray-50 dark:bg-gray-700/30 
                    rounded-lg p-4 border border-dashed border-gray-300 dark:border-gray-600
                    hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-purple-400 dark:hover:border-purple-500
                    transition-all duration-200 h-32"
                >
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2">
                      <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Add New Trend</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      case 'health':
        return <div className="p-4 sm:p-6 text-gray-800 dark:text-gray-200">Automations Health Content</div>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-2 sm:px-6">
          <div className="flex items-center justify-between py-2 sm:py-4">
            {/* Tabs scrollable container */}
            <div className="flex-1 overflow-x-auto hide-scrollbar pr-2">
              <div className="flex space-x-2 sm:space-x-4">
                {tabItems.map(tab => renderActiveTab(tab))}
              </div>
            </div>
            
            {/* Desktop Action buttons */}
            <div className="hidden sm:flex items-center space-x-4">
              <button
                onClick={() => setIsGridView(!isGridView)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 rounded-lg"
                aria-label={isGridView ? "Switch to list view" : "Switch to grid view"}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowAddWidget(true)}
                className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600 flex items-center space-x-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Panel</span>
              </button>
            </div>
            
            {/* Mobile Action button */}
            {isMobile && (
              <div className="relative">
                <button
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 
                    dark:from-purple-600 dark:to-purple-700 text-white rounded-lg
                    flex items-center justify-center relative shadow-md"
                  aria-label="Add new item"
                >
                  <Plus className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                
                {/* Action Menu */}
                {showActionMenu && (
                  <div className="absolute top-full right-0 mt-2 space-y-2 min-w-[220px] z-50">
                    {/* Show Metric button only on Overview tab */}
                    {activeTab === 'overview' && (
                      <button
                        onClick={() => {
                          setShowAddMetric(true);
                          setShowActionMenu(false);
                        }}
                        className="flex items-center gap-2 w-full py-3 px-4 bg-white dark:bg-gray-800 
                          rounded-lg shadow-lg text-left text-sm font-medium text-gray-900 dark:text-white
                          border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Hash className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </span>
                        <span>Add New Metric</span>
                      </button>
                    )}
                    
                    {/* Always show the Add Panel button, with different text based on tab */}
                    <button
                      onClick={() => {
                        setShowAddWidget(true);
                        setShowActionMenu(false);
                      }}
                      className="flex items-center gap-2 w-full py-3 px-4 bg-white dark:bg-gray-800 
                        rounded-lg shadow-lg text-left text-sm font-medium text-gray-900 dark:text-white
                        border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <LayoutGrid className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </span>
                      <span>
                        {activeTab === 'overview' ? 'Add New Widget' : 
                        activeTab === 'panels' ? 'Add New Panel' : 
                        activeTab === 'trends' ? 'Add New Trend' : 'Add New Item'}
                      </span>
                    </button>
                    
                    {/* Backdrop to close menu when clicking outside */}
                    <div 
                      className="fixed inset-0 z-[-1]" 
                      onClick={() => setShowActionMenu(false)}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Content Based on Active Tab */}
      {renderTabContent()}

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={showAddWidget}
        onClose={() => setShowAddWidget(false)}
        onAddWidget={handleAddWidget}
        availableDataSources={[
          { id: 'sales', name: 'Sales Data', type: 'table' },
          { id: 'users', name: 'User Metrics', type: 'api' },
          { id: 'performance', name: 'System Performance', type: 'timeseries' },
          { id: 'marketing', name: 'Marketing Analytics', type: 'table' }
        ]}
      />

      {/* Add Metric Modal */}
      <AddMetricModal
        isOpen={showAddMetric}
        onClose={() => {
          setShowAddMetric(false);
          setEditingMetric(undefined);
        }}
        onSave={(metric) => {
          if (editingMetric) {
            handleEditMetric({ ...metric, id: editingMetric.id });
          } else {
            handleAddMetric(metric);
          }
        }}
        editingMetric={editingMetric}
      />
      
      {/* Add custom styles for hiding scrollbars while allowing scrolling */}
      <style>{`
        .hide-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;  /* Chrome, Safari, Opera */
        }
      `}</style>
    </div>
  );
}; 