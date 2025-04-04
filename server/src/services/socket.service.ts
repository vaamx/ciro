import { Server, Socket } from 'socket.io';
import * as winston from 'winston';
import { Server as HttpServer } from 'http';
// Optional import - will use dynamic import in connectToEventManager to avoid circular dependencies
// import { EventManager } from './event-manager';

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
  private _initialized: boolean = false;
  private logger: winston.Logger;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
    this.logger = logger;
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
    return this._initialized;
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
    try {
      if (this.isInitialized()) {
        this.logger.info('Socket.IO service already initialized');
        return;
      }

      this._io = new Server(httpServer, {
        cors: {
          origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
          methods: ['GET', 'POST', 'OPTIONS'],
          credentials: true,
          allowedHeaders: ['Content-Type', 'Authorization']
        },
        transports: ['polling', 'websocket'],
        path: '/socket.io/',
        allowEIO3: true,
        connectTimeout: 45000,
        pingTimeout: 30000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e8,
        serveClient: false
      });

      this.setupEventHandlers();
      
      this.logger.info('Socket.IO service initialized with full configuration');
      this._initialized = true;
    } catch (error) {
      this.logger.error('Error initializing Socket.IO service:', error);
    }
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this._io) {
      this.logger.error('Cannot setup event handlers: Socket.IO not initialized');
      return;
    }

    this._io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.logger.info('Client connected', { clientId });

      socket.on('disconnect', () => {
        this.logger.info('Client disconnected', { clientId });
      });

      // Document processing status updates
      socket.on('subscribe:document', (documentId: string) => {
        socket.join(`document:${documentId}`);
        this.logger.debug('Client subscribed to document updates', { clientId, documentId });
      });

      socket.on('unsubscribe:document', (documentId: string) => {
        socket.leave(`document:${documentId}`);
        this.logger.debug('Client unsubscribed from document updates', { clientId, documentId });
      });

      // Error handling for socket events
      socket.on('error', (error) => {
        this.logger.error('Socket error', { clientId, error });
      });
    });

    this._io.on('error', (error) => {
      this.logger.error('Socket.IO server error', { error });
    });
    
    // Connect to the EventManager if available
    this.connectToEventManager();
  }
  
  /**
   * Connect to the EventManager to listen for data source updates
   */
  private connectToEventManager(): void {
    try {
      // Dynamically import EventManager to avoid circular dependencies
      const EventManager = require('./event-manager').EventManager;
      if (EventManager && typeof EventManager.getInstance === 'function') {
        const eventManager = EventManager.getInstance();
        
        // Listen for data source updates
        eventManager.on('dataSourceUpdate', (data) => {
          this.logger.info(`Received dataSourceUpdate event from EventManager: ${data.id} - ${data.status}`);
          
          // Broadcast to all clients
          if (this._io) {
            this._io.emit('dataSourceUpdate', data);
            
            // Also broadcast knowledge base update for completed data sources
            if (data.status === 'completed' || data.status === 'ready') {
              this._io.emit('knowledgeBaseUpdated', {
                action: 'update',
                source: {
                  id: data.id,
                  status: data.status,
                  ...data
                },
                timestamp: new Date().toISOString()
              });
            }
          }
        });
        
        this.logger.info('EventManager listeners registered successfully');
      }
    } catch (error) {
      this.logger.warn(`Could not connect to EventManager: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Emit an event to all clients subscribed to a document
   */
  public emitDocumentUpdate(documentId: string, event: string, data: any): void {
    if (!this._io) {
      this.logger.error('Cannot emit update: Socket.IO not initialized');
      return;
    }

    this._io.to(`document:${documentId}`).emit(event, data);
    this.logger.debug('Emitted document update', { documentId, event });
  }

  /**
   * Emit an event to all connected clients
   */
  public emit(event: string, data: any): void {
    if (!this._io) {
      this.logger.error('Cannot emit event: Socket.IO not initialized');
      return;
    }

    this._io.emit(event, data);
    this.logger.debug('Emitted event to all clients', { event });
  }
} 