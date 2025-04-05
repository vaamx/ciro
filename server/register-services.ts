import * as fs from 'fs';
import * as path from 'path';

// Configure script options
const DRY_RUN = false; // Set to true to not actually modify files
const APP_MODULE_PATH = 'src/app.module.ts';
const SERVICES_MODULE_NAME = 'ServicesModule';

console.log('🔍 Registering services in main app module...');

if (!fs.existsSync(APP_MODULE_PATH)) {
  console.error(`❌ App module not found at ${APP_MODULE_PATH}`);
  process.exit(1);
}

const appModuleContent = fs.readFileSync(APP_MODULE_PATH, 'utf-8');

// Check if the ServicesModule is already imported and registered
const alreadyImported = appModuleContent.includes(`import { ${SERVICES_MODULE_NAME} }`);
const alreadyRegistered = appModuleContent.includes(SERVICES_MODULE_NAME);

if (alreadyImported && alreadyRegistered) {
  console.log('✅ ServicesModule is already properly registered in the app module.');
  process.exit(0);
}

// Create the modified content
let modifiedContent = appModuleContent;

// Add the import statement if needed
if (!alreadyImported) {
  const lastImport = modifiedContent.lastIndexOf('import ');
  const lastImportEnd = modifiedContent.indexOf(';', lastImport) + 1;
  
  const importStatement = `\nimport { ${SERVICES_MODULE_NAME} } from './services.module';`;
  
  modifiedContent = 
    modifiedContent.substring(0, lastImportEnd) + 
    importStatement + 
    modifiedContent.substring(lastImportEnd);
}

// Add the module to the imports array if needed
if (!alreadyRegistered) {
  // Find the imports array in the @Module decorator
  const importsMatch = modifiedContent.match(/imports\s*:\s*\[([\s\S]*?)\]/);
  
  if (importsMatch) {
    const importsContent = importsMatch[1];
    const importsArray = importsContent.trim();
    
    // Add ServicesModule to the imports array
    const newImportsArray = importsArray.length === 0
      ? SERVICES_MODULE_NAME
      : `${importsArray},\n    ${SERVICES_MODULE_NAME}`;
    
    modifiedContent = modifiedContent.replace(
      /imports\s*:\s*\[([\s\S]*?)\]/,
      `imports: [${newImportsArray}]`
    );
  } else {
    console.warn('⚠️ Could not find imports array in the app module. Manual changes needed.');
    
    // Try to add imports array if not found
    modifiedContent = modifiedContent.replace(
      /@Module\(\s*{/,
      `@Module({\n  imports: [${SERVICES_MODULE_NAME}],`
    );
  }
}

// Save the modified file
if (!DRY_RUN) {
  // Create backup
  fs.writeFileSync(`${APP_MODULE_PATH}.bak`, appModuleContent);
  
  // Write modified content
  fs.writeFileSync(APP_MODULE_PATH, modifiedContent);
  console.log(`✅ Updated app module: ${APP_MODULE_PATH}`);
  console.log('ServicesModule has been registered in the app module.');
} else {
  console.log(`🔄 Would update app module (dry run): ${APP_MODULE_PATH}`);
}

console.log('\n⚠️ IMPORTANT: Review the changes made to the app module to ensure everything is correct.');
console.log('You might need to adjust dependencies and circular references manually.');

// Provide instructions for resolving circular dependencies
console.log('\n📝 If you encounter circular dependency errors, consider these solutions:');
console.log('1. Use forward references: @Inject(forwardRef(() => DependentService))');
console.log('2. Create shared interfaces for circular dependencies');
console.log('3. Extract shared functionality to a common service');
console.log('4. Use event-based communication instead of direct dependencies');
console.log('5. Review your architecture to eliminate circular dependencies');

// Instructions for completing the migration
console.log('\n🚀 Next steps to complete the migration:');
console.log('1. Run the application and check for any runtime errors');
console.log('2. Fix any circular dependency issues');
console.log('3. Update unit tests to use TestingModule and dependency injection');
console.log('4. Remove any unused imports or code');
console.log('5. Delete backup (.bak) files once everything is working'); 