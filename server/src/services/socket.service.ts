import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const logger = createLogger('SocketService');

export class SocketService {
  private static instance: SocketService;
  private io: Server | null = null;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of SocketService
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize Socket.IO with the HTTP server
   */
  public initialize(httpServer: HttpServer): void {
    if (this.io) {
      logger.warn('Socket.IO server already initialized');
      return;
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // Allow all origins
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupEventHandlers();
    logger.info('Socket.IO server initialized');
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) {
      logger.error('Cannot setup event handlers: Socket.IO not initialized');
      return;
    }

    this.io.on('connection', (socket: Socket) => {
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

    this.io.on('error', (error) => {
      logger.error('Socket.IO server error', { error });
    });
  }

  /**
   * Emit an event to all clients subscribed to a document
   */
  public emitDocumentUpdate(documentId: string, event: string, data: any): void {
    if (!this.io) {
      logger.error('Cannot emit update: Socket.IO not initialized');
      return;
    }

    this.io.to(`document:${documentId}`).emit(event, data);
    logger.debug('Emitted document update', { documentId, event });
  }

  /**
   * Close the Socket.IO server
   */
  public close(): void {
    if (!this.io) {
      logger.warn('Cannot close: Socket.IO not initialized');
      return;
    }

    this.io.close();
    this.io = null;
    logger.info('Socket.IO server closed');
  }
} 