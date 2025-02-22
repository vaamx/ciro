import React from 'react';
import { DollarSign, Users, TrendingUp, UserPlus, Plus } from 'lucide-react';

export interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  type: 'currency' | 'number' | 'percentage' | 'users';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  timeframe?: string;
  icon?: keyof typeof metricIcons;
}

const metricIcons = {
  currency: DollarSign,
  users: Users,
  trending: TrendingUp,
  newUsers: UserPlus,
} as const;

interface StaticMetricsCardsProps {
  metrics: MetricCard[];
  onAddMetric?: () => void;
  onEditMetric?: (metric: MetricCard) => void;
  onDeleteMetric?: (metricId: string) => void;
}

export const StaticMetricsCards: React.FC<StaticMetricsCardsProps> = ({
  metrics,
  onAddMetric,
  onEditMetric,
  onDeleteMetric,
}) => {
  const getIcon = (type: MetricCard['type'], iconKey?: keyof typeof metricIcons) => {
    if (iconKey && metricIcons[iconKey]) {
      return metricIcons[iconKey];
    }
    switch (type) {
      case 'currency':
        return DollarSign;
      case 'users':
        return Users;
      case 'percentage':
        return TrendingUp;
      default:
        return TrendingUp;
    }
  };

  const formatValue = (value: string | number, type: MetricCard['type']) => {
    if (typeof value === 'string') return value;
    switch (type) {
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 pt-6">
      {metrics.map((metric) => {
        const Icon = getIcon(metric.type, metric.icon);
        return (
          <div
            key={metric.id}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl 
              shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]
              hover:shadow-[0_8px_30px_-4px_rgba(145,115,225,0.2)] dark:hover:shadow-[0_8px_30px_-4px_rgba(145,115,225,0.3)]
              border border-gray-200 dark:border-gray-700/80
              transition-all duration-300 ease-out
              hover:border-purple-200 dark:hover:border-purple-700
              hover:translate-y-[-2px]
              group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700
                  group-hover:bg-purple-50 dark:group-hover:bg-purple-900/50 
                  transition-all duration-300 ring-1 ring-gray-100 dark:ring-gray-700
                  group-hover:ring-purple-200 dark:group-hover:ring-purple-700">
                  <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300 
                    group-hover:text-purple-600 dark:group-hover:text-purple-400 
                    transition-colors" />
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200
                  group-hover:text-purple-700 dark:group-hover:text-purple-300
                  transition-all duration-300">
                  {metric.title}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                {onEditMetric && (
                  <button
                    onClick={() => onEditMetric(metric)}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                      hover:text-purple-600 dark:hover:text-purple-400 
                      hover:bg-purple-50 dark:hover:bg-purple-900/50
                      active:bg-purple-100 dark:active:bg-purple-900/70
                      transition-all duration-200"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {onDeleteMetric && (
                  <button
                    onClick={() => onDeleteMetric(metric.id)}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                      hover:text-red-600 dark:hover:text-red-400 
                      hover:bg-red-50 dark:hover:bg-red-900/50
                      active:bg-red-100 dark:active:bg-red-900/70
                      transition-all duration-200"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-center">
                <span className="text-2xl font-semibold text-gray-900 dark:text-white
                  group-hover:text-purple-700 dark:group-hover:text-purple-300
                  transition-all duration-300">
                  {formatValue(metric.value, metric.type)}
                </span>
                {metric.trend && (
                  <span
                    className={`ml-2 text-sm font-medium flex items-center ${
                      metric.trend.isPositive 
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-200 dark:ring-emerald-700 px-2 py-0.5 rounded-full' 
                        : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-700 px-2 py-0.5 rounded-full'
                    }`}
                  >
                    {metric.trend.isPositive ? '↑' : '↓'} {Math.abs(metric.trend.value)}%
                  </span>
                )}
              </div>
            </div>
            {metric.timeframe && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300
                  group-hover:text-purple-600 dark:group-hover:text-purple-400
                  transition-all duration-300">
                  {metric.timeframe}
                </span>
                <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full
                  bg-gray-50 dark:bg-gray-700 ring-1 ring-gray-100 dark:ring-gray-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    Updated 2m ago
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {onAddMetric && (
        <button
          onClick={onAddMetric}
          className="relative flex items-center justify-center h-full min-h-[160px] 
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
              Add New Metric
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
      )}
    </div>
  );
}; 