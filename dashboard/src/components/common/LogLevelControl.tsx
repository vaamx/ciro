import React, { useState } from 'react';
import { logger, LogLevel } from '../../utils/logger';

interface LogLevelControlProps {
  showDetailed?: boolean;
  className?: string;
}

export const LogLevelControl: React.FC<LogLevelControlProps> = ({ 
  showDetailed = false,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSettings, setCurrentSettings] = useState(logger.getConfig());

  const handleLevelChange = (level: LogLevel) => {
    logger.setLevel(level);
    setCurrentSettings(logger.getConfig());
  };

  const handleComponentLevelChange = (component: string, level: LogLevel) => {
    logger.setComponentLevel(component, level);
    setCurrentSettings(logger.getConfig());
  };

  const handleReset = () => {
    logger.resetConfig();
    setCurrentSettings(logger.getConfig());
  };

  const handleToggleTimestamps = () => {
    logger.toggleTimestamps();
    setCurrentSettings(logger.getConfig());
  };

  return (
    <div className={`relative ${className}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        Log Level: {LogLevel[currentSettings.level]}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 p-3 rounded shadow-lg bg-white dark:bg-gray-800 z-50 w-64 text-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Log Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <p className="mb-2 text-xs">Global Log Level:</p>
            <div className="grid grid-cols-5 gap-1">
              {Object.entries(LogLevel)
                .filter(([key]) => isNaN(Number(key)))
                .map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => handleLevelChange(value as LogLevel)}
                    className={`px-2 py-1 text-xs rounded ${
                      currentSettings.level === value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                    }`}
                  >
                    {key}
                  </button>
                ))}
            </div>
          </div>
          
          {showDetailed && (
            <div className="mb-4">
              <p className="mb-2 text-xs">Component Log Levels:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(currentSettings.componentLevels).map(([component, level]) => (
                  <div key={component} className="flex items-center justify-between">
                    <span className="text-xs font-mono">{component}</span>
                    <select
                      value={level}
                      onChange={(e) => handleComponentLevelChange(component, Number(e.target.value))}
                      className="text-xs px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                    >
                      {Object.entries(LogLevel)
                        .filter(([key]) => isNaN(Number(key)))
                        .map(([key, value]) => (
                          <option key={key} value={value}>
                            {key}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleToggleTimestamps}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              {currentSettings.showTimestamps ? 'Hide' : 'Show'} Timestamps
            </button>
            
            <button
              onClick={handleReset}
              className="text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
            >
              Reset All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 