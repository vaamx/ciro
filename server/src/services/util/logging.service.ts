import { Injectable } from '@nestjs/common';
import winston from 'winston';
import { ConfigService } from '@nestjs/config';

/**
 * Logging levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

/**
 * Service for centralized logging
 */
@Injectable()
export class LoggingService {
  private logger: winston.Logger;
  
  private logLevel: LogLevel;

  private constructor(
    private readonly configService: ConfigService,
    ) {
    this.logLevel = (this.configService.get('LOG_LEVEL') as LogLevel) || LogLevel.INFO;
    
    this.logger = winston.createLogger({
      level: this.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'api' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(info => 
              `${info.timestamp} ${info.level}: ${info.message}${info.context ? ` [${info.context}]` : ''}`
            )
          )
        }),
        // Can add file transport or other transports here
      ]
    });
    
    this.log(LogLevel.INFO, 'LoggingService initialized', 'LoggingService');
  }

  /**
   * Get the singleton instance of the service
   */
  

  /**
   * Log a message
   * @param level Log level
   * @param message Message to log
   * @param context Optional context for the log
   * @param meta Optional metadata to include
   */
  log(
    level: LogLevel,
    message: string,
    context?: string,
    meta?: Record<string, any>
  ): void {
    this.logger.log({
      level,
      message,
      context,
      ...meta
    });
  }

  /**
   * Log an error
   * @param message Error message
   * @param context Optional context for the log
   * @param error Optional error object
   * @param meta Optional metadata to include
   */
  error(
    message: string,
    context?: string,
    error?: Error,
    meta?: Record<string, any>
  ): void {
    this.log(
      LogLevel.ERROR,
      message,
      context,
      {
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined,
        ...meta
      }
    );
  }

  /**
   * Log a warning
   * @param message Warning message
   * @param context Optional context for the log
   * @param meta Optional metadata to include
   */
  warn(
    message: string,
    context?: string,
    meta?: Record<string, any>
  ): void {
    this.log(LogLevel.WARN, message, context, meta);
  }

  /**
   * Log an info message
   * @param message Info message
   * @param context Optional context for the log
   * @param meta Optional metadata to include
   */
  info(
    message: string,
    context?: string,
    meta?: Record<string, any>
  ): void {
    this.log(LogLevel.INFO, message, context, meta);
  }

  /**
   * Log a debug message
   * @param message Debug message
   * @param context Optional context for the log
   * @param meta Optional metadata to include
   */
  debug(
    message: string,
    context?: string,
    meta?: Record<string, any>
  ): void {
    this.log(LogLevel.DEBUG, message, context, meta);
  }

  /**
   * Log an HTTP request
   * @param method HTTP method
   * @param url Request URL
   * @param status Status code
   * @param duration Request duration in ms
   * @param meta Optional metadata to include
   */
  httpRequest(
    method: string,
    url: string,
    status: number,
    duration: number,
    meta?: Record<string, any>
  ): void {
    this.log(
      LogLevel.HTTP,
      `${method} ${url} ${status} ${duration}ms`,
      'HTTP',
      meta
    );
  }
} 