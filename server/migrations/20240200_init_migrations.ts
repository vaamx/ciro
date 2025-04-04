import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Running initial migration to set up the database...');
  
  // Enable core PostgreSQL extensions directly with raw queries
  // These will work even if we're in an aborted transaction state
  try {
    // We need to use a direct client connection for these operations
    // to avoid transaction issues
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      database: process.env.DB_NAME || '***REMOVED***',
      user: process.env.DB_USER || '***REMOVED***',
      password: process.env.DB_PASSWORD || '***REMOVED***',
    });
    
    const client = await pool.connect();
    
    try {
      console.log('Enabling core PostgreSQL extensions...');
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
      console.log('Core PostgreSQL extensions enabled successfully');
      
      // Try to enable vector extension but don't fail if not available
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS "vector"');
        console.log('Vector extension enabled successfully');
      } catch (error) {
        console.warn('Failed to enable vector extension. Vector-related features will not be available.');
        console.warn('You may need to install the pgvector extension in your PostgreSQL instance.');
      }
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('Error enabling extensions:', error);
    // Don't throw, continue with the migration
  }
  
  console.log('Initial migration completed');
  return Promise.resolve();
};

export function down(knex: Knex): Promise<void> {
  // We don't want to drop extensions on rollback
  return Promise.resolve();
}; 