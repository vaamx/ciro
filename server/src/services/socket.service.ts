import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import * as winston from 'winston';

// Create a logger for this service
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [SocketService]: ${message}`;
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
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [SocketService]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

/**
 * Socket.IO service for real-time communication
 */
export class SocketService {
  private static instance: SocketService;
  private _io: Server | null = null;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Check if Socket.IO is initialized
   */
  public isInitialized(): boolean {
    return this._io !== null;
  }

  /**
   * Get the Socket.IO server instance
   * This allows other services to use the same Socket.IO instance
   */
  public get io(): Server | null {
    return this._io;
  }

  /**
   * Initialize Socket.IO with the HTTP server
   */
  public initialize(httpServer: HttpServer): void {
    if (this._io) {
      logger.warn('Socket.IO server already initialized');
      return;
    }

    // Enhanced Socket.IO configuration for better compatibility
    this._io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.CORS_ORIGIN || '*' 
          : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', '*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      // Support both WebSocket and long-polling for maximum compatibility
      transports: ['websocket', 'polling'],
      // Allow older clients to connect
      allowEIO3: true,
      // Increase ping timeout for more stable connections
      pingTimeout: 60000
    });

    this.setupEventHandlers();
    logger.info('Socket.IO server initialized');
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this._io) {
      logger.error('Cannot setup event handlers: Socket.IO not initialized');
      return;
    }

    this._io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      logger.info('Client connected', { clientId });

      socket.on('disconnect', () => {
        logger.info('Client disconnected', { clientId });
      });

      // Document processing status updates
      socket.on('subscribe:document', (documentId: string) => {
        socket.join(`document:${documentId}`);
        logger.debug('Client subscribed to document updates', { clientId, documentId });
      });

      socket.on('unsubscribe:document', (documentId: string) => {
        socket.leave(`document:${documentId}`);
        logger.debug('Client unsubscribed from document updates', { clientId, documentId });
      });

      // Error handling for socket events
      socket.on('error', (error) => {
        logger.error('Socket error', { clientId, error });
      });
    });

    this._io.on('error', (error) => {
      logger.error('Socket.IO server error', { error });
    });
  }

  /**
   * Emit an event to all clients subscribed to a document
   */
  public emitDocumentUpdate(documentId: string, event: string, data: any): void {
    if (!this._io) {
      logger.error('Cannot emit update: Socket.IO not initialized');
      return;
    }

    this._io.to(`document:${documentId}`).emit(event, data);
    logger.debug('Emitted document update', { documentId, event });
  }

  /**
   * Emit an event to all connected clients
   */
  public emit(event: string, data: any): void {
    if (!this._io) {
      logger.error('Cannot emit event: Socket.IO not initialized');
      return;
    }

    this._io.emit(event, data);
    logger.debug('Emitted event to all clients', { event });
  }
} 