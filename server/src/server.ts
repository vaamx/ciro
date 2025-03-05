import dotenv from 'dotenv';
// Load environment variables before any other imports
dotenv.config();

import express from 'express';
import { oauthRouter } from './routes/oauth';
import { proxyRouter } from './routes/proxy';
import { refreshSession } from './middleware/auth';
import { Server as HttpServer, createServer } from 'http';
import { config } from './config';
import appExpress from './app';
import { SocketService } from './services/socket.service';
import http from 'http';
import { createLogger } from './utils/logger';
import { startScheduledTasks, stopScheduledTasks } from './scheduled-tasks';

// Add oauth and proxy routes to the main appExpress
appExpress.use('/api/oauth', oauthRouter);
appExpress.use('/api/proxy', proxyRouter);
appExpress.use(refreshSession);

// Add a direct test route to the appExpress
appExpress.get('/direct-test', (req, res) => {
  console.log('Direct test endpoint accessed!');
  res.status(200).send('Direct test endpoint working!');
});

const logger = createLogger('Server');
const port = config.port;

export default class Server {
  private httpServer: http.Server;
  private socketService: SocketService;

  constructor() {
    this.httpServer = http.createServer(appExpress);
    this.socketService = SocketService.getInstance();
    
    // Initialize Socket.IO with the HTTP server
    this.socketService.initialize(this.httpServer);
    
    // Handle server errors
    this.httpServer.on('error', (error) => {
      logger.error('HTTP server error:', { error });
    });
  }

  /**
   * Start the HTTP server
   */
  start(): void {
    this.httpServer.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start scheduled tasks after server is running
      startScheduledTasks();
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    // Stop scheduled tasks before shutting down the server
    stopScheduledTasks();
    
    return new Promise((resolve, reject) => {
      logger.info('Stopping HTTP server...');
      
      this.httpServer.close((err) => {
        if (err) {
          logger.error('Error stopping HTTP server:', { error: err });
          reject(err);
        } else {
          logger.info('HTTP server stopped successfully');
          resolve();
        }
      });
    });
  }
} 