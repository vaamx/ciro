/**
 * SocketAdapter Service
 * 
 * This adapter provides compatibility between WebSocketService
 * and the older SocketService interface expected by document processors.
 */

import { WebSocketService } from './websocket.service';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { Injectable } from '@nestjs/common';

/**
 * Adapter to provide SocketService compatibility with WebSocketService
 */
@Injectable()
export class SocketAdapter {
  private readonly logger = createServiceLogger('SocketAdapter');
  
  
  private constructor(
    private webSocketService: WebSocketService
  ) {
    this.logger.info('SocketAdapter initialized');
  }
  
  /**
   * Get singleton instance
   */
  
  
  /**
   * Get a SocketService compatible interface
   */
  public getSocketServiceAdapter(): any {
    // Create a proxy object that implements the SocketService interface
    // but delegates to WebSocketService where possible
    return {
      // Delegate existing methods to the WebSocketService
      emit: (event: string, data: any) => 
        this.webSocketService.emit(event, data),
      
      // Map to broadcast method
      broadcastMessage: (event: string, data: any) => 
        this.webSocketService.broadcast(event, data),
      
      // Implement missing methods
      authMiddleware: (socket: any, next: Function) => {
        this.logger.warn('authMiddleware called but not fully implemented in adapter');
        // Just call next to continue
        next();
      },
      
      setupEventHandlers: () => {
        this.logger.warn('setupEventHandlers called but not implemented in adapter');
        // No-op implementation
      },
      
      getIO: () => {
        this.logger.warn('getIO called but not fully implemented in adapter');
        // Return an empty object that won't break callers
        return {};
      },
      
      // Add methods that might be used by document processors
      joinRoom: (socketId: string, room: string) => {
        this.logger.warn('joinRoom called but not implemented in adapter');
        // No-op implementation
      },
      
      leaveRoom: (socketId: string, room: string) => {
        this.logger.warn('leaveRoom called but not implemented in adapter');
        // No-op implementation
      }
    };
  }
} 