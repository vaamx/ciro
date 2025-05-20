import { EventEmitter } from 'events';
import winston from 'winston';
import { injectable } from 'inversify';

/**
 * Service for managing application-wide events
 * This allows for loose coupling and asynchronous communication
 * between different components of the application
 */
@injectable()
export class EventManager {
  private emitter: EventEmitter;
  private static instance: EventManager | null = null;
  private readonly logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        return `${timestamp} [${level.toUpperCase()}] [EventManager]: ${message} ${
          Object.keys(rest).length ? JSON.stringify(rest) : ''
        }`;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });

  /**
   * Get the singleton instance of EventManager
   * @returns EventManager instance
   */
  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  private constructor() {
    this.emitter = new EventEmitter();
    // Increase the maximum number of listeners to avoid memory leak warnings
    this.emitter.setMaxListeners(50);
    this.logger.info('EventManager initialized');
  }

  /**
   * Emit an event with data
   * @param event Event name
   * @param data Event data
   */
  public emit(event: string, data: any): void {
    this.logger.debug(`Emitting event: ${event}`, { data });
    this.emitter.emit(event, data);
  }

  /**
   * Register an event listener
   * @param event Event name
   * @param listener Event handler function
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.logger.debug(`Registering listener for event: ${event}`);
    this.emitter.on(event, listener);
  }

  /**
   * Register a one-time event listener
   * @param event Event name
   * @param listener Event handler function
   */
  public once(event: string, listener: (...args: any[]) => void): void {
    this.logger.debug(`Registering one-time listener for event: ${event}`);
    this.emitter.once(event, listener);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param listener Event handler function
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.logger.debug(`Removing listener for event: ${event}`);
    this.emitter.off(event, listener);
  }

  /**
   * Remove all listeners for an event
   * @param event Event name
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this.logger.debug(`Removing all listeners for event: ${event}`);
    } else {
      this.logger.debug('Removing all listeners for all events');
    }
    this.emitter.removeAllListeners(event);
  }
} 