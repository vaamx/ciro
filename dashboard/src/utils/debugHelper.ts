/**
 * Debug Helper Utilities
 * 
 * This file provides helper functions to control debugging and logging at runtime.
 * These utilities can be accessed from the browser console.
 */

import { logger, LogLevel } from './logger';

/**
 * Initialize debug helper functions in the global scope
 * This makes them available in the browser console
 */
export const initDebugHelpers = () => {
  if (typeof window !== 'undefined') {
    // Create a global debug object
    (window as any).debugUtils = {
      // Disable all logging
      disableAllLogs: () => {
        logger.setLevel(LogLevel.NONE);
        console.log('All logs disabled. To re-enable, use debugUtils.enableLogs()');
      },
      
      // Enable minimal logging (errors only)
      enableMinimalLogs: () => {
        logger.setLevel(LogLevel.ERROR);
        console.log('Minimal logging enabled (errors only)');
      },
      
      // Enable normal logging (errors and warnings)
      enableNormalLogs: () => {
        logger.setLevel(LogLevel.WARN);
        console.log('Normal logging enabled (errors and warnings)');
      },
      
      // Enable verbose logging (all levels)
      enableVerboseLogs: () => {
        logger.setLevel(LogLevel.DEBUG);
        console.log('Verbose logging enabled (all log levels)');
      },
      
      // Disable visualization-related logs
      disableChartLogs: () => {
        logger.setComponentLevel('Visualization', LogLevel.NONE);
        console.log('Visualization logs disabled');
      },
      
      // Disable data source card logs
      disableDataSourceLogs: () => {
        logger.setComponentLevel('DataSourceCard', LogLevel.NONE);
        console.log('DataSourceCard logs disabled');
      },
      
      // Help information
      help: () => {
        console.log(`
Debug Utilities Help:
--------------------
debugUtils.disableAllLogs() - Disable all logging
debugUtils.enableMinimalLogs() - Enable only error logs
debugUtils.enableNormalLogs() - Enable errors and warnings
debugUtils.enableVerboseLogs() - Enable all logs (verbose mode)
debugUtils.disableChartLogs() - Disable visualization-related logs
debugUtils.disableDataSourceLogs() - Disable data source card logs
debugUtils.help() - Show this help message
        `);
      }
    };
    
    // Log info about available debug utilities
    console.log(
      'Debug utilities available as "debugUtils" in the console. ' +
      'Type debugUtils.help() for usage.'
    );
  }
};

// Export the function for use in application startup
export default initDebugHelpers;

// Debug logging control for Studio components
export const disableStudioDebugLogs = () => {
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  
  // Filter out logs from Studio components
  console.log = function(...args: any[]) {
    const message = args[0]?.toString() || '';
    if (
      // Skip studio-related debugging logs
      message.includes('Studio') ||
      message.includes('Workspace') ||
      message.includes('Chart') ||
      message.includes('cursor') ||
      message.includes('collaboration') ||
      message.includes('Mock sending message')
    ) {
      // Skip these messages
      return;
    }
    
    // Pass through other logs
    originalConsoleLog.apply(console, args);
  };
  
  // Also filter warnings
  console.warn = function(...args: any[]) {
    const message = args[0]?.toString() || '';
    if (
      message.includes('Studio') ||
      message.includes('Workspace') ||
      message.includes('Chart') ||
      message.includes('cursor')
    ) {
      // Skip these messages
      return;
    }
    
    // Pass through other warnings
    originalConsoleWarn.apply(console, args);
  };
  
  // Return a function to restore original behavior
  return () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  };
};

// Auto-apply debug log filtering in non-development environments
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
  disableStudioDebugLogs();
}

// Setup global debug utilities
export const setupDebugUtils = () => {
  if (typeof window !== 'undefined') {
    // Add debug utilities to window object
    (window as any).debugUtils = {
      // Show helpful commands
      help: () => {
        console.log('Debug Utilities:');
        console.log('  debugUtils.disableStudioLogs() - Disable Studio component debug logs');
        console.log('  debugUtils.enableStudioLogs() - Re-enable Studio component debug logs');
        console.log('  debugUtils.help() - Show this help message');
      },
      
      // Toggle Studio debug logs
      disableStudioLogs: disableStudioDebugLogs,
      enableStudioLogs: null as (() => void) | null,
      
      // Toggle logging
      toggleStudioLogs: () => {
        if ((window as any).debugUtils.enableStudioLogs) {
          (window as any).debugUtils.enableStudioLogs();
          (window as any).debugUtils.enableStudioLogs = null;
          console.log('Studio debug logs enabled');
        } else {
          (window as any).debugUtils.enableStudioLogs = disableStudioDebugLogs();
          console.log('Studio debug logs disabled');
        }
      }
    };
    
    console.log('Debug utilities available as "debugUtils" in the console. Type debugUtils.help() for usage.');
  }
};

// Auto-setup debug utils
setupDebugUtils(); 