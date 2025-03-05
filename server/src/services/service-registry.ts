/**
 * ServiceRegistry
 * 
 * A centralized registry for all application services to ensure
 * they are only initialized once. This implements a dependency injection
 * container pattern to manage service lifecycle and dependencies.
 */

import { createLogger } from '../utils/logger';
import { QdrantService } from './qdrant.service';
import { ConfigService } from './config.service';
import { ChunkingService } from './chunking.service';
import { DocumentProcessorFactory } from './document-processors/document-processor-factory';
import { OpenAIService } from './openai.service';
import { shouldLogServiceRegistration } from '../utils/logger-config';

// Import other services as needed
// import { ConfigService } from './config.service';
// import { ChunkingService } from './chunking.service';
// etc.

const logger = createLogger('ServiceRegistry');

/**
 * ServiceRegistry - Manages all service instances in the application
 * to prevent redundant initialization
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry | null = null;
  private services: Map<string, any> = new Map();
  private initializationCount: Map<string, number> = new Map();
  private verboseLogging: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    logger.info('Initializing ServiceRegistry');
    
    // Register initialization counts
    this.initializationCount.set('QdrantService', 0);
    this.initializationCount.set('ConfigService', 0);
    this.initializationCount.set('OpenAIService', 0);
    this.initializationCount.set('ChunkingService', 0);
    this.initializationCount.set('DocumentProcessorFactory', 0);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Set verbose logging mode
   */
  public setVerboseLogging(verbose: boolean): void {
    this.verboseLogging = verbose;
  }

  /**
   * Register a service in the registry
   */
  private registerService<T>(serviceName: string, serviceInstance: T): T {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, serviceInstance);
      this.incrementInitCount(serviceName);
      
      if (shouldLogServiceRegistration() || this.verboseLogging) {
        logger.info(`Registered service: ${serviceName}`);
      }
    }
    
    return this.services.get(serviceName) as T;
  }

  /**
   * Track service initialization count for debugging
   */
  private incrementInitCount(serviceName: string): void {
    const currentCount = this.initializationCount.get(serviceName) || 0;
    this.initializationCount.set(serviceName, currentCount + 1);
  }

  /**
   * Get the initialization counts for all services
   */
  public getInitializationCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.initializationCount.forEach((count, service) => {
      counts[service] = count;
    });
    return counts;
  }

  /**
   * Get or create a QdrantService instance
   */
  public getQdrantService(): QdrantService {
    if (!this.services.has('QdrantService')) {
      this.registerService('QdrantService', QdrantService.getInstance());
    }
    return this.services.get('QdrantService') as QdrantService;
  }

  /**
   * Get the ConfigService instance (singleton)
   */
  public getConfigService(): ConfigService {
    if (!this.services.has('ConfigService')) {
      this.registerService('ConfigService', ConfigService.getInstance());
    }
    return this.services.get('ConfigService') as ConfigService;
  }

  /**
   * Get the OpenAIService instance (singleton)
   */
  public getOpenAIService(): OpenAIService {
    if (!this.services.has('OpenAIService')) {
      this.registerService('OpenAIService', OpenAIService.getInstance());
    }
    return this.services.get('OpenAIService') as OpenAIService;
  }

  /**
   * Get the ChunkingService instance (singleton)
   */
  public getChunkingService(): ChunkingService {
    if (!this.services.has('ChunkingService')) {
      this.registerService('ChunkingService', ChunkingService.getInstance());
    }
    return this.services.get('ChunkingService') as ChunkingService;
  }

  /**
   * Get the DocumentProcessorFactory instance (singleton)
   */
  public getDocumentProcessorFactory(): DocumentProcessorFactory {
    if (!this.services.has('DocumentProcessorFactory')) {
      this.registerService('DocumentProcessorFactory', DocumentProcessorFactory.getInstance());
    }
    return this.services.get('DocumentProcessorFactory') as DocumentProcessorFactory;
  }

  /**
   * Log information about registered services
   */
  public logServiceStatus(): void {
    logger.info('===== Service Registry Status =====');
    logger.info(`Total registered services: ${this.services.size}`);
    
    this.services.forEach((service, name) => {
      const count = this.initializationCount.get(name) || 0;
      logger.info(`- ${name}: Initialized ${count} time(s)`);
    });
    
    logger.info('===================================');
  }
}

// Export a convenient function to access the registry
export const getServiceRegistry = () => ServiceRegistry.getInstance(); 