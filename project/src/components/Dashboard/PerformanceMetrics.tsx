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
  ChevronRight
} from 'lucide-react';

interface Metric {
  id: number;
  name: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  timeframe: string;
  icon: React.ElementType;
}

const metrics: Metric[] = [
  {
    id: 1,
    name: 'Active Users',
    value: '2,847',
    change: 12.5,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Users
  },
  {
    id: 2,
    name: 'Data Processing',
    value: '1.2M',
    change: -4.2,
    trend: 'down',
    timeframe: 'vs last month',
    icon: Database
  },
  {
    id: 3,
    name: 'Response Time',
    value: '245ms',
    change: 0,
    trend: 'neutral',
    timeframe: 'vs last month',
    icon: Zap
  },
  {
    id: 4,
    name: 'System Uptime',
    value: '99.9%',
    change: 0.1,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Clock
  }
];

const timeframes = [
  { id: 'day', label: '24h' },
  { id: 'week', label: '7d' },
  { id: 'month', label: '30d' },
  { id: 'quarter', label: '90d' }
];

export const PerformanceMetrics: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [settingsPosition, setSettingsPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            Performance Metrics
          </h2>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1">
        {timeframes.map((timeframe) => (
          <button
            key={timeframe.id}
            className="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap
              bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700
              transition-colors duration-150"
          >
            {timeframe.label}
          </button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-200 group"
          >
            {/* Header with Icon and Settings */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg shrink-0">
                  <metric.icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {metric.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {metric.timeframe}
                  </p>
                </div>
              </div>
              <button 
                onClick={(e) => handleSettingsClick(metric, e)}
                className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ml-2 ${
                  selectedMetric?.id === metric.id && showSettings
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                    : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Value and Trend */}
            <div className="mt-2">
              <div className="flex items-baseline space-x-2">
                <p className="text-xl font-semibold text-gray-900 dark:text-white truncate">
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

            {/* Mini Chart */}
            <div className="mt-3 relative h-12">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-white/40 dark:via-gray-800/20 dark:to-gray-800/40 rounded-lg z-10" />
              <div className="h-full bg-gradient-to-b from-purple-50 to-purple-100/20 dark:from-purple-900/20 dark:to-purple-900/5 rounded-lg overflow-hidden" />
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
    </div>
  );
}; 