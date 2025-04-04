import React, { useState, useRef, useEffect } from 'react';
import { 
  BarChart2, 
  Clock,
  Users,
  Database,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Filter,
  Download,
  RefreshCw,
  X,
  Settings,
  ChevronRight,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { AddMetricModal } from './AddMetricModal';
import { v4 as uuidv4 } from 'uuid';
import { MetricCard } from '../../types/dashboard';

interface Metric {
  id: number | string;
  name: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  timeframe: string;
  icon: React.ElementType;
  chartData?: number[];
  isDefault?: boolean;
  isCustom?: boolean;
}

const metrics: Metric[] = [
  {
    id: 1,
    name: 'Active Users',
    value: '2,847',
    change: 12.5,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Users,
    chartData: [35, 60, 45, 50, 55, 65, 75, 65, 80]
  },
  {
    id: 2,
    name: 'Data Processing',
    value: '1.2M',
    change: -4.2,
    trend: 'down',
    timeframe: 'vs last month',
    icon: Database,
    chartData: [70, 65, 60, 65, 55, 50, 45, 40, 35]
  },
  {
    id: 3,
    name: 'Response Time',
    value: '245ms',
    change: 0,
    trend: 'neutral',
    timeframe: 'vs last month',
    icon: Zap,
    chartData: [50, 45, 50, 45, 50, 45, 50, 45, 50]
  },
  {
    id: 4,
    name: 'System Uptime',
    value: '99.9%',
    change: 0.1,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Clock,
    chartData: [90, 85, 95, 85, 90, 95, 90, 95, 98]
  }
];

const timeframes = [
  { id: 'day', label: '24h' },
  { id: 'week', label: '7d' },
  { id: 'month', label: '30d', active: true },
  { id: 'quarter', label: '90d' }
];

export const PerformanceMetrics: React.FC = () => {
  const [activeTimeframe, setActiveTimeframe] = useState('month');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [settingsPosition, setSettingsPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentDashboard, updateMetrics } = useDashboard();
  const [customMetrics, setCustomMetrics] = useState<MetricCard[]>([]);
  const [hiddenMetrics, setHiddenMetrics] = useState<(string | number)[]>([]);

  useEffect(() => {
    // Load custom metrics from the dashboard context when available
    if (currentDashboard?.metrics) {
      setCustomMetrics(currentDashboard.metrics);
    }
    
    // Load hidden metrics from localStorage
    try {
      const savedHiddenMetrics = localStorage.getItem('hidden_default_metrics');
      if (savedHiddenMetrics) {
        setHiddenMetrics(JSON.parse(savedHiddenMetrics));
      }
    } catch (error) {
      console.error('Error loading hidden metrics from localStorage:', error);
    }
  }, [currentDashboard?.metrics]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTimeframeChange = (timeframeId: string) => {
    setActiveTimeframe(timeframeId);
  };

  const handleSettingsClick = (metric: Metric, event: React.MouseEvent) => {
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

    if (selectedMetric?.id === metric.id && showSettings) {
      setShowSettings(false);
    } else {
      setSelectedMetric(metric);
      setShowSettings(true);
    }
  };

  const handleMenuClick = (metricId: number | string, event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(menuOpen === metricId ? null : metricId);
  };

  const handleRemoveMetric = (metric: Metric, event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(null); // Close the menu
    
    // If this is a custom metric (one we added, not a default one)
    if (metric.isCustom && currentDashboard?.metrics) {
      // Filter out the metric with this id from the current dashboard metrics
      const updatedMetrics = currentDashboard.metrics.filter(m => m.id !== metric.id);
      
      // Update the dashboard through context
      updateMetrics(updatedMetrics)
        .then(() => {
          console.log(`Metric '${metric.name}' removed successfully`);
        })
        .catch(error => {
          console.error(`Failed to remove metric '${metric.name}':`, error);
        });
    } else if (metric.isDefault) {
      // For default metrics, we'll just hide them by storing their IDs in localStorage
      const updatedHiddenMetrics = [...hiddenMetrics, metric.id];
      setHiddenMetrics(updatedHiddenMetrics);
      
      // Save to localStorage
      try {
        localStorage.setItem('hidden_default_metrics', JSON.stringify(updatedHiddenMetrics));
        console.log(`Default metric '${metric.name}' hidden successfully`);
      } catch (error) {
        console.error('Error saving hidden metrics to localStorage:', error);
      }
    }
  };

  const handleAddMetric = (metric: Omit<MetricCard, 'id'>) => {
    if (!currentDashboard) return;
    
    const newMetric: MetricCard = {
      ...metric,
      id: uuidv4()
    };
    
    const updatedMetrics = [...(currentDashboard.metrics || []), newMetric];
    updateMetrics(updatedMetrics);
    setShowAddMetricModal(false);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowUpRight className="w-4 h-4 text-green-500 dark:text-green-400" />;
      case 'down':
        return <ArrowDownRight className="w-4 h-4 text-red-500 dark:text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Combine default metrics with custom metrics from the dashboard
  const getAllMetrics = (): Metric[] => {
    const defaultMetrics = metrics
      .filter(m => !hiddenMetrics.includes(m.id)) // Filter out hidden default metrics
      .map(m => ({
        ...m,
        isDefault: true
      }));
    
    const customMetricsFormatted = customMetrics.map(m => ({
      id: m.id,
      name: m.title,
      value: typeof m.value === 'number' ? m.value.toString() : (m.value || "0"),
      change: m.trend || 0,
      trend: (m.trend && m.trend > 0) ? 'up' as const : (m.trend && m.trend < 0) ? 'down' as const : 'neutral' as const,
      timeframe: m.period || 'vs last month',
      icon: metricTypeToIcon(m.type),
      chartData: m.chartData || [50, 60, 70, 65, 75, 70, 80, 75],
      isCustom: true
    }));
    
    return [...defaultMetrics, ...customMetricsFormatted];
  };
  
  const metricTypeToIcon = (type?: string): React.ElementType => {
    switch (type) {
      case 'users': return Users;
      case 'data': return Database;
      case 'time': return Clock;
      case 'performance': return Zap;
      default: return Users;
    }
  };

  // Function to restore hidden default metrics
  const handleRestoreDefaultMetrics = () => {
    setHiddenMetrics([]);
    localStorage.removeItem('hidden_default_metrics');
  };

  return (
    <div className="space-y-5">
      {/* Header with new design */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-purple-100/80 dark:bg-purple-900/30 rounded-lg">
            <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              Performance Metrics
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Track key performance indicators
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button 
            onClick={() => setShowAddMetricModal(true)}
            className="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Metric
          </button>
          
          {/* Show Restore button if metrics are hidden */}
          {hiddenMetrics.length > 0 && (
            <button 
              onClick={handleRestoreDefaultMetrics}
              className="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Restore Default Metrics
            </button>
          )}
          
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-l-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700"></div>
            <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700"></div>
            <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-r-lg transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeframe Selector - new pill design */}
      <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1">
        {timeframes.map((timeframe) => (
          <button
            key={timeframe.id}
            onClick={() => handleTimeframeChange(timeframe.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap
              ${activeTimeframe === timeframe.id 
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
              } border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500/30`}
          >
            {timeframe.label}
          </button>
        ))}
      </div>

      {/* Metrics Grid with new card design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {getAllMetrics().map((metric) => (
          <div
            key={metric.id}
            className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            {/* Header with Icon and Actions */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <metric.icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
                    {metric.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {metric.timeframe}
                  </p>
                </div>
              </div>
              <div className="relative">
                <button 
                  onClick={(e) => handleMenuClick(metric.id, e)}
                  className="p-1.5 rounded-lg transition-colors text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {menuOpen === metric.id && (
                  <div 
                    ref={menuOpen === metric.id ? menuRef : null}
                    className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 z-10 py-1"
                  >
                    <button 
                      onClick={(e) => handleSettingsClick(metric, e)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                    >
                      <Settings className="w-3.5 h-3.5 mr-2 text-gray-500 dark:text-gray-400" />
                      Settings
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                      <RefreshCw className="w-3.5 h-3.5 mr-2 text-gray-500 dark:text-gray-400" />
                      Refresh
                    </button>
                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                    <button 
                      onClick={(e) => handleRemoveMetric(metric, e)}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                    >
                      <X className="w-3.5 h-3.5 mr-2" />
                      {metric.isDefault ? 'Hide' : 'Remove'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Value and Trend with new styling */}
            <div className="mt-3">
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {metric.value}
                </p>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(metric.trend)}
                  <span className={`text-xs font-medium ${getTrendColor(metric.trend)}`}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                </div>
              </div>
            </div>

            {/* Mini Chart - Enhanced version */}
            <div className="mt-3 h-14 bg-gray-50 dark:bg-gray-900/20 rounded-lg overflow-hidden">
              {metric.chartData && (
                <div className="flex items-end h-full w-full justify-between px-1">
                  {metric.chartData.map((val: number, i: number) => {
                    // Normalize the chart data
                    const data = metric.chartData || [];
                    const max = Math.max(...data);
                    const min = Math.min(...data);
                    const range = max - min;
                    const height = ((val - min) / (range || 1)) * 100;
                    
                    return (
                      <div 
                        key={i}
                        className={`w-[3px] rounded-t ${
                          metric.trend === 'up' 
                            ? 'bg-green-400 dark:bg-green-500' 
                            : metric.trend === 'down'
                              ? 'bg-red-400 dark:bg-red-500'
                              : 'bg-gray-400 dark:bg-gray-500'
                        }`}
                        style={{ height: `${Math.max(5, height)}%` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Settings Panel */}
      {showSettings && selectedMetric && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/5 dark:bg-black/20 z-40" onClick={() => setShowSettings(false)} />
          
          {/* Panel */}
          <div 
            ref={settingsRef}
            className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80 z-50 transform transition-all duration-200 ease-out"
            style={{ 
              top: `${settingsPosition.top}px`, 
              left: `${settingsPosition.left}px`
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <selectedMetric.icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">{selectedMetric.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Widget Settings</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
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

                {/* Show Chart */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show Chart</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Display mini chart</p>
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
              <button className="w-full mt-2 flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <span>Advanced Settings</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
              <div className="flex space-x-2">
                <button 
                  onClick={() => setShowSettings(false)}
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

      {/* Add Metric Modal */}
      <AddMetricModal
        isOpen={showAddMetricModal}
        onClose={() => setShowAddMetricModal(false)}
        onSave={handleAddMetric}
      />
    </div>
  );
}; 