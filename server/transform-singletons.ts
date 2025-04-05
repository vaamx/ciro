// transform-singletons.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Configure script options
const DRY_RUN = false; // Set to true to not actually modify files
const ROOT_DIR = 'src/services';
const OUTPUT_MODULE_PATH = 'src/services.module.ts';

console.log('🔍 Scanning for singleton patterns...');

const sourceFiles = glob.sync(`${ROOT_DIR}/**/*.ts`);
const serviceMap = new Map<string, string[]>(); // To track service dependencies
const stats = {
  processedFiles: 0,
  filesWithSingletons: 0,
  transformedFiles: 0,
  failures: 0,
  skipped: 0
};

sourceFiles.forEach(filePath => {
  try {
    stats.processedFiles++;
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    
    // More robust singleton detection
    const hasSingleton = 
      (sourceCode.includes('static instance') || sourceCode.includes('static readonly instance')) && 
      sourceCode.includes('getInstance()');
    
    if (!hasSingleton) {
      return;
    }
    
    console.log(`Found singleton pattern in: ${filePath}`);
    stats.filesWithSingletons++;
    
    // Track dependencies (services that call getInstance())
    const dependencies = extractDependencies(sourceCode);
    const className = extractClassName(sourceCode);
    
    if (className) {
      serviceMap.set(className, dependencies);
      
      // Transform the code
      const transformedCode = transformSingleton(sourceCode);
      
      if (transformedCode !== sourceCode) {
        if (!DRY_RUN) {
          // Create backup
          fs.writeFileSync(`${filePath}.bak`, sourceCode);
          
          // Write transformed code
          fs.writeFileSync(filePath, transformedCode);
          console.log(`✅ Transformed: ${filePath}`);
          stats.transformedFiles++;
        } else {
          console.log(`🔄 Would transform (dry run): ${filePath}`);
          stats.skipped++;
        }
      }
    } else {
      console.warn(`⚠️ Could not extract class name from: ${filePath}`);
      stats.skipped++;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    stats.failures++;
  }
});

// Generate module file with all services
if (!DRY_RUN && serviceMap.size > 0) {
  try {
    generateModuleFile(serviceMap);
    console.log(`✅ Generated module file: ${OUTPUT_MODULE_PATH}`);
  } catch (error) {
    console.error(`❌ Error generating module file:`, error);
    stats.failures++;
  }
}

// Print statistics
console.log('\n📊 Transformation Statistics:');
console.log(`Total files processed: ${stats.processedFiles}`);
console.log(`Files with singletons: ${stats.filesWithSingletons}`);
console.log(`Files transformed: ${stats.transformedFiles}`);
console.log(`Files skipped: ${stats.skipped}`);
console.log(`Failures: ${stats.failures}`);

function extractClassName(sourceCode: string): string | null {
  const classMatch = sourceCode.match(/export\s+class\s+(\w+)/);
  return classMatch ? classMatch[1] : null;
}

function extractDependencies(sourceCode: string): string[] {
  const regex = /(\w+)\.getInstance\(\)/g;
  const matches = [...sourceCode.matchAll(regex)];
  return [...new Set(matches.map(match => match[1]))];
}

function transformSingleton(sourceCode: string): string {
  // Check for existing @Injectable decorator
  if (sourceCode.includes('@Injectable()')) {
    console.log('  ℹ️ Already has @Injectable() decorator');
  }
  
  // Add NestJS imports
  let result = sourceCode.includes('@nestjs/common') ? 
    sourceCode : 
    `import { Injectable } from '@nestjs/common';\n${sourceCode}`;
  
  // Replace class definition with @Injectable()
  if (!result.includes('@Injectable()')) {
    result = result.replace(/export\s+class\s+(\w+)/, '@Injectable()\nexport class $1');
  }
  
  // Remove static instance property - handle multiple formats
  result = result.replace(/private\s+static(\s+readonly)?\s+instance:[\s\S]*?;/g, '');
  
  // Transform getInstance method to constructor with DI - handle multiple formats
  result = result.replace(
    /public\s+static\s+getInstance\(\):[\s\S]*?return[\s\S]*?instance;[\s\S]*?\}/s,
    ''
  );
  
  // Replace getInstance calls with constructor injection
  const getInstanceRegex = /(\w+)\.getInstance\(\)/g;
  const dependencies = [...new Set([...result.matchAll(getInstanceRegex)].map(m => m[1]))];
  
  // Add constructor with dependencies
  if (dependencies.length > 0) {
    const constructorParams = dependencies
      .map(dep => `private readonly ${dep.charAt(0).toLowerCase() + dep.slice(1)}: ${dep}`)
      .join(',\n    ');
    
    // Check if constructor already exists
    if (result.includes('constructor(')) {
      // Enhance existing constructor
      result = result.replace(
        /constructor\(([\s\S]*?)\) {/,
        `constructor(\n    ${constructorParams}${result.includes('constructor(') && constructorParams ? ',\n    ' : ''}$1) {`
      );
    } else {
      // Add new constructor before first method
      result = result.replace(
        /{(\s+)/,
        `{\n  constructor(\n    ${constructorParams}\n  ) {}\n$1`
      );
    }
    
    // Replace getInstance calls
    dependencies.forEach(dep => {
      const depInstance = dep.charAt(0).toLowerCase() + dep.slice(1);
      result = result.replace(
        new RegExp(`${dep}\\.getInstance\\(\\)`, 'g'),
        `this.${depInstance}`
      );
    });
  }
  
  return result;
}

function generateModuleFile(serviceMap: Map<string, string[]>): void {
  // Create a NestJS module file that imports and provides all services
  const services = [...serviceMap.keys()];
  
  // Sort services to ensure consistent output
  services.sort();
  
  // Map service class names to file paths (kebab-case)
  const imports = services
    .map(service => {
      // Convert CamelCase to kebab-case
      const kebabCase = service.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      
      // Remove 'Service' suffix for the filename if present
      const baseFileName = kebabCase.endsWith('-service') 
        ? kebabCase.substring(0, kebabCase.length - 8) 
        : kebabCase;
      
      return `import { ${service} } from './services/${baseFileName}';`;
    })
    .join('\n');
  
  const providersArray = services.join(',\n    ');
  
  const moduleCode = `
import { Module } from '@nestjs/common';
${imports}

@Module({
  providers: [
    ${providersArray}
  ],
  exports: [
    ${providersArray}
  ]
})
export class ServicesModule {}
  `;
  
  fs.writeFileSync(OUTPUT_MODULE_PATH, moduleCode);
}