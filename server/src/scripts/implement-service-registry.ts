import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createLogger } from '../utils/logger';

const logger = createLogger('ServiceRegistryImplementation');

/**
 * Map of service names to their file paths
 */
const serviceMap: Record<string, string> = {
  'QdrantService': 'server/src/services/qdrant.service.ts',
  'ConfigService': 'server/src/services/config.service.ts',
  'OpenAIService': 'server/src/services/openai.service.ts',
  'DocumentProcessorFactory': 'server/src/services/document-processors/document-processor-factory.ts',
  'ChunkingService': 'server/src/services/chunking.service.ts',
  'DocumentProcessorService': 'server/src/services/document-processor.service.ts',
  'EnhancedExcelProcessorService': 'server/src/services/document-processors/enhanced-excel-processor.service.ts',
  'CustomPdfProcessorService': 'server/src/services/document-processors/custom-pdf-processor.service.ts',
  'CustomDocxProcessorService': 'server/src/services/document-processors/custom-docx-processor.service.ts',
  'CsvProcessorService': 'server/src/services/custom-csv-processor.ts',
  'UnstructuredProcessorService': 'server/src/services/unstructured-processor.service.ts',
  'RagService': 'server/src/services/rag.service.ts',
};

/**
 * Finds all instances of direct service instantiation
 */
async function findServiceInstantiations(folderPath: string = 'server/src', servicePattern: string = 'new \\w+Service\\('): Promise<Record<string, string[]>> {
  try {
    const command = `cd .. && grep -r "${servicePattern}" --include="*.ts" ${folderPath}`;
    const result = execSync(command).toString();
    
    const instantiations: Record<string, string[]> = {};
    
    result.split('\n').forEach(line => {
      if (!line) return;
      
      const [filePath, content] = line.split(':', 2);
      const match = content.match(/new (\w+)Service\(/);
      
      if (match && match[1]) {
        const serviceName = `${match[1]}Service`;
        if (!instantiations[serviceName]) {
          instantiations[serviceName] = [];
        }
        instantiations[serviceName].push(filePath);
      }
    });
    
    return instantiations;
  } catch (error) {
    logger.error(`Error finding service instantiations: ${error.message}`);
    return {};
  }
}

/**
 * Creates a patch file for a given service
 */
function createServiceRegistryPatch(serviceName: string, filePath: string): void {
  try {
    const templatePath = path.join(__dirname, 'templates', `${serviceName.toLowerCase()}.patch`);
    
    // Create a basic patch template
    const patchContent = `
--- a/${filePath}
+++ b/${filePath}
@@ -1,4 +1,6 @@
 import { createLogger } from '../utils/logger';
+import { getServiceRegistry } from './service-registry';
+
 
 /**
  * ${serviceName} class
@@ -10,6 +12,19 @@
 export class ${serviceName} {
   private readonly logger = createLogger('${serviceName}');
   
+  private static instance: ${serviceName} | null = null;
+  private static initializationLogged = false;
+  
+  /**
+   * Get the singleton instance of ${serviceName}
+   */
+  public static getInstance(): ${serviceName} {
+    if (!${serviceName}.instance) {
+      ${serviceName}.instance = new ${serviceName}();
+    }
+    return ${serviceName}.instance;
+  }
+  
   constructor() {
+    if (!${serviceName}.initializationLogged) {
+      this.logger.info(\`${serviceName} initialized\`);
+      ${serviceName}.initializationLogged = true;
`;
    
    // Create templates directory if it doesn't exist
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    
    fs.writeFileSync(templatePath, patchContent);
    logger.info(`Created patch template for ${serviceName} at ${templatePath}`);
  } catch (error) {
    logger.error(`Error creating patch template for ${serviceName}: ${error.message}`);
  }
}

/**
 * Generates a migration plan for all found services
 */
async function generateMigrationPlan(): Promise<void> {
  logger.info('Analyzing codebase for service instantiations...');
  
  const instantiations = await findServiceInstantiations();
  
  logger.info(`Found ${Object.keys(instantiations).length} services with direct instantiations`);
  
  Object.entries(instantiations).forEach(([serviceName, files]) => {
    logger.info(`${serviceName} is instantiated in ${files.length} files:`);
    files.forEach(file => logger.info(`  - ${file}`));
    
    if (serviceMap[serviceName]) {
      createServiceRegistryPatch(serviceName, serviceMap[serviceName]);
    }
  });
  
  // Generate implementation instructions
  logger.info('\nMIGRATION INSTRUCTIONS:');
  logger.info('1. First, ensure the ServiceRegistry class is implemented correctly');
  logger.info('2. For each service, implement the singleton pattern using the patch templates');
  logger.info('3. Update all service instantiations to use ServiceRegistry or the getInstance method');
  logger.info('4. Add appropriate caching mechanisms to prevent redundant initialization');
  logger.info('5. Update logging to respect verbosity settings');
}

/**
 * Update import statements to use ServiceRegistry
 */
async function updateImports(folderPath: string = 'server/src'): Promise<void> {
  logger.info('Updating import statements to use ServiceRegistry...');
  
  const sedCommands = [
    // Replace direct imports with ServiceRegistry
    `find ${folderPath} -name "*.ts" -exec sed -i 's/import { \\(\\w\\+\\)Service } from .*services.*/import { getServiceRegistry } from "\\.\\.\\/services\\/service-registry";/g' {} \\;`,
    
    // Replace instantiations with ServiceRegistry
    `find ${folderPath} -name "*.ts" -exec sed -i 's/new \\(\\w\\+\\)Service(/getServiceRegistry().get\\1Service(/g' {} \\;`,
  ];
  
  try {
    sedCommands.forEach(command => {
      execSync(`cd .. && ${command}`);
    });
    
    logger.info('Import statements updated successfully');
  } catch (error) {
    logger.error(`Error updating import statements: ${error.message}`);
  }
}

async function main() {
  logger.info('Service Registry Implementation Tool');
  logger.info('==================================');
  
  await generateMigrationPlan();
  
  // Uncomment to automatically update imports
  // await updateImports();
}

// Run the script if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Error running script: ${error.message}`);
    process.exit(1);
  });
} 