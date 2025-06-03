import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogContext {
  userId?: number;
  organizationId?: number;
  clientId?: number;
  requestId?: string;
  module?: string;
  action?: string;
  [key: string]: any;
}

@Injectable()
export class EnhancedLoggerService implements NestLoggerService {
  private readonly logLevel: LogLevel;

  constructor() {
    // Get log level from environment or default to INFO
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.logLevel = LogLevel[envLogLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  /**
   * Log an error message
   */
  error(message: string, trace?: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.ERROR) {
      const logEntry = this.formatLog('ERROR', message, context, trace);
      console.error(logEntry);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.WARN) {
      const logEntry = this.formatLog('WARN', message, context);
      console.warn(logEntry);
    }
  }

  /**
   * Log an info message
   */
  log(message: string, context?: LogContext): void {
    this.info(message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.INFO) {
      const logEntry = this.formatLog('INFO', message, context);
      console.log(logEntry);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      const logEntry = this.formatLog('DEBUG', message, context);
      console.debug(logEntry);
    }
  }

  /**
   * Log a verbose message (alias for debug)
   */
  verbose(message: string, context?: LogContext): void {
    this.debug(message, context);
  }

  /**
   * Log user activity for audit purposes
   */
  logUserActivity(action: string, userId: number, context?: LogContext): void {
    this.info(`User Activity: ${action}`, {
      userId,
      activityType: 'USER_ACTION',
      action,
      ...context,
    });
  }

  /**
   * Log system events
   */
  logSystemEvent(event: string, context?: LogContext): void {
    this.info(`System Event: ${event}`, {
      eventType: 'SYSTEM_EVENT',
      event,
      ...context,
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: string, context?: LogContext): void {
    this.warn(`Security Event: ${event}`, {
      eventType: 'SECURITY_EVENT',
      event,
      ...context,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      eventType: 'PERFORMANCE',
      operation,
      duration,
      ...context,
    });
  }

  /**
   * Log API requests
   */
  logApiRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    const message = `${method} ${url} ${statusCode} ${duration}ms`;
    
    const logContext = {
      eventType: 'API_REQUEST',
      method,
      url,
      statusCode,
      duration,
      ...context,
    };

    switch (level) {
      case 'ERROR':
        this.error(message, undefined, logContext);
        break;
      case 'WARN':
        this.warn(message, logContext);
        break;
      default:
        this.info(message, logContext);
    }
  }

  /**
   * Format log message with timestamp and context
   */
  private formatLog(level: string, message: string, context?: LogContext, trace?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const traceStr = trace ? ` | Trace: ${trace}` : '';
    
    return `[${timestamp}] [${level}] ${message}${contextStr}${traceStr}`;
  }

  /**
   * Create a child logger with default context
   */
  child(defaultContext: LogContext): EnhancedLoggerService {
    const childLogger = new EnhancedLoggerService();
    
    // Override methods to include default context
    const originalError = childLogger.error.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalInfo = childLogger.info.bind(childLogger);
    const originalDebug = childLogger.debug.bind(childLogger);

    childLogger.error = (message: string, trace?: string, context?: LogContext) => {
      originalError(message, trace, { ...defaultContext, ...context });
    };

    childLogger.warn = (message: string, context?: LogContext) => {
      originalWarn(message, { ...defaultContext, ...context });
    };

    childLogger.info = (message: string, context?: LogContext) => {
      originalInfo(message, { ...defaultContext, ...context });
    };

    childLogger.debug = (message: string, context?: LogContext) => {
      originalDebug(message, { ...defaultContext, ...context });
    };

    childLogger.log = childLogger.info;
    childLogger.verbose = childLogger.debug;

    return childLogger;
  }
} 