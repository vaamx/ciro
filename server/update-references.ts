import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Configure script options
const DRY_RUN = false; // Set to true to not actually modify files
const ROOT_DIR = 'src';
const EXCLUDED_DIRS = ['node_modules', 'dist', 'coverage'];

console.log('🔍 Starting reference update process...');

// Collect all service names that have been converted to injectable
const servicesModulePath = 'src/services.module.ts';
const serviceNames: string[] = [];

if (fs.existsSync(servicesModulePath)) {
  const moduleContent = fs.readFileSync(servicesModulePath, 'utf-8');
  const importRegex = /import\s+{\s*(\w+)\s*}\s+from/g;
  let match;
  
  while ((match = importRegex.exec(moduleContent)) !== null) {
    serviceNames.push(match[1]);
  }
  
  console.log(`Found ${serviceNames.length} injectable services from services module`);
} else {
  console.warn('⚠️ Services module not found. Please run transform-singletons.ts first.');
  process.exit(1);
}

// Find all TS files except those in excluded directories
const excludePattern = EXCLUDED_DIRS.map(dir => `!**/${dir}/**`);
const sourceFiles = glob.sync([`${ROOT_DIR}/**/*.ts`, ...excludePattern]);

console.log(`Scanning ${sourceFiles.length} files for getInstance() references...`);

const stats = {
  processedFiles: 0,
  modifiedFiles: 0,
  referencesFound: 0,
  failures: 0
};

// Process each file
sourceFiles.forEach(filePath => {
  try {
    stats.processedFiles++;
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    
    // Skip files that don't have getInstance() calls
    if (!sourceCode.includes('getInstance()')) {
      return;
    }
    
    let modifiedCode = sourceCode;
    let fileModified = false;
    
    // Look for direct getInstance() calls for each service
    serviceNames.forEach(serviceName => {
      const getInstancePattern = new RegExp(`${serviceName}\\.getInstance\\(\\)`, 'g');
      
      if (getInstancePattern.test(sourceCode)) {
        stats.referencesFound++;
        
        // Replace with constructor/property injection approach
        // This depends on the context - we're showing general patterns
        
        // Pattern 1: In a class constructor
        if (
          modifiedCode.includes('constructor(') && 
          !modifiedCode.includes(`private readonly ${serviceName.charAt(0).toLowerCase() + serviceName.slice(1)}`)
        ) {
          // Add parameter to constructor
          const paramName = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
          modifiedCode = modifiedCode.replace(
            /constructor\(([^)]*)\)/,
            (match, params) => {
              const newParam = `private readonly ${paramName}: ${serviceName}`;
              return `constructor(${params ? params + ', ' : ''}${newParam})`;
            }
          );
          
          // Replace getInstance calls
          modifiedCode = modifiedCode.replace(
            getInstancePattern,
            `this.${paramName}`
          );
          
          fileModified = true;
        }
      }
    });
    
    // Save the modified file
    if (fileModified) {
      if (!DRY_RUN) {
        // Create backup
        fs.writeFileSync(`${filePath}.bak`, sourceCode);
        
        // Write modified code
        fs.writeFileSync(filePath, modifiedCode);
        console.log(`✅ Updated references in: ${filePath}`);
        stats.modifiedFiles++;
      } else {
        console.log(`🔄 Would update references (dry run): ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    stats.failures++;
  }
});

// Print statistics
console.log('\n📊 Reference Update Statistics:');
console.log(`Total files processed: ${stats.processedFiles}`);
console.log(`Files modified: ${stats.modifiedFiles}`);
console.log(`References found: ${stats.referencesFound}`);
console.log(`Failures: ${stats.failures}`);

console.log('\n⚠️ IMPORTANT: This script made best-effort changes, but you should review all modified files!');
console.log('Some reference points may require manual updates, especially in more complex scenarios.');
console.log('Look for .bak files to compare with the originals.'); 