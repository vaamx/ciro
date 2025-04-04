import * as winston from 'winston';

// Use Winston's native types
const loggerFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const formattedMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
  })
);

// Create the logger with Winston 3.x configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: loggerFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        loggerFormat
      )
    })
  ]
});

// Extend the Winston Logger interface to include our custom method
interface LoggerWithCustomMethods extends winston.Logger {
  logObject(label: string, obj: any): void;
}

// Type assertion to use our extended interface
const extendedLogger = logger as LoggerWithCustomMethods;

// Add a simple method to log objects for debugging
extendedLogger.logObject = (label: string, obj: any): void => {
  logger.debug(`${label}: ${JSON.stringify(obj, null, 2)}`);
};

// Configure log level based on environment
if (process.env.NODE_ENV === 'development') {
  logger.level = 'debug';
}

// Add method to turn on debug mode programmatically
export const setDebugMode = (enabled: boolean): void => {
  logger.level = enabled ? 'debug' : 'info';
  logger.info(`Log level set to: ${logger.level}`);
};

/**
 * Create a named logger instance
 * @param name The name of the logger
 * @returns A Winston logger instance
 */
export function createLogger(name: string): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${name}]: ${message}`;
        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf((info) => {
              const { timestamp, level, message, ...rest } = info;
              const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${name}]: ${message}`;
              return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
            })
          )
        )
      })
    ]
  });
}

// Export the extended logger
export { extendedLogger }; 