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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric) => {
        const Icon = getIcon(metric.type, metric.icon);
        return (
          <div
            key={metric.id}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {metric.title}
              </span>
              <div className="flex items-center space-x-2">
                {onEditMetric && (
                  <button
                    onClick={() => onEditMetric(metric)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {onDeleteMetric && (
                  <button
                    onClick={() => onDeleteMetric(metric.id)}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <div className="flex items-center">
                <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatValue(metric.value, metric.type)}
                </span>
              </div>
              {metric.trend && (
                <span
                  className={`ml-2 text-sm font-medium ${
                    metric.trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {metric.trend.isPositive ? '↑' : '↓'} {Math.abs(metric.trend.value)}%
                </span>
              )}
            </div>
            {metric.timeframe && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {metric.timeframe}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Last updated 2 mins ago
                </span>
              </div>
            )}
          </div>
        );
      })}
      
      {onAddMetric && (
        <button
          onClick={onAddMetric}
          className="flex items-center justify-center h-full min-h-[160px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
        >
          <div className="text-center">
            <Plus className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400" />
            <span className="mt-2 block text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-300">
              Add New Metric
            </span>
          </div>
        </button>
      )}
    </div>
  );
}; 