import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';

async function main() {
  console.log('Starting database migration process...');
  
  // Create a Prisma client instance
  const prisma = new PrismaClient();
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('Database connection successful!');
    
    // Run Prisma migration script
    console.log('Generating Prisma migrations...');
    try {
      // Create migrations directory if it doesn't exist
      const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }
      
      // Generate migration
      execSync('npx prisma migrate dev --name init_all_tables --create-only', {
        stdio: 'inherit',
      });
      
      console.log('Migration generated successfully!');
      
      // Apply migration
      console.log('Applying migration to database...');
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
      });
      
      console.log('Migration applied successfully!');
    } catch (migrationError) {
      console.error('Error during migration:', migrationError);
      throw migrationError;
    }
    
    // Generate Prisma client
    console.log('Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
    });
    
    console.log('Prisma client generated successfully!');
    
    // List tables in the database to confirm migration was successful
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('Tables in database:');
    console.log(tables);
    
    console.log('Migration process completed successfully!');
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 