import React from 'react';
import { 
  DollarSign, 
  Users, 
  ShoppingCart, 
  Share2,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string | number;
  trend: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  period: string;
  icon: React.ElementType;
  color: string;
}

const metrics: MetricCard[] = [
  {
    title: 'Sales',
    value: '75%',
    trend: { value: 7, direction: 'up' },
    period: 'Conversion rate',
    icon: DollarSign,
    color: 'blue'
  },
  {
    title: 'Revenue',
    value: '$4,300',
    trend: { value: 8, direction: 'up' },
    period: 'Last 7 days',
    icon: TrendingUp,
    color: 'green'
  },
  {
    title: 'New Clients',
    value: '6,782',
    trend: { value: 0, direction: 'neutral' },
    period: 'Last 7 days',
    icon: Users,
    color: 'yellow'
  },
  {
    title: 'Active Users',
    value: '2,986',
    trend: { value: 4, direction: 'up' },
    period: 'Last 7 days',
    icon: Users,
    color: 'blue'
  }
];

export const StaticMetricsCards: React.FC = () => {
  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 dark:text-gray-400 font-medium">{metric.title}</h3>
              <div className={`p-2 bg-${metric.color}-50 dark:bg-${metric.color}-900/30 rounded-lg`}>
                <metric.icon className={`w-5 h-5 text-${metric.color}-600 dark:text-${metric.color}-400`} />
              </div>
            </div>
            
            <div className="flex-grow">
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</span>
                <span className={`flex items-center ${getTrendColor(metric.trend.direction)} text-sm`}>
                  {getTrendIcon(metric.trend.direction)}
                  <span className="ml-1">{metric.trend.value}%</span>
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{metric.period}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last updated</span>
                <span className="text-gray-900 dark:text-gray-300">2 mins ago</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 