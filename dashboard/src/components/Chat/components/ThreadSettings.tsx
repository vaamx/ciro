import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { type ChatSettings } from '../types';

export interface ThreadSettingsProps {
  onClose: () => void;
  settings: ChatSettings;
  onChange: (settings: Partial<ChatSettings>) => void;
}

export const ThreadSettings: React.FC<ThreadSettingsProps> = ({ 
  onClose,
  settings,
  onChange,
}) => {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);

  const handleChange = (key: keyof ChatSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onChange({ [key]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-4"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Chat Settings</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure your chat experience
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Model
            </label>
            <select
              value={localSettings.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="gpt-4o">GPT-4 Optimized</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Temperature ({localSettings.temperature})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.temperature}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>More Focused</span>
              <span>More Creative</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Context Length ({localSettings.contextLength} tokens)
            </label>
            <input
              type="range"
              min="1024"
              max="8192"
              step="1024"
              value={localSettings.contextLength}
              onChange={(e) => handleChange('contextLength', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Shorter Memory</span>
              <span>Longer Memory</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex-grow flex flex-col">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Stream Responses
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Show responses as they are generated
              </span>
            </span>
            <button
              type="button"
              onClick={() => handleChange('streaming', !localSettings.streaming)}
              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                localSettings.streaming ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role="switch"
              aria-checked={localSettings.streaming}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                  localSettings.streaming ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {localSettings.streaming && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Tokens ({localSettings.maxTokens || 'Unlimited'})
              </label>
              <input
                type="range"
                min="256"
                max="4096"
                step="256"
                value={localSettings.maxTokens || 4096}
                onChange={(e) => handleChange('maxTokens', parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Shorter Responses</span>
                <span>Longer Responses</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-white dark:bg-gray-800 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}; 