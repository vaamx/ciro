import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Starting default organization creation process...');
  
  const prisma = new PrismaClient();
  
  // Create PostgreSQL pool for direct queries if needed
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || '***REMOVED***ql://***REMOVED***:***REMOVED***@localhost:5432/ciro_db',
  });
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    
    // Check if organization ID 235 already exists
    console.log('Checking if organization with ID 235 exists...');
    const { rows: existingOrg } = await pool.query(`
      SELECT id, name FROM organizations WHERE id = 235
    `);
    
    if (existingOrg.length > 0) {
      console.log('Organization with ID 235 already exists:', existingOrg[0]);
      return;
    }
    
    // Create default organization with ID 235
    console.log('Creating default organization with ID 235...');
    await pool.query(`
      INSERT INTO organizations (id, name, created_at, updated_at)
      VALUES (235, 'Default Organization', NOW(), NOW())
    `);
    
    // Verify organization was created
    const { rows: createdOrg } = await pool.query(`
      SELECT id, name FROM organizations WHERE id = 235
    `);
    
    if (createdOrg.length > 0) {
      console.log('Organization created successfully:', createdOrg[0]);
    } else {
      console.error('Failed to create organization!');
    }
    
    // Also create organization 1 for local fallback ID
    console.log('Creating organization with ID 1 for local fallback sessions...');
    try {
      await pool.query(`
        INSERT INTO organizations (id, name, created_at, updated_at)
        VALUES (1, 'Local Organization', NOW(), NOW())
      `);
      console.log('Local organization (ID 1) created successfully');
    } catch (error) {
      console.log('Local organization may already exist:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // List all organizations
    const { rows: allOrgs } = await pool.query(`
      SELECT id, name FROM organizations
    `);
    
    console.log('All organizations in database:');
    console.table(allOrgs);
    
  } catch (error) {
    console.error('Error creating default organization:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main(); 