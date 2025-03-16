import * as winston from 'winston';
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
  private readonly logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [WebSocketService]: ${message}`;
        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...rest } = info;
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] [WebSocketService]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
  private wss: WebSocket.Server | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private isInitialized: boolean = false;
  private socketService: SocketService;

  constructor() {
    // Try to get the singleton SocketService
    try {
      this.socketService = SocketService.getInstance();
      this.logger.info('Successfully connected to SocketService singleton');
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
        this.logger.info('WebSocketService already initialized');
        return;
      }

      // Improved CORS configuration for Socket.io
      this.io = new SocketIOServer(server, {
        cors: {
          origin: process.env.NODE_ENV === 'production' 
            ? process.env.CORS_ORIGIN || '*'
            : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', '*'],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          credentials: true,
          allowedHeaders: ['Content-Type', 'Authorization']
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
      });

      this.io.on('connection', (socket) => {
        this.logger.info('New socket connection', { socketId: socket.id });

        socket.on('disconnect', () => {
          this.logger.info('Socket disconnected', { socketId: socket.id });
        });
      });

      this.wss = new WebSocket.Server({ 
        server,
        // Add proper WebSocket server options
        perMessageDeflate: false
      });
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
   * @param dataSourceId - Data source ID (can be UUID or numeric ID)
   * @param status - New status
   * @param metadata - Additional metadata
   */
  broadcastDataSourceUpdate(dataSourceId: number | string, status: string, metadata: any = {}): void {
    try {
      this.logger.info(`Broadcasting data source update: ${dataSourceId} - ${status}`);
      
      // Ensure dataSourceId is treated as a string for consistency
      const dataSourceIdStr = String(dataSourceId);
      
      // Prepare the data to broadcast
      const data = {
        id: dataSourceId,
        status: status,
        ...metadata,
        timestamp: new Date().toISOString()
      };
      
      const knowledgeBaseData = {
        action: 'update',
        source: {
          id: dataSourceId,
          status,
          ...metadata
        },
        timestamp: new Date().toISOString()
      };
      
      // Try to use direct Socket.IO if possible
      if (this.io) {
        try {
          // Emit directly using our Socket.IO instance
          this.io.emit('dataSourceUpdate', data);
          this.io.emit('knowledgeBaseUpdated', knowledgeBaseData);
          
          this.logger.debug(`Update sent via Socket.IO: ${dataSourceId} - ${status}`);
          return;
        } catch (socketError) {
          this.logger.warn(`Socket.IO emission failed, falling back to WebSocket: ${socketError instanceof Error ? socketError.message : String(socketError)}`);
        }
      }
      
      // Fall back to WebSocket if Socket.IO failed or isn't available
      if (!this.isInitialized) {
        // Try to use the SocketService singleton as a fallback
        try {
          if (this.socketService && this.socketService.isInitialized()) {
            // Use the singleton to broadcast the update
            this.socketService.emit('dataSourceUpdate', data);
            this.socketService.emit('knowledgeBaseUpdated', knowledgeBaseData);
            
            this.logger.info(`Broadcast via SocketService singleton: ${dataSourceId} - ${status}`);
            return;
          } else {
            // Try to get the SocketService dynamically
            const SocketService = require('./socket.service').SocketService;
            if (SocketService && typeof SocketService.getInstance === 'function') {
              const socketService = SocketService.getInstance();
              if (socketService && socketService.io) {
                // Use the singleton to broadcast the update
                socketService.io.emit('dataSourceUpdate', data);
                socketService.io.emit('knowledgeBaseUpdated', knowledgeBaseData);
                
                this.logger.info(`Broadcast via SocketService singleton: ${dataSourceId} - ${status}`);
                return;
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to use SocketService singleton: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        this.logger.warn(`Cannot broadcast, WebSocket server not initialized - Update for dataSource ${dataSourceId} will not be sent`);
        return;
      }
      
      // Use WebSocket broadcast if available
      if (this.wss) {
        this.broadcast('dataSourceUpdate', data);
        
        // Additionally broadcast a knowledge base update
        this.broadcast('knowledgeBaseUpdated', knowledgeBaseData);
        
        this.logger.debug(`Broadcasted via WebSocket: ${dataSourceId} - ${status}`);
      } else {
        this.logger.warn(`No WebSocket server available for broadcasting update for dataSource ${dataSourceId}`);
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