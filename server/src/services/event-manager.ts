import { EventEmitter } from 'events';
import { createServiceLogger } from '../utils/logger-factory';

/**
 * Event Manager service for application-wide events
 * This allows different components to communicate asynchronously
 */
export class EventManager {
  private static instance: EventManager | null = null;
  private emitter: EventEmitter;
  private logger = createServiceLogger('EventManager');

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners limit to avoid warnings
    this.emitter.setMaxListeners(20);
    this.logger.info('EventManager initialized');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  public emit(event: string, data: any): void {
    this.logger.debug(`Emitting event: ${event}`);
    this.emitter.emit(event, data);
  }

  /**
   * Register an event listener
   * @param event Event name
   * @param callback Event handler
   */
  public on(event: string, callback: (data: any) => void): void {
    this.logger.debug(`Registering listener for event: ${event}`);
    this.emitter.on(event, callback);
  }

  /**
   * Register a one-time event listener
   * @param event Event name
   * @param callback Event handler
   */
  public once(event: string, callback: (data: any) => void): void {
    this.logger.debug(`Registering one-time listener for event: ${event}`);
    this.emitter.once(event, callback);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param callback Event handler
   */
  public off(event: string, callback: (data: any) => void): void {
    this.logger.debug(`Removing listener for event: ${event}`);
    this.emitter.off(event, callback);
  }

  /**
   * Remove all listeners for an event
   * @param event Event name
   */
  public removeAllListeners(event?: string): void {
    this.logger.debug(`Removing all listeners${event ? ` for event: ${event}` : ''}`);
    this.emitter.removeAllListeners(event);
  }
} 