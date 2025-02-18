import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../infrastructure/database';
import { wsRateLimiter } from '../middleware/security';

interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthenticatedSocket extends Socket {
  user?: User;
}

export class SocketService {
  private static instance: SocketService;
  private io: Server;
  private userSockets: Map<number, Set<string>> = new Map();

  private constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  public static getInstance(server?: HttpServer): SocketService {
    if (!SocketService.instance && server) {
      SocketService.instance = new SocketService(server);
    }
    return SocketService.instance;
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('Authentication token missing');
        }

        const decoded = jwt.verify(token, config.jwt.secret) as User;
        socket.user = decoded;

        // Add socket to user's socket set
        const userSockets = this.userSockets.get(decoded.id) || new Set();
        userSockets.add(socket.id);
        this.userSockets.set(decoded.id, userSockets);

        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.user?.email}`);

      // Join user's rooms
      this.joinUserRooms(socket);

      // Handle chat events
      socket.on('message', async (data) => {
        try {
          if (!socket.user) {
            throw new Error('User not authenticated');
          }

          // Check rate limit
          if (!wsRateLimiter.checkLimit(socket.user.id)) {
            socket.emit('error', { 
              message: 'Rate limit exceeded. Please wait before sending more messages.' 
            });
            return;
          }

          const { conversationId, content } = data;
          
          // Validate message content
          if (!content || content.trim().length === 0) {
            socket.emit('error', { message: 'Message content cannot be empty' });
            return;
          }

          if (content.length > 4000) {
            socket.emit('error', { message: 'Message content too long' });
            return;
          }

          // Check if user is participant in conversation
          const participantCheck = await pool.query(
            `SELECT 1 FROM conversation_participants 
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, socket.user.id]
          );

          if (participantCheck.rows.length === 0) {
            socket.emit('error', { message: 'Not authorized to send messages in this conversation' });
            return;
          }

          // Save message to database
          const result = await pool.query(
            `INSERT INTO messages (conversation_id, user_id, role, content)
             VALUES ($1, $2, 'user', $3)
             RETURNING id, created_at`,
            [conversationId, socket.user.id, content]
          );

          const message = {
            id: result.rows[0].id,
            conversationId,
            userId: socket.user.id,
            content,
            role: 'user',
            createdAt: result.rows[0].created_at
          };

          // Update conversation last activity
          await pool.query(
            `UPDATE conversations 
             SET updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [conversationId]
          );

          // Broadcast to conversation room
          this.io.to(`conversation:${conversationId}`).emit('message:new', message);

          // Emit typing stop event
          if (socket.user) {
            socket.to(`conversation:${conversationId}`).emit('typing:stop', {
              userId: socket.user.id,
              conversationId
            });
          }
        } catch (error: unknown) {
          console.error('Error handling message:', error);
          socket.emit('error', { 
            message: 'Failed to send message',
            details: process.env.NODE_ENV === 'development' ? 
              error instanceof Error ? error.message : 'Unknown error' 
              : undefined
          });
        }
      });

      // Typing indicators with rate limiting
      let typingTimeout: NodeJS.Timeout;
      socket.on('typing:start', (data) => {
        if (!socket.user || !wsRateLimiter.checkLimit(socket.user.id)) {
          return;
        }

        const { conversationId } = data;
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          userId: socket.user.id,
          conversationId
        });

        // Automatically stop typing after 5 seconds
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          if (socket.user) {
            socket.to(`conversation:${conversationId}`).emit('typing:stop', {
              userId: socket.user.id,
              conversationId
            });
          }
        }, 5000);
      });

      socket.on('typing:stop', (data) => {
        if (!socket.user) return;

        const { conversationId } = data;
        clearTimeout(typingTimeout);
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          userId: socket.user.id,
          conversationId
        });
      });

      socket.on('disconnect', () => {
        if (socket.user) {
          const userSockets = this.userSockets.get(socket.user.id);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.userSockets.delete(socket.user.id);
            }
          }
        }
        clearTimeout(typingTimeout);
        console.log(`User disconnected: ${socket.user?.email}`);
      });
    });
  }

  private async joinUserRooms(socket: AuthenticatedSocket) {
    try {
      // Get user's conversations
      const result = await pool.query(
        `SELECT conversation_id 
         FROM conversation_participants 
         WHERE user_id = $1`,
        [socket.user?.id]
      );

      // Join conversation rooms
      for (const row of result.rows) {
        socket.join(`conversation:${row.conversation_id}`);
      }
    } catch (error) {
      console.error('Error joining user rooms:', error);
    }
  }

  // Public methods for external use
  public emitToUser(userId: number, event: string, data: any) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  public emitToConversation(conversationId: string, event: string, data: any) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  public getUserOnlineStatus(userId: number): boolean {
    const userSockets = this.userSockets.get(userId);
    return userSockets !== undefined && userSockets.size > 0;
  }
} 