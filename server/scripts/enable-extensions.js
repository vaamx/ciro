#!/usr/bin/env node

/**
 * This script manually enables the required PostgreSQL extensions
 * without using Knex's transaction management.
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || '***REMOVED***',
  user: process.env.DB_USER || '***REMOVED***',
  password: process.env.DB_PASSWORD || '***REMOVED***',
});

async function enableExtensions() {
  const client = await pool.connect();
  
  try {
    console.log('Enabling core PostgreSQL extensions...');
    
    // Enable core PostgreSQL extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    console.log('Core PostgreSQL extensions enabled successfully');
    
    // Try to enable vector extension but don't fail if not available
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "vector"');
      console.log('Vector extension enabled successfully');
      
      // Check if system_settings table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'system_settings'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        await client.query(`
          INSERT INTO system_settings (key, value)
          VALUES ('vector_support', '{"enabled": true}')
          ON CONFLICT (key) DO UPDATE
          SET value = '{"enabled": true}',
              updated_at = CURRENT_TIMESTAMP;
        `);
        console.log('Updated system_settings with vector_support = true');
      } else {
        console.log('system_settings table does not exist yet, skipping vector support configuration');
      }
    } catch (error) {
      console.warn('Failed to enable vector extension. This may be because it is not installed in the PostgreSQL instance.');
      console.warn('You may need to install the pgvector extension in your PostgreSQL instance.');
      console.warn('For more information, see: https://github.com/pgvector/pgvector');
      console.warn('Proceeding without vector extension. Vector-related features will not be available.');
      
      // Check if system_settings table exists
      try {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'system_settings'
          );
        `);
        
        if (tableCheck.rows[0].exists) {
          await client.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('vector_support', '{"enabled": false, "reason": "extension_not_found"}')
            ON CONFLICT (key) DO UPDATE
            SET value = '{"enabled": false, "reason": "extension_not_found"}',
                updated_at = CURRENT_TIMESTAMP;
          `);
          console.log('Updated system_settings with vector_support = false');
        } else {
          console.log('system_settings table does not exist yet, skipping vector support configuration');
        }
      } catch (settingsError) {
        console.warn('Could not update system_settings for vector support:', settingsError);
      }
    }
    
    // Mark the migration as complete in the knex_migrations table
    try {
      const migrationExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM knex_migrations 
          WHERE name = '20240223_enable_extensions.ts'
        );
      `);
      
      if (!migrationExists.rows[0].exists) {
        // Get the latest batch number
        const batchResult = await client.query(`
          SELECT MAX(batch) as max_batch FROM knex_migrations
        `);
        
        const batch = (batchResult.rows[0].max_batch || 0) + 1;
        
        // Insert the migration record
        await client.query(`
          INSERT INTO knex_migrations (name, batch, migration_time)
          VALUES ('20240223_enable_extensions.ts', $1, NOW())
        `, [batch]);
        
        console.log('Marked extension migration as complete in knex_migrations table');
      } else {
        console.log('Extension migration already marked as complete in knex_migrations table');
      }
    } catch (migrationError) {
      console.warn('Could not update knex_migrations table:', migrationError);
    }
    
    console.log('Extensions setup completed successfully');
  } catch (error) {
    console.error('Error enabling extensions:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

enableExtensions().catch(err => {
  console.error('Error in enable-extensions script:', err);
  process.exit(1);
}); 