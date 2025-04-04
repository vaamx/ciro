import * as fs from 'fs';
import * as path from 'path';
import knex, { Knex } from 'knex';
import { config } from '../../config';
import { execSync } from 'child_process';

/**
 * Script to run both Prisma and TypeScript migrations
 * This ensures all migrations are applied in the correct order
 */
async function runMigrations() {
  console.log('=== CIRO Migration Runner ===');
  
  // First, run Prisma migrations if they exist
  const prismaSchemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
  
  if (fs.existsSync(prismaSchemaPath)) {
    console.log('\n=== Running Prisma migrations ===');
    
    try {
      // Run prisma migrate deploy to apply any pending Prisma migrations
      const prismaCommand = `DATABASE_URL="${process.env.DATABASE_URL}" npx prisma migrate deploy --schema=${prismaSchemaPath}`;
      console.log(`Running command: ${prismaCommand}`);
      
      execSync(prismaCommand, { stdio: 'inherit' });
      console.log('Prisma migrations completed successfully');
    } catch (error) {
      console.error('Error running Prisma migrations:', error);
      throw error;
    }
  } else {
    console.log('No Prisma schema found at:', prismaSchemaPath);
  }
  
  // Now run TypeScript migrations
  console.log('\n=== Running TypeScript migrations ===');
  
  // Connect to database
  const connectionConfig = process.env.DATABASE_URL || {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database
  };
  
  console.log('Connecting to database...');
  const db = knex({
    client: 'pg',
    connection: connectionConfig
  });
  
  try {
    // Ensure migrations table exists
    await db.schema.hasTable('migrations').then((exists: boolean) => {
      if (!exists) {
        console.log('Creating migrations table...');
        return db.schema.createTable('migrations', (table: Knex.TableBuilder) => {
          table.increments('id').primary();
          table.string('name').unique().notNullable();
          table.timestamp('executed_at').defaultTo(db.fn.now());
        });
      }
    });
    
    // Get list of applied migrations
    const appliedMigrations = await db('migrations').select('name');
    const appliedNames = new Set(appliedMigrations.map((m: { name: string }) => m.name));
    
    console.log(`Found ${appliedNames.size} previously applied migrations in the database`);
    
    // Get all TS migration files
    const migrationsDir = path.resolve(__dirname, '../../../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found at:', migrationsDir);
      console.log('Skipping TypeScript migrations');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.includes('utils'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files in the directory`);
    
    // Run each migration if not already applied
    let appliedCount = 0;
    let skippedCount = 0;
    
    for (const file of migrationFiles) {
      const migrationName = path.basename(file);
      
      if (!appliedNames.has(migrationName)) {
        console.log(`Applying migration: ${migrationName}`);
        
        // Import and run the migration
        const migrationPath = path.join(migrationsDir, file);
        
        try {
          // For TypeScript files in production (compiled)
          let migration;
          
          if (process.env.NODE_ENV === 'production' && file.endsWith('.ts')) {
            // In production, try to load the compiled JS version
            const jsFile = file.replace('.ts', '.js');
            const jsPath = path.join(migrationsDir, jsFile);
            
            if (fs.existsSync(jsPath)) {
              migration = require(jsPath);
            } else {
              console.error(`Production environment detected but compiled JS file not found for: ${file}`);
              console.error(`Expected compiled file at: ${jsPath}`);
              throw new Error(`Missing compiled migration file: ${jsFile}`);
            }
          } else {
            // In development or for JS files
            migration = require(migrationPath);
          }
          
          // Run the migration
          await migration.up(db);
          
          // Record the migration
          await db('migrations').insert({
            name: migrationName,
            executed_at: new Date()
          });
          
          console.log(`Migration ${migrationName} completed successfully`);
          appliedCount++;
        } catch (error) {
          console.error(`Error applying migration ${migrationName}:`, error);
          throw error;
        }
      } else {
        console.log(`Migration ${migrationName} already applied, skipping`);
        skippedCount++;
      }
    }
    
    console.log(`\nMigration summary: ${appliedCount} applied, ${skippedCount} skipped`);
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    await db.destroy();
    console.log('Database connection closed');
  }
}

// Don't run the migrations if this file is imported by another file
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
}

export { runMigrations }; 