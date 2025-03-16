import dotenv from 'dotenv';
// Load environment variables before any other imports
dotenv.config();

import express from './types/express-types';
import { oauthRouter } from './routes/oauth';
import { proxyRouter } from './routes/proxy';
import { refreshSession } from './middleware/auth';
import { Server as HttpServer, createServer } from 'http';
import { config } from './config';
import appExpress from './app';
import { SocketService } from './services/socket.service';
import http from 'http';
import * as winston from 'winston';
import { startScheduledTasks, stopScheduledTasks } from './scheduled-tasks';
import { db } from './infrastructure/database';
import { RagService } from './services/rag.service';

// Add oauth and proxy routes to the main appExpress
appExpress.use('/api/oauth', oauthRouter);
appExpress.use('/api/proxy', proxyRouter);
appExpress.use(refreshSession);

// Add a direct test route to the appExpress
appExpress.get('/direct-test', (req, res) => {
  console.log('Direct test endpoint accessed!');
  res.status(200).send('Direct test endpoint working!');
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [Server]: ${message}`;
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
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [Server]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});
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
  async start(): Promise<void> {
    this.httpServer.listen(port, async () => {
      logger.info(`Server listening on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start scheduled tasks after server is running
      startScheduledTasks();
      
      // Run the collection reference fix after starting
      await this.updateCollectionReferences();
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

  /**
   * Add collection_name column to data_sources table if it doesn't exist
   * and update the collection references
   */
  private async updateCollectionReferences() {
    try {
      // Check if collection_name column exists
      const hasCollectionNameColumn = await this.checkIfColumnExists('data_sources', 'collection_name');
      
      if (!hasCollectionNameColumn) {
        logger.info('collection_name column does not exist, adding it to data_sources table');
        
        // Add the column
        await db.schema.table('data_sources', table => {
          table.string('collection_name').nullable();
        });
        
        logger.info('Added collection_name column to data_sources table');
      }
      
      // Run the collection references fix
      logger.info('Running collection references fix...');
      const ragService = new RagService();
      const result = await ragService.updateDataSourceCollectionReferences();
      logger.info(`Collection references fix completed: Updated ${result.updated} data sources, ${result.errors} errors`);
    } catch (error) {
      logger.error('Error updating collection references:', error);
    }
  }
  
  /**
   * Check if a column exists in a table
   */
  private async checkIfColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      // Use PostgreSQL information_schema to check if column exists
      const result = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ? AND column_name = ?
      `, [tableName, columnName]);
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
      return false;
    }
  }
} 