import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  Edit, 
  Trash, 
  PlusCircle,
  Activity,
  Users,
  Clock,
  DollarSign,
  ShoppingCart,
  Package,
  AlertCircle,
  CheckCircle,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';

export interface MetricCard {
  id: string;
  title: string;
  value: number | string;
  trend?: number;
  type?: string;
  period?: string;
  status?: 'positive' | 'negative' | 'neutral';
  prefix?: string;
  suffix?: string;
  icon?: string;
  color?: string;
}

interface StaticMetricsCardsProps {
  metrics: MetricCard[];
  onAddMetric: () => void;
  onEditMetric: (metric: MetricCard) => void;
  onDeleteMetric: (id: string) => void;
}

export const StaticMetricsCards: React.FC<StaticMetricsCardsProps> = ({
  metrics,
  onAddMetric,
  onEditMetric,
  onDeleteMetric
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getIconByType = (type?: string) => {
    switch (type) {
      case 'users':
        return <Users className="w-5 h-5" />;
      case 'time':
        return <Clock className="w-5 h-5" />;
      case 'revenue':
        return <DollarSign className="w-5 h-5" />;
      case 'orders':
        return <ShoppingCart className="w-5 h-5" />;
      case 'products':
        return <Package className="w-5 h-5" />;
      case 'errors':
        return <AlertCircle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const formatValue = (value: number | string, prefix?: string, suffix?: string) => {
    if (typeof value === 'number') {
      const formattedNumber = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2
      }).format(value);
      return `${prefix || ''}${formattedNumber}${suffix || ''}`;
    }
    return `${prefix || ''}${value}${suffix || ''}`;
  };

  const renderTrendBadge = (trend?: number, status?: 'positive' | 'negative' | 'neutral') => {
    if (trend === undefined) return null;

    let Icon;
    let bgColor;
    let textColor;

    if (status === 'positive' || (status === undefined && trend > 0)) {
      Icon = ArrowUp;
      bgColor = 'bg-green-100 dark:bg-green-900/30';
      textColor = 'text-green-700 dark:text-green-400';
    } else if (status === 'negative' || (status === undefined && trend < 0)) {
      Icon = ArrowDown;
      bgColor = 'bg-red-100 dark:bg-red-900/30';
      textColor = 'text-red-700 dark:text-red-400';
    } else {
      Icon = ArrowRight;
      bgColor = 'bg-gray-100 dark:bg-gray-800';
      textColor = 'text-gray-700 dark:text-gray-400';
    }

    return (
      <span className={`flex items-center space-x-1 rounded-full px-2 py-1 text-xs font-medium ${bgColor} ${textColor}`}>
        <Icon className="w-3 h-3" />
        <span>{Math.abs(trend)}%</span>
      </span>
    );
  };

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmId === id) {
      onDeleteMetric(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  return (
    <div className="px-4 sm:px-6 pb-4 sm:pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm relative
              border border-gray-100 dark:border-gray-700 flex flex-col
              hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow duration-200`}
          >
            {/* Card Header */}
            <div className="flex justify-between items-start mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                ${metric.color || 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'}`}>
                {getIconByType(metric.type)}
              </div>
              
              <div className="flex space-x-1">
                <button
                  onClick={() => onEditMetric(metric)}
                  className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 
                    rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label={`Edit ${metric.title}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteClick(metric.id)}
                  className={`p-1.5 rounded-full transition-colors ${
                    deleteConfirmId === metric.id
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  aria-label={deleteConfirmId === metric.id ? `Confirm delete ${metric.title}` : `Delete ${metric.title}`}
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Card Content */}
            <div className="flex-1">
              <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {metric.title}
              </h3>
              <div className="flex items-baseline mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white mr-2">
                  {formatValue(metric.value, metric.prefix, metric.suffix)}
                </span>
                {renderTrendBadge(metric.trend, metric.status)}
              </div>
              {metric.period && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {metric.period}
                </p>
              )}
            </div>
          </motion.div>
        ))}
        
        {/* Add Metric Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onAddMetric}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed 
            border-gray-200 dark:border-gray-700 p-4 flex flex-col items-center justify-center 
            cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/30 hover:border-purple-300 
            dark:hover:border-purple-700 transition-all duration-200 min-h-[160px]"
        >
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 
            flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Add New Metric
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            Track important KPIs
          </span>
        </motion.div>
      </div>
      
      {/* Mobile Add Floating Button (when no metrics exist) */}
      {isMobile && metrics.length === 0 && (
        <div className="flex justify-center mt-6">
          <button 
            onClick={onAddMetric}
            className="flex items-center gap-2 py-3 px-5 bg-purple-600 hover:bg-purple-700
              dark:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-full
              shadow-md hover:shadow-lg transition-all duration-200"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Add Your First Metric</span>
          </button>
        </div>
      )}
    </div>
  );
}; 