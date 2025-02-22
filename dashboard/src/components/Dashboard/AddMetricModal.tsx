import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { MetricCard } from './StaticMetricsCards';

interface AddMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (metric: Omit<MetricCard, 'id'>) => void;
  editingMetric?: MetricCard;
}

export const AddMetricModal: React.FC<AddMetricModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMetric
}) => {
  const [title, setTitle] = useState(editingMetric?.title || '');
  const [value, setValue] = useState(editingMetric?.value?.toString() || '');
  const [type, setType] = useState<MetricCard['type']>(editingMetric?.type || 'number');
  const [timeframe, setTimeframe] = useState(editingMetric?.timeframe || '');
  const [trendValue, setTrendValue] = useState(editingMetric?.trend?.value?.toString() || '');
  const [trendIsPositive, setTrendIsPositive] = useState(editingMetric?.trend?.isPositive ?? true);

  // Reset form when modal opens or editingMetric changes
  useEffect(() => {
    if (isOpen) {
      setTitle(editingMetric?.title || '');
      setValue(editingMetric?.value?.toString() || '');
      setType(editingMetric?.type || 'number');
      setTimeframe(editingMetric?.timeframe || '');
      setTrendValue(editingMetric?.trend?.value?.toString() || '');
      setTrendIsPositive(editingMetric?.trend?.isPositive ?? true);
    } else {
      // Reset form when modal closes
      setTitle('');
      setValue('');
      setType('number');
      setTimeframe('');
      setTrendValue('');
      setTrendIsPositive(true);
    }
  }, [isOpen, editingMetric]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const metric: Omit<MetricCard, 'id'> = {
      title,
      value: type === 'currency' || type === 'number' 
        ? Number(value) || 0  // Use 0 as default for numbers if value is empty/invalid
        : value || '0',       // Use '0' as default for other types if value is empty
      type,
      timeframe,
      trend: trendValue ? {
        value: Number(trendValue),
        isPositive: trendIsPositive
      } : undefined
    };

    onSave(metric);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editingMetric ? 'Edit Metric' : 'Add New Metric'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MetricCard['type'])}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="percentage">Percentage</option>
              <option value="users">Users</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value
            </label>
            <input
              type={type === 'number' || type === 'currency' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              required
              min={type === 'number' || type === 'currency' ? '0' : undefined}
              step={type === 'currency' ? '0.01' : '1'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timeframe
            </label>
            <input
              type="text"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder="e.g., Last 7 days"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Trend
            </label>
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="number"
                  value={trendValue}
                  onChange={(e) => setTrendValue(e.target.value)}
                  placeholder="Trend value"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <select
                value={trendIsPositive ? 'up' : 'down'}
                onChange={(e) => setTrendIsPositive(e.target.value === 'up')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="up">↑ Up</option>
                <option value="down">↓ Down</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 rounded-lg transition-colors"
            >
              {editingMetric ? 'Save Changes' : 'Add Metric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 