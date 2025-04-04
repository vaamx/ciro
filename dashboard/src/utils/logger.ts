/**
 * Client-side logger utility
 * 
 * This utility provides a way to control logging verbosity in the client-side code.
 * It can be used to reduce the amount of logs in the console, making it easier to
 * focus on important messages like error messages.
 */

// Log levels
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

// Logger configuration types
interface LoggerComponentLevels {
  [component: string]: LogLevel;
}

interface LoggerConfig {
  level: LogLevel;
  componentLevels: LoggerComponentLevels;
  showTimestamps: boolean;
}

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Default configuration
const defaultConfig: LoggerConfig = {
  // In production, set default log level to NONE
  // In development, use ERROR as the default (previously INFO)
  level: isDevelopment ? LogLevel.ERROR : LogLevel.NONE,
  componentLevels: {
    // Component-specific log levels - all reduced to show fewer logs
    'KnowledgeSidebar': LogLevel.ERROR,
    'api': isDevelopment ? LogLevel.ERROR : LogLevel.ERROR, // Keep API errors even in production
    'Thread': LogLevel.ERROR,
    'Visualization': LogLevel.ERROR,
    'DataSourceCard': LogLevel.ERROR
  },
  showTimestamps: false
};

// Logger configuration
let config: LoggerConfig = {
  ...defaultConfig
};

// Check if there's a saved configuration in localStorage - only in development mode
if (isDevelopment) {
  try {
    const savedConfig = localStorage.getItem('logger_config');
    if (savedConfig) {
      config = { ...config, ...JSON.parse(savedConfig) };
    }
  } catch (e) {
    console.error('Error loading logger configuration:', e);
  }
}

// Save configuration to localStorage - only in development mode
const saveConfig = () => {
  if (!isDevelopment) return;
  
  try {
    localStorage.setItem('logger_config', JSON.stringify(config));
  } catch (e) {
    console.error('Error saving logger configuration:', e);
  }
};

// Format message with timestamp if enabled
const formatMessage = (message: string): string => {
  if (config.showTimestamps) {
    const now = new Date();
    return `[${now.toISOString()}] ${message}`;
  }
  return message;
};

// Main logger functions
export const logger = {
  // Set global log level
  setLevel: (level: LogLevel) => {
    config.level = level;
    saveConfig();
    if (isDevelopment) {
      console.info(`Log level set to: ${LogLevel[level]}`);
    }
  },

  // Set component-specific log level
  setComponentLevel: (component: string, level: LogLevel) => {
    config.componentLevels[component] = level;
    saveConfig();
    if (isDevelopment) {
      console.info(`Log level for ${component} set to: ${LogLevel[level]}`);
    }
  },

  // Reset configuration to defaults
  resetConfig: () => {
    config = { ...defaultConfig };
    saveConfig();
    if (isDevelopment) {
      console.info('Logger configuration reset to defaults');
    }
  },

  // Get current configuration
  getConfig: () => {
    return { ...config };
  },

  // Toggle timestamps
  toggleTimestamps: () => {
    config.showTimestamps = !config.showTimestamps;
    saveConfig();
    if (isDevelopment) {
      console.info(`Timestamps ${config.showTimestamps ? 'enabled' : 'disabled'}`);
    }
  },

  // General log method (same as info)
  log: (component: string, message: string, ...args: any[]) => {
    if (config.level >= LogLevel.INFO && 
        (config.componentLevels[component] === undefined || config.componentLevels[component] >= LogLevel.INFO)) {
      console.log(formatMessage(`[${component}] ${message}`), ...args);
    }
  },

  // Logging functions
  error: (component: string, message: string, ...args: any[]) => {
    if (config.level >= LogLevel.ERROR && 
        (config.componentLevels[component] === undefined || config.componentLevels[component] >= LogLevel.ERROR)) {
      console.error(formatMessage(`[${component}] ${message}`), ...args);
    }
  },

  warn: (component: string, message: string, ...args: any[]) => {
    if (config.level >= LogLevel.WARN && 
        (config.componentLevels[component] === undefined || config.componentLevels[component] >= LogLevel.WARN)) {
      console.warn(formatMessage(`[${component}] ${message}`), ...args);
    }
  },

  info: (component: string, message: string, ...args: any[]) => {
    if (config.level >= LogLevel.INFO && 
        (config.componentLevels[component] === undefined || config.componentLevels[component] >= LogLevel.INFO)) {
      console.info(formatMessage(`[${component}] ${message}`), ...args);
    }
  },

  debug: (component: string, message: string, ...args: any[]) => {
    if (config.level >= LogLevel.DEBUG && 
        (config.componentLevels[component] === undefined || config.componentLevels[component] >= LogLevel.DEBUG)) {
      console.debug(formatMessage(`[${component}] ${message}`), ...args);
    }
  },

  // Log an object with JSON formatting
  logObject: (component: string, label: string, obj: any) => {
    if (config.level >= LogLevel.DEBUG && 
        (config.componentLevels[component] === undefined || config.componentLevels[component] >= LogLevel.DEBUG)) {
      console.debug(formatMessage(`[${component}] ${label}:`), JSON.stringify(obj, null, 2));
    }
  }
};

// Export a global log control panel for the browser console - but only in development mode
if (typeof window !== 'undefined' && isDevelopment) {
  (window as any).loggerControl = {
    setLevel: (level: LogLevel | string) => {
      if (typeof level === 'string') {
        const levelEnum = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
        if (levelEnum !== undefined) {
          logger.setLevel(levelEnum);
        } else {
          console.error(`Invalid log level: ${level}. Use one of: ${Object.keys(LogLevel).filter(k => isNaN(Number(k))).join(', ')}`);
        }
      } else {
        logger.setLevel(level);
      }
    },
    setComponentLevel: (component: string, level: LogLevel | string) => {
      if (typeof level === 'string') {
        const levelEnum = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
        if (levelEnum !== undefined) {
          logger.setComponentLevel(component, levelEnum);
        } else {
          console.error(`Invalid log level: ${level}. Use one of: ${Object.keys(LogLevel).filter(k => isNaN(Number(k))).join(', ')}`);
        }
      } else {
        logger.setComponentLevel(component, level);
      }
    },
    resetConfig: logger.resetConfig,
    getConfig: logger.getConfig,
    toggleTimestamps: logger.toggleTimestamps,
    help: () => {
      console.info(`
Logger Control Panel Help:
-------------------------
loggerControl.setLevel(level): Set global log level (NONE, ERROR, WARN, INFO, DEBUG)
loggerControl.setComponentLevel(component, level): Set component-specific log level
loggerControl.resetConfig(): Reset logger configuration to defaults
loggerControl.getConfig(): Get current logger configuration
loggerControl.toggleTimestamps(): Toggle timestamps in log messages
loggerControl.help(): Show this help message

Examples:
loggerControl.setLevel("INFO")
loggerControl.setComponentLevel("KnowledgeSidebar", "WARN")
      `);
    }
  };
  
  // Print a hint about the logger control panel - only in development
  console.info('Logger control panel available as "loggerControl" in the console. Type loggerControl.help() for usage.');
} 