import { motion } from 'framer-motion';
import type { ChatSettings } from '../types';
import type { ModelType } from '../types/models';

export interface ThreadSettingsProps {
  settings: ChatSettings;
  onChange: (settings: Partial<ChatSettings>) => void;
}

export function ThreadSettings({ settings, onChange }: ThreadSettingsProps) {
  const handleChange = (key: keyof ChatSettings, value: any) => {
    onChange({ [key]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
          </label>
          <select
            value={settings.model}
            onChange={(e) => handleChange('model', e.target.value as ModelType)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="gpt-4o-mini">GPT-4 Optimized Mini (Fast)</option>
            <option value="gpt-4o">GPT-4 Optimized (Balanced)</option>
            <option value="o3-mini">O3 Mini (Reasoning)</option>
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {settings.model === 'gpt-4o-mini' && 'Fastest responses, cost-effective, great for most tasks'}
            {settings.model === 'gpt-4o' && 'High intelligence, balanced speed and capabilities'}
            {settings.model === 'o3-mini' && 'Specialized for complex reasoning tasks'}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Temperature
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.temperature || 0.7}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Controls randomness: Lower values are more focused, higher values more creative
          </p>
        </div>
      </div>
    </motion.div>
  );
} 