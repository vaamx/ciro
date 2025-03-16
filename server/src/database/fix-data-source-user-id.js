/**
 * Migration script to fix the data_sources table schema to handle UUID user IDs
 * 
 * This script:
 * 1. Alters the created_by column to accept string values (UUIDs) instead of integers
 * 2. Updates any records with invalid user IDs
 * 3. Creates proper indexes for faster lookups
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Create database connection
const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || '***REMOVED***',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    database: process.env.DB_DATABASE || 'cirodatabase',
  }
});

async function fixDataSourcesTable() {
  console.log('Starting migration: Fix data_sources table schema for UUID user IDs');
  
  try {
    // Check if the table exists
    const tableExists = await db.schema.hasTable('data_sources');
    if (!tableExists) {
      console.error('data_sources table does not exist!');
      return;
    }

    // Check column type
    const columnInfo = await db('data_sources').columnInfo('created_by');
    console.log('Current created_by column type:', columnInfo.type);
    
    // Modify created_by column to accept UUID strings (VARCHAR)
    if (columnInfo.type === 'integer') {
      console.log('Altering created_by column to VARCHAR(36)...');
      await db.schema.alterTable('data_sources', (table) => {
        table.string('created_by', 36).alter();
      });
      console.log('Column type altered successfully');
    } else {
      console.log('created_by column is already string type, no need to alter');
    }
    
    // Ensure organization_id is handled properly (it should remain an integer)
    const orgColumnInfo = await db('data_sources').columnInfo('organization_id');
    console.log('Organization ID column type:', orgColumnInfo.type);
    
    // Create proper indexes for faster lookups
    const indexes = await db.raw(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'data_sources'"
    );
    
    // Create an index on created_by if it doesn't exist
    const hasCreatedByIndex = indexes.rows.some(
      row => row.indexname === 'idx_data_sources_created_by'
    );
    
    if (!hasCreatedByIndex) {
      console.log('Creating index on created_by column...');
      await db.schema.table('data_sources', (table) => {
        table.index('created_by', 'idx_data_sources_created_by');
      });
      console.log('Index created successfully');
    }
    
    // Update any data sources with missing metadata.fileId
    const dataSources = await db('data_sources')
      .whereRaw("type = 'local-files' AND (metadata->>'fileId' IS NULL OR metadata->>'fileId' = '')")
      .select('id', 'metadata');
    
    if (dataSources.length > 0) {
      console.log(`Found ${dataSources.length} data sources with missing fileId metadata`);
      
      for (const ds of dataSources) {
        const metadata = ds.metadata || {};
        if (!metadata.fileId && metadata.filename) {
          // Extract fileId from filename if possible
          const filenameMatch = metadata.filename.match(/^([0-9a-f-]+)_/);
          if (filenameMatch && filenameMatch[1]) {
            metadata.fileId = filenameMatch[1];
            
            console.log(`Updating data source ${ds.id} with fileId: ${metadata.fileId}`);
            await db('data_sources')
              .where('id', ds.id)
              .update({ metadata });
          }
        }
      }
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.destroy();
  }
}

// Run the migration if executed directly
if (require.main === module) {
  fixDataSourcesTable()
    .then(() => {
      console.log('Script execution complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Unhandled error:', err);
      process.exit(1);
    });
}

module.exports = { fixDataSourcesTable }; 