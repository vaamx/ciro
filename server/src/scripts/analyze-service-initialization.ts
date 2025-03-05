/**
 * Service Initialization Analyzer
 * 
 * This script analyzes the codebase to identify service initialization patterns
 * and detects potential redundancies or issues that cause excessive logging
 * during startup.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('ServiceAnalyzer');

// Services that appear to be initialized multiple times
const problematicServices = [
  'QdrantService',
  'OpenAI client',
  'ConfigService',
  'ChunkingService',
  'DocumentProcessorFactory',
  'EnhancedExcelProcessorService',
  'CustomPdfProcessorService',
  'CustomDocxProcessorService',
  'CsvProcessorService',
  'UnstructuredProcessorService',
  'Document Processor Service',
];

// Files that likely need singleton implementation
const filesToCheck = [
  'server/src/services/qdrant.service.ts',
  'server/src/services/config.service.ts',
  'server/src/services/chunking.service.ts',
  'server/src/services/document-processor.service.ts',
  'server/src/services/document-processors/document-processor-factory.ts',
  'server/src/services/openai.service.ts', // if this exists
];

/**
 * Check if a service already implements the singleton pattern
 */
function checkIfSingletonImplemented(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`File not found: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for typical singleton pattern implementations
    const hasSingletonInstance = content.includes('private static instance') || 
                                content.includes('static getInstance');
    
    return hasSingletonInstance;
  } catch (error) {
    logger.error(`Error checking file ${filePath}: ${error}`);
    return false;
  }
}

/**
 * Find all places where new service instances are created
 */
async function findServiceInstantiations(serviceName: string) {
  // This would use grep or similar to find all instantiations
  // For now, just print a message
  logger.info(`To find all instantiations of ${serviceName}, run: grep -r "new ${serviceName}(" --include="*.ts" server/src/`);
}

/**
 * Analyze logger usage in the codebase
 */
function analyzeLoggerUsage() {
  logger.info(`Checking for excessive logging...`);
  logger.info(`To find all logger.info statements: grep -r "logger.info" --include="*.ts" server/src/`);
  logger.info(`Consider setting appropriate log levels for production vs development environments`);
}

/**
 * Generate recommendations for fixing service initialization issues
 */
function generateRecommendations() {
  logger.info('====== RECOMMENDATIONS ======');
  logger.info('1. Implement Singleton pattern for all major services');
  logger.info('   - Use static getInstance() methods for service access');
  logger.info('   - Remove direct instantiation with "new Service()"');
  logger.info('   - Ensure thread safety with proper initialization checks');
  logger.info('');
  logger.info('2. Reduce logging verbosity');
  logger.info('   - Set appropriate log levels based on environment');
  logger.info('   - Remove or reduce duplicate initialization logs');
  logger.info('   - Consider using debug level for initialization details');
  logger.info('');
  logger.info('3. Consolidate service initialization');
  logger.info('   - Create a centralized service registry or container');
  logger.info('   - Initialize services only when needed (lazy loading)');
  logger.info('   - Implement dependency injection to manage service lifecycle');
  logger.info('');
  logger.info('4. Clean up configuration logging');
  logger.info('   - Log configuration details only once at startup');
  logger.info('   - Use structured logging for configuration details');
  logger.info('');
  logger.info('5. Implement a startup orchestrator');
  logger.info('   - Control the sequence of service initialization');
  logger.info('   - Ensure services are initialized exactly once');
  logger.info('   - Log the startup process in a clean, structured way');
}

async function main() {
  logger.info('Analyzing service initialization patterns...');
  
  // Check which services already implement singleton pattern
  for (const file of filesToCheck) {
    const isSingleton = checkIfSingletonImplemented(file);
    logger.info(`${path.basename(file)}: ${isSingleton ? 'Has singleton implementation' : 'No singleton implementation found'}`);
    
    if (!isSingleton) {
      const serviceName = path.basename(file, '.ts').replace(/-/g, '');
      await findServiceInstantiations(serviceName);
    }
  }
  
  analyzeLoggerUsage();
  generateRecommendations();
  
  logger.info('Analysis complete. See recommendations above for improving startup performance.');
}

// Execute the script
main().catch(error => {
  logger.error(`Error running analysis: ${error}`);
  process.exit(1);
}); 