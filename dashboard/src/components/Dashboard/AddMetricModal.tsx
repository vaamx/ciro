import React, { useState, useEffect } from 'react';
import { X, DollarSign, Users, TrendingUp, Hash, Check, AlertCircle } from 'lucide-react';
import type { MetricCard } from './StaticMetricsCards';

interface AddMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (metric: Omit<MetricCard, 'id'>) => void;
  editingMetric?: MetricCard;
}

const metricTypes = [
  { value: 'users', label: 'Users' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'products', label: 'Products' },
  { value: 'time', label: 'Time' },
  { value: 'errors', label: 'Errors' },
  { value: 'success', label: 'Success' }
];

export const AddMetricModal: React.FC<AddMetricModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMetric
}) => {
  const [formData, setFormData] = useState<Omit<MetricCard, 'id'>>({
    title: '',
    value: '',
    type: 'users',
    trend: undefined,
    period: 'Last 30 days',
    status: 'neutral',
    prefix: '',
    suffix: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset form when opening modal
  useEffect(() => {
    if (isOpen) {
      if (editingMetric) {
        setFormData({
          title: editingMetric.title,
          value: editingMetric.value,
          type: editingMetric.type || 'users',
          trend: editingMetric.trend,
          period: editingMetric.period || 'Last 30 days',
          status: editingMetric.status || 'neutral',
          prefix: editingMetric.prefix || '',
          suffix: editingMetric.suffix || '',
          color: editingMetric.color
        });
      } else {
        setFormData({
          title: '',
          value: '',
          type: 'users',
          trend: undefined,
          period: 'Last 30 days',
          status: 'neutral',
          prefix: '',
          suffix: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, editingMetric]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.value && formData.value !== 0) {
      newErrors.value = 'Value is required';
    }
    
    if (formData.trend !== undefined) {
      const trendValue = Number(formData.trend);
      if (isNaN(trendValue)) {
        newErrors.trend = 'Trend must be a number';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Convert value to appropriate type before saving
      const processedFormData = {
        ...formData,
        value: isNaN(Number(formData.value)) ? formData.value : Number(formData.value),
        trend: formData.trend !== undefined ? Number(formData.trend) : undefined
      };
      
      onSave(processedFormData);
    }
  };

  // Helper to show icon based on metric type
  const getTypeIcon = () => {
    switch (formData.type) {
      case 'currency': return <DollarSign className="w-4 h-4 text-green-600" />;
      case 'users': return <Users className="w-4 h-4 text-blue-600" />;
      case 'percentage': return <TrendingUp className="w-4 h-4 text-purple-600" />;
      default: return <Hash className="w-4 h-4 text-gray-600" />;
    }
  };

  // These items are kept for future enhancements but not currently used
  // @ts-ignore
  const timeframeSuggestions = [
    'Today', 
    'Last 7 days', 
    'Last 30 days', 
    'This month', 
    'This quarter', 
    'This year', 
    'vs last month', 
    'vs last year'
  ];

  // Preview function kept for potential future use
  // @ts-ignore
  const renderPreview = () => {
    const formattedValue = (() => {
      if (!formData.value) return '0';
      
      switch (formData.type) {
        case 'currency': return `$${Number(formData.value).toLocaleString()}`;
        case 'percentage': return `${formData.value}%`;
        case 'number': return Number(formData.value).toLocaleString();
        default: return formData.value;
      }
    })();
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</h4>
        <div className="flex items-center space-x-2 mb-2">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
            {getTypeIcon()}
          </div>
          <div className="font-medium text-gray-900 dark:text-white">
            {formData.title || 'Untitled Metric'}
          </div>
        </div>
        <div className="flex items-center">
          <span className="text-xl font-semibold text-gray-900 dark:text-white">{formattedValue}</span>
          {formData.trend && (
            <span 
              className={`ml-2 text-xs font-medium flex items-center px-2 py-0.5 rounded-full ${
                formData.trend > 0 
                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' 
                  : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
              }`}
            >
              {formData.trend > 0 ? '↑' : '↓'} {Math.abs(formData.trend)}%
            </span>
          )}
        </div>
        {formData.period && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            {formData.period}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div 
          className={`relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 
            ${isMobile ? 'w-full max-w-[95%]' : 'w-full max-w-md'}
            shadow-xl transition-all px-4 pb-4 pt-5 sm:p-6 text-left`}
        >
          <div className="absolute right-3 top-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white
                hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingMetric ? 'Edit Metric' : 'Add New Metric'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editingMetric 
                ? 'Update the details for this metric card' 
                : 'Create a new metric card to track key business data'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Metric Title*
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 rounded-lg border ${
                  errors.title 
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } dark:bg-gray-700 dark:text-white placeholder-gray-400 shadow-sm`}
                placeholder="e.g., Active Users"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  {errors.title}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value*
                </label>
                <input
                  type="text"
                  id="value"
                  name="value"
                  value={formData.value}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 rounded-lg border ${
                    errors.value 
                      ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                  } dark:bg-gray-700 dark:text-white placeholder-gray-400 shadow-sm`}
                  placeholder="e.g., 12500"
                />
                {errors.value && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    {errors.value}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Metric Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                    focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white shadow-sm"
                >
                  {metricTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="prefix" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prefix
                </label>
                <input
                  type="text"
                  id="prefix"
                  name="prefix"
                  value={formData.prefix || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                    focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white shadow-sm"
                  placeholder="e.g., $"
                />
              </div>
              
              <div>
                <label htmlFor="suffix" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Suffix
                </label>
                <input
                  type="text"
                  id="suffix"
                  name="suffix"
                  value={formData.suffix || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                    focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white shadow-sm"
                  placeholder="e.g., %"
                />
              </div>
              
              <div>
                <label htmlFor="trend" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trend %
                </label>
                <input
                  type="text"
                  id="trend"
                  name="trend"
                  value={formData.trend !== undefined ? formData.trend : ''}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 rounded-lg border ${
                    errors.trend 
                      ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                  } dark:bg-gray-700 dark:text-white placeholder-gray-400 shadow-sm`}
                  placeholder="e.g., 12.5"
                />
                {errors.trend && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    {errors.trend}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || 'neutral'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                    focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white shadow-sm"
                >
                  <option value="positive">Positive (Green)</option>
                  <option value="negative">Negative (Red)</option>
                  <option value="neutral">Neutral (Gray)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time Period
                </label>
                <input
                  type="text"
                  id="period"
                  name="period"
                  value={formData.period || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                    focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white shadow-sm"
                  placeholder="e.g., Last 30 days"
                />
              </div>
            </div>
            
            <div className="mt-6 sm:flex sm:flex-row-reverse gap-3">
              <button
                type="submit"
                className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg px-4 py-2.5
                  bg-purple-600 hover:bg-purple-700 text-white shadow-sm focus:outline-none
                  focus:ring-2 focus:ring-purple-500 sm:ml-3 text-sm font-medium"
              >
                <Check className="w-4 h-4 mr-1.5" />
                {editingMetric ? 'Update Metric' : 'Add Metric'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center items-center rounded-lg
                  px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                  text-gray-700 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300
                  dark:ring-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; 