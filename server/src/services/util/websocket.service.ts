import * as winston from 'winston';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { injectable } from 'inversify';
import WebSocket from 'ws';
import { SocketService } from './socket.service';
import { EventManager } from './event-manager';

/**
 * Service for managing WebSocket connections
 * Provides SocketService-compatible interface
 */
@injectable()
export class WebSocketService {
  private io: SocketIOServer | null = null;
  private readonly logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info: winston.Logform.TransformableInfo) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level?.toUpperCase() || 'INFO'}] [WebSocketService]: ${message}`;
        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf((info: winston.Logform.TransformableInfo) => {
            const { timestamp, level, message, ...rest } = info;
            const formattedMessage = `${timestamp} [${level?.toUpperCase() || 'INFO'}] [WebSocketService]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
  private wss: WebSocket.Server | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private isInitialized: boolean = false;
  private socketService: SocketService | null = null;

  constructor(private readonly eventManager: EventManager) {
    // SocketService will be initialized later when we have the HTTP server
    this.logger.info('WebSocketService constructor called');
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

      // Initialize SocketService with the server
      try {
        this.socketService = SocketService.getInstance(server);
        this.logger.info('Successfully connected to SocketService singleton');
      } catch (error) {
        this.logger.warn('Could not initialize SocketService connection', error);
        this.socketService = null;
      }

      // Check if Socket.IO is already initialized by SocketService
      if (this.socketService) {
        this.logger.info('Using existing Socket.IO instance from SocketService');
        this.io = this.socketService.getIO();
      } else {
        // Create new Socket.IO instance only if not already created by SocketService
        this.logger.info('Creating new Socket.IO instance');
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
          transports: ['polling', 'websocket'], // Prioritize polling
          path: '/socket.io/',
          allowEIO3: true,
          serveClient: false
        });
      }

      // Add connection handlers if we have an IO instance
      if (this.io) {
        this.setupEventHandlers();
      }

      // Initialize standard WebSocket server (separate from Socket.IO)
      this.wss = new WebSocket.Server({ 
        server,
        // Add proper WebSocket server options
        perMessageDeflate: false,
        // Important: use a different path to avoid conflicts with Socket.IO
        path: '/ws'
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
      
      // Register with EventManager to listen for data source updates
      this.setupEventListeners();
      
      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error initializing WebSocket server: ${errorMessage}`, error);
    }
  }

  /**
   * Authentication middleware for Socket.IO
   * Implementation equivalent to SocketService
   */
  public async authMiddleware(socket: any, next: (err?: Error) => void) {
    // Simple pass-through implementation
    // Since we're using this as an adapter, we'll just pass authentication
    this.logger.debug(`Auth middleware called for socket ${socket.id}`);
    next();
  }

  /**
   * Set up event handlers for Socket.IO
   * Implementation equivalent to SocketService
   */
  public setupEventHandlers() {
    if (!this.io) {
      this.logger.warn('Cannot setup event handlers: Socket.IO server not initialized');
      return;
    }

    this.io.on('connection', (socket) => {
      this.logger.info('Client connected:', socket.id);

      socket.on('disconnect', () => {
        this.logger.info('Client disconnected:', socket.id);
      });

      // Add Socket.IO event handlers
    });
    
    this.logger.info('Socket.IO event handlers registered');
  }

  /**
   * Get the Socket.IO server instance
   * Implementation equivalent to SocketService
   */
  public getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO server not initialized');
    }
    return this.io;
  }

  /**
   * Set up event listeners with EventManager
   */
  private setupEventListeners(): void {
    try {
      const eventManager = this.eventManager;
      
      // Listen for data source updates
      eventManager.on('dataSourceUpdate', (data) => {
        this.logger.info(`Received dataSourceUpdate event from EventManager: ${data.id} - ${data.status}`);
        this.broadcastDataSourceUpdate(data.id, data.status, data);
      });
      
      this.logger.info('EventManager listeners registered successfully');
    } catch (error) {
      this.logger.error(`Error setting up EventManager listeners: ${error instanceof Error ? error.message : String(error)}`);
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
      
      // Fallback to WebSocket broadcast if Socket.IO is not available
      this.broadcast('dataSourceUpdate', data);
      this.broadcast('knowledgeBaseUpdated', knowledgeBaseData);
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
   * @returns true if message was sent successfully, false otherwise
   */
  sendToClient(clientId: string, event: string, data: any): boolean {
    try {
      const client = this.connections.get(clientId);
      if (!client || client.readyState !== WebSocket.OPEN) {
        this.logger.warn(`Cannot send to client ${clientId}, not connected or not ready`);
        return false;
      }

      const message = JSON.stringify({ event, data });
      client.send(message);
      this.logger.debug(`Sent event ${event} to client ${clientId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending message to client ${clientId}: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * Generate a unique client ID
   * @returns Unique client ID
   */
  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
} 