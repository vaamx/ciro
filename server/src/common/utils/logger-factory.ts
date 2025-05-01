/**
 * This file provides a service logger factory using Winston
 */

import * as winston from 'winston';
import { LogLevel } from './logger-config';

// Extend the winston logger with missing methods if they don't exist
if (!winston.Logger.prototype.error) {
  winston.Logger.prototype.error = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('error', message, ...meta);
  };
}

if (!winston.Logger.prototype.warn) {
  winston.Logger.prototype.warn = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('warn', message, ...meta);
  };
}

if (!winston.Logger.prototype.info) {
  winston.Logger.prototype.info = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('info', message, ...meta);
  };
}

if (!winston.Logger.prototype.http) {
  winston.Logger.prototype.http = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('http', message, ...meta);
  };
}

if (!winston.Logger.prototype.verbose) {
  winston.Logger.prototype.verbose = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('verbose', message, ...meta);
  };
}

if (!winston.Logger.prototype.debug) {
  winston.Logger.prototype.debug = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('debug', message, ...meta);
  };
}

if (!winston.Logger.prototype.silly) {
  winston.Logger.prototype.silly = function(this: winston.Logger, message: any, ...meta: any[]): winston.Logger {
    return this.log('silly', message, ...meta);
  };
}

/**
 * Formats log output for services with service name prefix
 */
const serviceLogFormat = (serviceName: string) => 
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
    return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
  });

/**
 * Creates a service logger
 * @param serviceName The name of the service (will be displayed in logs)
 * @returns A configured winston logger instance
 */
export const createServiceLogger = (serviceName: string): winston.Logger => {
  // Define custom levels with 'silly' included
  const customLevels = {
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6
    },
    colors: {
      error: 'red',
      warn: 'yellow',
      info: 'green',
      http: 'cyan',
      verbose: 'blue',
      debug: 'magenta',
      silly: 'grey'
    }
  };

  // Create logger with custom levels
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: customLevels.levels,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      serviceLogFormat(serviceName)
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          serviceLogFormat(serviceName)
        )
      })
    ],
  });

  // Add colors
  winston.addColors(customLevels.colors);

  return logger;
}; 