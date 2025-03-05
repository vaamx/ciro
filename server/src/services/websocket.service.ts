import { createLogger } from '../utils/logger';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { injectable } from 'inversify';
import WebSocket from 'ws';
import { SocketService } from './socket.service';

/**
 * Service for managing WebSocket connections
 */
@injectable()
export class WebSocketService {
  private io: SocketIOServer | null = null;
  private readonly logger = createLogger('WebSocketService');
  private wss: WebSocket.Server | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private isInitialized: boolean = false;
  private socketService: SocketService;

  constructor() {
    // Try to get the singleton SocketService
    try {
      this.socketService = SocketService.getInstance();
      this.logger.debug('Successfully connected to SocketService singleton');
    } catch (error) {
      this.logger.warn('Could not initialize SocketService connection', error);
    }
  }

  /**
   * Initialize the WebSocket server
   * @param server - HTTP server instance
   */
  public initialize(server: http.Server): void {
    try {
      // Avoid re-initializing if already done
      if (this.isInitialized) {
        this.logger.debug('WebSocketService already initialized');
        return;
      }

      this.io = new SocketIOServer(server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });

      this.io.on('connection', (socket) => {
        this.logger.info('New socket connection', { socketId: socket.id });

        socket.on('disconnect', () => {
          this.logger.info('Socket disconnected', { socketId: socket.id });
        });
      });

      this.wss = new WebSocket.Server({ server });
      this.logger.info('WebSocket server initialized');

      this.wss.on('connection', (ws: WebSocket) => {
        const clientId = this.generateClientId();
        this.connections.set(clientId, ws);
        this.logger.info(`New WebSocket connection established: ${clientId}`);

        ws.on('message', (message: string) => {
          this.logger.debug(`Received message from ${clientId}: ${message}`);
          // Handle incoming messages if needed
        });

        ws.on('close', () => {
          this.logger.info(`WebSocket connection closed: ${clientId}`);
          this.connections.delete(clientId);
        });

        ws.on('error', (error: Error) => {
          this.logger.error(`WebSocket error for ${clientId}: ${error.message}`);
        });
      });
      
      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error initializing WebSocket server: ${errorMessage}`, error);
    }
  }

  /**
   * Emit an event to all connected clients
   * @param event - Event name
   * @param data - Event data
   */
  public emit(event: string, data: any): void {
    if (!this.io) {
      this.logger.warn('Socket.IO server not initialized');
      return;
    }

    this.io.emit(event, data);
  }

  /**
   * Broadcast a message to all connected clients
   * @param event Event name
   * @param data Event data
   */
  broadcast(event: string, data: any): void {
    try {
      if (!this.wss) {
        this.logger.warn('Cannot broadcast, WebSocket server not initialized');
        return;
      }

      const message = JSON.stringify({ event, data });
      let count = 0;

      this.connections.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          count++;
        }
      });

      this.logger.debug(`Broadcasted ${event} to ${count} clients`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error broadcasting message: ${errorMessage}`, error);
    }
  }

  /**
   * Broadcast a data source update to all connected clients
   * @param dataSourceId - Data source ID
   * @param status - New status
   * @param metadata - Additional metadata
   */
  broadcastDataSourceUpdate(dataSourceId: number, status: string, metadata: any = {}): void {
    try {
      this.logger.info(`Broadcasting data source update: ${dataSourceId} - ${status}`);
      
      // Try to use direct Socket.IO if possible
      if (this.io) {
        try {
          const data = {
            id: dataSourceId,
            status: status,
            ...metadata,
            timestamp: new Date().toISOString()
          };
          
          // Emit directly using our Socket.IO instance
          this.io.emit('dataSourceUpdate', data);
          this.io.emit('knowledgeBaseUpdated', {
            action: 'update',
            source: {
              id: dataSourceId,
              status,
              ...metadata
            },
            timestamp: new Date().toISOString()
          });
          
          this.logger.debug(`Update sent via Socket.IO: ${dataSourceId} - ${status}`);
          return;
        } catch (socketError) {
          this.logger.warn(`Socket.IO emission failed, falling back to WebSocket: ${socketError}`);
        }
      }
      
      // Fall back to WebSocket if Socket.IO failed or isn't available
      if (!this.isInitialized) {
        this.logger.warn(`Cannot broadcast, WebSocket server not initialized - Update for dataSource ${dataSourceId} will not be sent`);
        return;
      }
      
      // Use WebSocket broadcast if available
      if (this.wss) {
        this.broadcast('dataSourceUpdate', {
          id: dataSourceId,
          status,
          metadata,
          timestamp: new Date().toISOString()
        });
        
        // Additionally broadcast a knowledge base update
        this.broadcast('knowledgeBaseUpdated', {
          action: 'update',
          source: {
            id: dataSourceId,
            status,
            metadata
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error broadcasting data source update: ${errorMessage}`, error);
    }
  }

  /**
   * Send a message to a specific client
   * @param clientId Client ID
   * @param event Event name
   * @param data Event data
   * @returns Whether the message was sent
   */
  sendToClient(clientId: string, event: string, data: any): boolean {
    try {
      const client = this.connections.get(clientId);
      if (!client || client.readyState !== WebSocket.OPEN) {
        this.logger.warn(`Cannot send to client ${clientId}, not connected`);
        return false;
      }

      const message = JSON.stringify({ event, data });
      client.send(message);
      
      this.logger.debug(`Sent ${event} to client ${clientId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending message to client ${clientId}: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * Generate a unique client ID
   * @returns Client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
} 