import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../config/database';

interface User {
  id: number;
  email: string;
  role: string;
  organizationId: string;
}

export class SocketService {
  private io: Server;
  private static instance: SocketService | null = null;

  private constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.use(this.authMiddleware.bind(this));
    this.setupEventHandlers();
  }

  public static getInstance(server: HttpServer): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService(server);
    }
    return SocketService.instance;
  }

  private async authMiddleware(socket: Socket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
      const user = await db('users')
        .where({ id: decoded.id })
        .select('id', 'email', 'role', 'organization_id')
        .first();

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id
      };

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });

      // Add your socket event handlers here
    });
  }

  public getIO(): Server {
    return this.io;
  }
} 