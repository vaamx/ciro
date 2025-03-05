/**
 * Logger Configuration
 * 
 * This file centralizes logger configuration to control verbosity
 * and formatting of logs throughout the application.
 */

import { createLogger } from './logger';

const logger = createLogger('LoggerConfig');

// Get environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Define the LogLevel type here to avoid dependency on logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Environment-specific defaults
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';
const isProduction = !isDevelopment && !isTest;

// Log level settings by service name (patterns)
const LOG_LEVELS: Record<string, LogLevel> = {
  // Default level for all services not specifically configured
  default: isDevelopment ? 'info' : 'info',
  
  // Service-specific log levels
  QdrantService: isDevelopment ? 'info' : 'warn',
  ConfigService: isDevelopment ? 'info' : 'warn',
  ChunkingService: isDevelopment ? 'info' : 'warn',
  DocumentProcessorFactory: isDevelopment ? 'info' : 'warn',
  
  // Prefix matches (applied to any service starting with these strings)
  'Document': isDevelopment ? 'info' : 'warn', 
  'Processor': isDevelopment ? 'info' : 'warn',
  
  // Special initialization logging
  'ServiceRegistry': 'info', // Always log service registry activity
  
  // Startup services logging
  'Startup': 'info', // Always log startup activity
  
  // Reduce chatty services
  'OpenAI': isDevelopment ? 'info' : 'warn',
};

// Configuration for service initialization logging
const SERVICE_INIT_CONFIG = {
  // Only log initialization in specific environments
  environmentBasedLogging: {
    development: true,
    test: false,
    production: false
  },
  
  // Control which services show initialization logs
  serviceLoggingEnabled: {
    QdrantService: true,
    OpenAIService: NODE_ENV === 'development',
    ConfigService: NODE_ENV === 'development',
    ChunkingService: NODE_ENV === 'development',
    DocumentProcessorFactory: NODE_ENV === 'development',
    ServiceRegistry: true
  },
  
  // Limit redundant logging 
  deduplicateInitMessages: true
};

// Track which services have logged initialization already
const initLoggedServices = new Set<string>();

/**
 * Determine the appropriate log level for a given service
 */
export function getLogLevelForService(serviceName: string): LogLevel {
  // Exact match
  if (LOG_LEVELS[serviceName]) {
    return LOG_LEVELS[serviceName];
  }
  
  // Prefix match
  for (const prefix of Object.keys(LOG_LEVELS)) {
    if (serviceName.startsWith(prefix) && prefix !== 'default') {
      return LOG_LEVELS[prefix];
    }
  }
  
  // Default log level
  return LOG_LEVELS.default;
}

/**
 * Determines whether a service should log its initialization
 * based on environment and configuration
 */
export function shouldLogInitialization(serviceName: string): boolean {
  // Always log if in development mode and not configured specifically
  if (!SERVICE_INIT_CONFIG.serviceLoggingEnabled.hasOwnProperty(serviceName)) {
    return NODE_ENV === 'development';
  }
  
  // Check environment-based logging
  if (!SERVICE_INIT_CONFIG.environmentBasedLogging[NODE_ENV as keyof typeof SERVICE_INIT_CONFIG.environmentBasedLogging]) {
    return false;
  }
  
  // Check service-specific logging
  if (!SERVICE_INIT_CONFIG.serviceLoggingEnabled[serviceName as keyof typeof SERVICE_INIT_CONFIG.serviceLoggingEnabled]) {
    return false;
  }
  
  // Optional: Deduplicate logs
  if (SERVICE_INIT_CONFIG.deduplicateInitMessages) {
    if (initLoggedServices.has(serviceName)) {
      return false;
    }
    
    initLoggedServices.add(serviceName);
  }
  
  return true;
}

/**
 * Determines whether to log service registration in ServiceRegistry
 */
export function shouldLogServiceRegistration(): boolean {
  return NODE_ENV === 'development';
}

/**
 * Reset the logged services tracking 
 * (mainly for testing purposes)
 */
export function resetLoggedServices(): void {
  initLoggedServices.clear();
}

/**
 * Get the current log level
 */
export function getLogLevel(): string {
  return LOG_LEVEL;
}

// Export all configuration
export const LoggerConfig = {
  LOG_LEVELS,
  SERVICE_INIT_CONFIG,
  getLogLevelForService,
  shouldLogInitialization,
  shouldLogServiceRegistration,
  resetLoggedServices,
  getLogLevel,
}; 