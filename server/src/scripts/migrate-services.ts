import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { getServiceRegistry } from '../services/service-registry';

const logger = createLogger('ServiceMigration');

interface ServiceMapping {
  oldPattern: RegExp;
  newCode: string;
  description: string;
}

// Define migration mappings for common patterns
const SERVICE_MIGRATIONS: ServiceMapping[] = [
  {
    oldPattern: /new\s+QdrantService\(\)/g,
    newCode: 'QdrantService.getInstance()',
    description: 'QdrantService direct instantiation'
  },
  {
    oldPattern: /new\s+OpenAIService\(\)/g,
    newCode: 'OpenAIService.getInstance()',
    description: 'OpenAIService direct instantiation'
  },
  {
    oldPattern: /new\s+ConfigService\(\)/g,
    newCode: 'ConfigService.getInstance()',
    description: 'ConfigService direct instantiation'
  },
  {
    oldPattern: /new\s+ChunkingService\(\)/g,
    newCode: 'ChunkingService.getInstance()',
    description: 'ChunkingService direct instantiation'
  },
  {
    oldPattern: /this\.qdrantService\s*=\s*new\s+QdrantService\(\)/g,
    newCode: 'this.qdrantService = QdrantService.getInstance()',
    description: 'Class member QdrantService instantiation'
  },
  {
    oldPattern: /this\.openai(?:Service)?\s*=\s*new\s+OpenAIService\(\)/g,
    newCode: 'this.openai = OpenAIService.getInstance()',
    description: 'Class member OpenAIService instantiation'
  },
  {
    oldPattern: /this\.configService\s*=\s*new\s+ConfigService\(\)/g, 
    newCode: 'this.configService = ConfigService.getInstance()',
    description: 'Class member ConfigService instantiation'
  },
  {
    oldPattern: /this\.chunkingService\s*=\s*new\s+ChunkingService\(\)/g,
    newCode: 'this.chunkingService = ChunkingService.getInstance()',
    description: 'Class member ChunkingService instantiation'
  },
  // Service Registry examples
  {
    oldPattern: /const\s+qdrantService\s*=\s*new\s+QdrantService\(\)/g,
    newCode: 'const qdrantService = getServiceRegistry().getQdrantService()',
    description: 'Local variable QdrantService instantiation'
  },
  {
    oldPattern: /const\s+openAIService\s*=\s*new\s+OpenAIService\(\)/g,
    newCode: 'const openAIService = getServiceRegistry().getOpenAIService()',
    description: 'Local variable OpenAIService instantiation'
  }
];

/**
 * Find TypeScript files in a directory that contain service instantiations
 */
async function findFilesWithServiceInstantiations(
  directory: string = 'src',
  fileExtensions: string[] = ['.ts', '.tsx']
): Promise<string[]> {
  const matchingFiles: string[] = [];
  const instantiationPatterns = SERVICE_MIGRATIONS.map(m => m.oldPattern.source).join('|');
  const pattern = new RegExp(instantiationPatterns);
  
  function scanDirectory(dir: string): void {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules and dist
        if (item !== 'node_modules' && item !== 'dist') {
          scanDirectory(itemPath);
        }
      } else if (stats.isFile() && fileExtensions.some(ext => item.endsWith(ext))) {
        try {
          const content = fs.readFileSync(itemPath, 'utf8');
          if (pattern.test(content)) {
            matchingFiles.push(itemPath);
          }
        } catch (error) {
          logger.error(`Error reading file ${itemPath}: ${error}`);
        }
      }
    }
  }
  
  scanDirectory(directory);
  return matchingFiles;
}

/**
 * Backup a file before modifying it
 */
function backupFile(filePath: string): void {
  const backupPath = `${filePath}.bak`;
  fs.copyFileSync(filePath, backupPath);
  logger.info(`Backed up file to ${backupPath}`);
}

/**
 * Apply the migrations to a file
 */
function migrateFile(filePath: string, dryRun: boolean = true): void {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let changes: string[] = [];
    
    // Check if we need to add import for ServiceRegistry
    const needsImport = SERVICE_MIGRATIONS.some(m => 
      m.newCode.includes('getServiceRegistry()') && m.oldPattern.test(content)
    );
    
    if (needsImport && !content.includes('import { getServiceRegistry }')) {
      const importStatement = "import { getServiceRegistry } from '../services/service-registry';";
      // Add import after other imports
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfImportLine = content.indexOf('\n', lastImportIndex) + 1;
        content = content.slice(0, endOfImportLine) + importStatement + '\n' + content.slice(endOfImportLine);
        modified = true;
        changes.push('Added ServiceRegistry import');
      }
    }
    
    // Apply each migration pattern
    for (const migration of SERVICE_MIGRATIONS) {
      const { oldPattern, newCode, description } = migration;
      
      if (oldPattern.test(content)) {
        const originalContent = content;
        content = content.replace(oldPattern, newCode);
        
        if (content !== originalContent) {
          modified = true;
          changes.push(`Replaced ${description} with ${newCode}`);
        }
      }
    }
    
    if (modified) {
      logger.info(`File ${filePath} would be modified with changes:`, changes);
      
      if (!dryRun) {
        backupFile(filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        logger.info(`Successfully migrated ${filePath}`);
      }
    } else {
      logger.info(`No changes needed for ${filePath}`);
    }
  } catch (error) {
    logger.error(`Error migrating file ${filePath}: ${error}`);
  }
}

/**
 * Run the migration script
 */
async function runMigration(directory: string = 'src', dryRun: boolean = true): Promise<void> {
  try {
    logger.info(`Starting service migration${dryRun ? ' (DRY RUN)' : ''}`);
    
    const files = await findFilesWithServiceInstantiations(directory);
    logger.info(`Found ${files.length} files with service instantiations`);
    
    for (const file of files) {
      migrateFile(file, dryRun);
    }
    
    if (dryRun) {
      logger.info('This was a dry run. To actually make the changes, run with --apply flag');
    } else {
      logger.info('Migration completed successfully');
    }
  } catch (error) {
    logger.error(`Migration error: ${error}`);
  }
}

// Allow running as standalone script
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const directory = args.find(arg => !arg.startsWith('--')) || 'src';
  
  runMigration(directory, dryRun).catch(error => {
    logger.error(`Script error: ${error}`);
    process.exit(1);
  });
}

export { runMigration }; 