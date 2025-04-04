import * as fs from 'fs';
import * as path from 'path';

// Update path to point to the parent directory since we're now in utils subdirectory
const MIGRATIONS_DIR = path.resolve(__dirname, '../');

// Function to validate a TypeScript migration file
async function validateMigration(filePath: string): Promise<boolean> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return false;
    }

    // Import the migration
    const migration = await import(filePath);
    
    // Verify that up and down functions exist
    if (typeof migration.up !== 'function') {
      console.error(`Missing 'up' function in ${filePath}`);
      return false;
    }
    
    if (typeof migration.down !== 'function') {
      console.error(`Missing 'down' function in ${filePath}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error validating migration ${filePath}:`, error);
    return false;
  }
}

async function validateAllMigrations() {
  // Get all TS migration files
  const tsMigrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.ts') && !file.includes('/utils/')) // Exclude utility files
    .map(file => path.join(MIGRATIONS_DIR, file));
  
  console.log(`Found ${tsMigrations.length} TypeScript migration files to validate`);
  
  let validCount = 0;
  let invalidCount = 0;
  
  // Validate each migration
  for (const migration of tsMigrations) {
    const relativePath = path.relative(path.resolve(__dirname, '../../'), migration);
    process.stdout.write(`Validating ${relativePath}... `);
    
    const isValid = await validateMigration(migration);
    
    if (isValid) {
      process.stdout.write('✓ Valid\n');
      validCount++;
    } else {
      process.stdout.write('✗ Invalid\n');
      invalidCount++;
    }
  }
  
  // Print summary
  console.log(`\nValidation complete: ${validCount} valid, ${invalidCount} invalid`);
  
  return invalidCount === 0;
}

// Run the validation
validateAllMigrations()
  .then(success => {
    if (success) {
      console.log('All migrations are valid! ✅');
      process.exit(0);
    } else {
      console.error('Some migrations are invalid. Please fix them before proceeding. ❌');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error during validation:', error);
    process.exit(1);
  }); 