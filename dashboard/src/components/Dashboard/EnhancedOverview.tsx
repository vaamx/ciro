import React, { useEffect, useCallback, useState } from 'react';
import { 
  LayoutGrid,
  PlusCircle,
  BarChart2,
  Activity,
  Box
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
  const { currentDashboard, updateWidgets, updateDashboard, updateMetrics } = useDashboard();

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
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (!currentDashboard) return;
    
    const updatedWidgets = currentDashboard.widgets.filter(w => w.id !== widgetId);
    debouncedUpdateWidgets(updatedWidgets);
  };

  const handleEditWidget = (widget: Widget) => {
    if (!currentDashboard) return;
    
    const updatedWidgets = currentDashboard.widgets.map(w => 
      w.id === widget.id ? widget : w
    );
    debouncedUpdateWidgets(updatedWidgets);
  };

  const handleAddMetric = (metric: Omit<MetricCard, 'id'>) => {
    if (!currentDashboard) return;

    const newMetric: MetricCard = {
      id: `metric-${Date.now()}`,
      ...metric
    };

    const updatedMetrics = [...(currentDashboard.metrics || []), newMetric];
    updateMetrics(updatedMetrics);
    
    setShowAddMetric(false);
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <StaticMetricsCards
              metrics={currentDashboard?.metrics || []}
              onAddMetric={() => setShowAddMetric(true)}
              onEditMetric={(metric) => {
                setEditingMetric(metric);
                setShowAddMetric(true);
              }}
              onDeleteMetric={handleDeleteMetric}
            />
            {currentDashboard && (
              <WidgetManager
                widgets={currentDashboard.widgets || []}
                onWidgetsChange={updateWidgets}
                isGridView={isGridView}
                onDeleteWidget={handleDeleteWidget}
                onEditWidget={handleEditWidget}
                onAddWidget={() => setShowAddWidget(true)}
              />
            )}
          </>
        );
      case 'panels':
        return <div className="p-6 text-gray-800 dark:text-gray-200">Active Panels Content</div>;
      case 'trends':
        return <div className="p-6 text-gray-800 dark:text-gray-200">Data Trends Content</div>;
      case 'health':
        return <div className="p-6 text-gray-800 dark:text-gray-200">Automations Health Content</div>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex space-x-4">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsGridView(!isGridView)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 rounded-lg"
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
        </div>
      </div>

      {/* Dynamic Content Based on Active Tab */}
      {renderTabContent()}

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={showAddWidget}
        onClose={() => setShowAddWidget(false)}
        onAddWidget={handleAddWidget}
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
    </div>
  );
}; 