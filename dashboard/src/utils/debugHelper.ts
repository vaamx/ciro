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