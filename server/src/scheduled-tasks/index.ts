import { createLogger } from '../utils/logger';
import { conversationSummaryService } from '../services/conversation-summary.service';
import { config } from '../config';
import { Config, TasksConfig } from '../types/config';
import { db } from '../infrastructure/database';
import { QdrantService } from '../services/qdrant.service';
import { getServiceRegistry } from '../services/service-registry';

const logger = createLogger('ScheduledTasks');
const qdrantService = QdrantService.getInstance();

// Track all interval IDs so we can clear them if needed
const intervalIds: NodeJS.Timeout[] = [];

/**
 * Start all scheduled tasks
 */
export function startScheduledTasks(): void {
  logger.info('Starting scheduled tasks');
  
  // Start conversation summarization task
  startConversationSummarization();
  
  // Start data cleanup task
  startDataCleanup();
  
  // Start vector database reindexing task
  startVectorIndexing();
  
  logger.info('All scheduled tasks started');
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduledTasks(): void {
  logger.info('Stopping all scheduled tasks');
  
  // Clear all intervals
  intervalIds.forEach(id => clearInterval(id));
  intervalIds.length = 0;
  
  logger.info('All scheduled tasks stopped');
}

/**
 * Start the conversation summarization task
 */
function startConversationSummarization(): void {
  // Get configuration from config file
  const tasks = (config as Config).tasks || {} as TasksConfig;
  const summarizationInterval = tasks.summarizationInterval || 60 * 60 * 1000; // Default to 1 hour
  
  logger.info(`Starting conversation summarization task with interval: ${summarizationInterval / 60000} minutes`);
  
  // Run immediately on startup
  runConversationSummarization().catch(error => {
    logger.error('Error running initial conversation summarization', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  
  // Schedule for regular execution
  const intervalId = setInterval(async () => {
    try {
      await runConversationSummarization();
    } catch (error) {
      logger.error('Error running scheduled conversation summarization', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, summarizationInterval);
  
  // Add to tracked intervals
  intervalIds.push(intervalId);
}

/**
 * Execute the conversation summarization task
 */
async function runConversationSummarization(): Promise<void> {
  logger.info('Running conversation summarization task');
  
  try {
    const result = await conversationSummaryService.summarizeActiveConversations();
    
    logger.info('Conversation summarization completed', {
      processed: result.processed,
      summarized: result.summarized,
      errors: result.errors
    });
  } catch (error) {
    logger.error('Failed to run conversation summarization', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Rethrow to be handled by the caller
    throw error;
  }
}

/**
 * Start the data cleanup task
 */
function startDataCleanup(): void {
  // Get configuration from config file
  const tasks = (config as Config).tasks || {} as TasksConfig;
  const cleanupInterval = tasks.cleanupInterval || 24 * 60 * 60 * 1000; // Default to 24 hours
  
  logger.info(`Starting data cleanup task with interval: ${cleanupInterval / 3600000} hours`);
  
  // Run immediately on startup
  runDataCleanup().catch(error => {
    logger.error('Error running initial data cleanup', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  
  // Schedule for regular execution
  const intervalId = setInterval(async () => {
    try {
      await runDataCleanup();
    } catch (error) {
      logger.error('Error running scheduled data cleanup', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, cleanupInterval);
  
  // Add to tracked intervals
  intervalIds.push(intervalId);
}

/**
 * Execute the data cleanup task
 */
async function runDataCleanup(): Promise<void> {
  logger.info('Running data cleanup task');
  
  try {
    // Get date threshold (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let messagesResult = 0;
    
    // Check if chat_messages table exists
    const hasChatMessagesTable = await tableExists('chat_messages');
    if (hasChatMessagesTable) {
      // Cleanup old chat messages that have been archived or summarized
      messagesResult = await db('chat_messages')
        .whereRaw("(metadata->>'archived')::boolean = true")
        .andWhere('created_at', '<', thirtyDaysAgo)
        .delete();
      
      logger.info(`Cleaned up ${messagesResult} archived chat messages`);
    } else {
      logger.info('Skipping chat messages cleanup - table does not exist');
    }
    
    let tempFilesResult = 0;
    
    // Check if uploaded_files table exists
    const hasUploadedFilesTable = await tableExists('uploaded_files');
    if (hasUploadedFilesTable) {
      // Cleanup temporary files older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      tempFilesResult = await db('uploaded_files')
        .where('is_temporary', true)
        .andWhere('created_at', '<', sevenDaysAgo)
        .delete();
      
      logger.info(`Cleaned up ${tempFilesResult} temporary files`);
    } else {
      logger.info('Skipping uploaded files cleanup - table does not exist');
    }
    
    logger.info('Data cleanup completed', {
      archivedMessagesRemoved: messagesResult,
      temporaryFilesRemoved: tempFilesResult
    });
  } catch (error) {
    logger.error('Failed to run data cleanup', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Rethrow to be handled by the caller
    throw error;
  }
}

/**
 * Helper function to check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    // Use a raw query to check if the table exists in the information schema
    const result = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = ?
    `, [tableName]);
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Error checking if table ${tableName} exists`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Start the vector database reindexing task
 */
function startVectorIndexing(): void {
  // Get configuration from config file
  const tasks = (config as Config).tasks || {} as TasksConfig;
  const indexingInterval = tasks.indexingInterval || 7 * 24 * 60 * 60 * 1000; // Default to 7 days
  
  logger.info(`Starting vector database reindexing task with interval: ${indexingInterval / 86400000} days`);
  
  // Run immediately on startup
  runVectorIndexing().catch(error => {
    logger.error('Error running initial vector database reindexing', {
      error: error instanceof Error ? error.message : String(error)
    });
  });
  
  // Schedule for regular execution
  const intervalId = setInterval(async () => {
    try {
      await runVectorIndexing();
    } catch (error) {
      logger.error('Error running scheduled vector database reindexing', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, indexingInterval);
  
  // Add to tracked intervals
  intervalIds.push(intervalId);
}

/**
 * Execute the vector database reindexing task
 */
async function runVectorIndexing(): Promise<void> {
  logger.info('Running vector database reindexing task');
  
  try {
    // Get all collections that need optimization
    const collections = await qdrantService.listCollections();
    let optimizedCount = 0;
    
    // Process each collection
    for (const collectionName of collections) {
      try {
        logger.info(`Optimizing collection: ${collectionName}`);
        
        // Check collection size
        const collectionInfo = await qdrantService.getCollectionInfo(collectionName);
        
        if (collectionInfo && collectionInfo.points_count > 1000) {
          // Collection is large enough to warrant optimization
          await qdrantService.optimizeCollection(collectionName);
          optimizedCount++;
          
          logger.info(`Successfully optimized collection: ${collectionName}`);
        } else {
          logger.info(`Skipping optimization for small collection: ${collectionName}`);
        }
      } catch (error) {
        logger.error(`Error optimizing collection ${collectionName}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other collections
      }
    }
    
    logger.info('Vector database reindexing completed', {
      collectionsProcessed: collections.length,
      collectionsOptimized: optimizedCount
    });
  } catch (error) {
    logger.error('Failed to run vector database reindexing', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Rethrow to be handled by the caller
    throw error;
  }
} 