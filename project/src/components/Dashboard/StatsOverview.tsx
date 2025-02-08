import React from 'react';
import { 
  Database,
  Link,
  Bot,
  Brain,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface StatsOverviewProps {
  isExpanded?: boolean;
}

interface MetricCard {
  id: number;
  name: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  timeframe: string;
  icon: React.ElementType;
  chartData: number[]; // Last 8 data points
}

const metrics: MetricCard[] = [
  {
    id: 1,
    name: 'Active Data Sources',
    value: '12',
    change: 2.5,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Database,
    chartData: [8, 9, 10, 9, 11, 10, 12, 12] // Shows growth trend
  },
  {
    id: 2,
    name: 'Connected Apps',
    value: '8',
    change: 1.2,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Link,
    chartData: [6, 6, 7, 7, 7, 8, 8, 8] // Steady growth
  },
  {
    id: 3,
    name: 'Active Automations',
    value: '15',
    change: 3.8,
    trend: 'up',
    timeframe: 'vs last month',
    icon: Bot,
    chartData: [10, 11, 12, 13, 14, 14, 15, 15] // Strong upward trend
  },
  {
    id: 4,
    name: 'AI Agents',
    value: '5',
    change: -0.5,
    trend: 'down',
    timeframe: 'vs last month',
    icon: Brain,
    chartData: [6, 6, 5, 6, 5, 5, 5, 5] // Slight decline
  }
];

export const StatsOverview: React.FC<StatsOverviewProps> = ({ isExpanded = false }) => {
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

  const normalizeChartData = (data: number[]) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    return data.map(value => ((value - min) / (range || 1)) * 100);
  };

  return (
    <div className={`grid ${
      isExpanded 
        ? 'grid-cols-4 gap-4' 
        : 'grid-cols-1 sm:grid-cols-2 gap-4'
    }`}>
      {metrics.map((metric) => (
        <div
          key={metric.id}
          className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 transition-all duration-200 group hover:shadow-md"
        >
          {/* Timeframe */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {metric.timeframe}
          </p>

          {/* Title with Icon */}
          <div className="flex items-center space-x-2 mt-1">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <metric.icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
              {metric.name}
            </h3>
          </div>

          {/* Value and Trend */}
          <div className="flex items-baseline space-x-2 mt-3">
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">
              {metric.value}
            </span>
            <div className="flex items-center space-x-1">
              {getTrendIcon(metric.trend)}
              <span className={`text-sm font-medium ${getTrendColor(metric.trend)}`}>
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </span>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="h-12 mt-3">
            <div className="h-full bg-gray-50 dark:bg-gray-900/20 rounded-lg overflow-hidden">
              <div className="flex items-end justify-between h-full px-0.5 pb-0.5">
                {normalizeChartData(metric.chartData).map((height, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-t-sm transition-all duration-300 ${
                      metric.trend === 'up' 
                        ? 'bg-green-400 dark:bg-green-400' 
                        : metric.trend === 'down'
                        ? 'bg-red-400 dark:bg-red-400'
                        : 'bg-gray-400 dark:bg-gray-400'
                    } opacity-75`}
                    style={{
                      height: `${Math.max(15, height)}%`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 