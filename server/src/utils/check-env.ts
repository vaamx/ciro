/**
 * Environment checks and warnings for disabled features
 */
import { createLogger } from './logger';

const logger = createLogger('EnvCheck');

/**
 * Output warnings for disabled features based on environment variables
 */
export function checkDisabledFeatures(): void {
  // Check for embedding cache setting
  const embedCacheDisabled = process.env.DISABLE_EMBEDDING_CACHE === 'true';
  
  if (embedCacheDisabled) {
    logger.warn('Embedding cache is disabled. This may increase OpenAI API usage.');
    logger.info('To enable caching, set DISABLE_EMBEDDING_CACHE=false in your .env file');
  } else {
    logger.info('Embedding cache is enabled (default)');
  }
  
  // Output information about removed dependencies
  logger.info('External document processing APIs (Unstructured, LlamaIndex) have been removed');
  logger.info('All document processing is handled natively by the application');
}

/**
 * Check for presence of required environment variables
 * @returns Array of warning messages for any missing variables
 */
export function checkRequiredVariables(): string[] {
  const warnings: string[] = [];
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY is missing - embeddings and completions will not work');
  }
  
  // Check for database connection
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    warnings.push('Database connection variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) are incomplete');
  }
  
  return warnings;
}

/**
 * Run all environment checks and output warnings
 */
export function runEnvironmentChecks(): void {
  logger.info('Running environment checks...');
  
  // Check for disabled features
  checkDisabledFeatures();
  
  // Check for required variables
  const warnings = checkRequiredVariables();
  
  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings:');
    warnings.forEach(warning => logger.warn(`- ${warning}`));
  } else {
    logger.info('All required environment variables are present');
  }
  
  logger.info('Environment checks complete');
}

export default runEnvironmentChecks; 