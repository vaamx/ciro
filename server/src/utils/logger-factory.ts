/**
 * This file provides a service logger factory using Winston
 */

import * as winston from 'winston';

// Create a custom format for service loggers
const serviceLogFormat = (serviceName: string) => winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
    return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
  })
);

/**
 * Create a service-specific logger instance
 * @param serviceName The name of the service
 * @returns A Winston logger instance
 */
export function createServiceLogger(serviceName: string): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: serviceLogFormat(serviceName),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          serviceLogFormat(serviceName)
        )
      })
    ]
  });
} 