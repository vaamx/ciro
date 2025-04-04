import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  try {
    // First, check if the vector extension is available
    const hasVectorExtension = await checkVectorExtension(knex);
    
    if (hasVectorExtension) {
      console.log('Creating document_chunks table with vector support...');
      
      // Create the document_chunks table with vector support
      // We need to use raw queries for the vector type
      await knex.raw(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          embedding vector(1536) NOT NULL,
          data_source_id INTEGER NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create index on data_source_id for faster lookups
        CREATE INDEX IF NOT EXISTS idx_document_chunks_data_source_id ON document_chunks(data_source_id);
      `);
      
      console.log('Created document_chunks table with vector support');
      
      // Store vector support status in system_settings
      try {
        await knex.raw(`
          INSERT INTO system_settings (key, value)
          VALUES ('vector_support', '{"enabled": true, "version": "latest"}')
          ON CONFLICT (key) DO UPDATE
          SET value = '{"enabled": true, "version": "latest"}',
              updated_at = CURRENT_TIMESTAMP;
        `);
      } catch (settingsError) {
        console.warn('Could not update system_settings for vector support:', settingsError);
        // Continue even if this fails
      }
    } else {
      console.log('Vector extension not available, creating fallback table...');
      
      // Create the document_chunks table without vector support
      const document_chunksExists = await knex.schema.hasTable('document_chunks');
      if (!document_chunksExists) {
        await knex.schema.createTable('document_chunks', (table) => {
          table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
          table.text('content').notNullable();
          table.jsonb('metadata').notNullable().defaultTo('{}');
          // Store embedding as JSONB as a fallback
          table.jsonb('embedding').notNullable().defaultTo('[]');
          table.integer('data_source_id').notNullable()
            .references('id')
            .inTable('data_sources')
            .onDelete('CASCADE');
          table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
          
          // Create an index on data_source_id for faster lookups
          table.index('data_source_id', 'idx_document_chunks_data_source_id');
        });
        
        console.log('Created document_chunks table without vector support');
      } else {
        console.log('document_chunks table already exists, skipping creation');
      }
      
      // Store vector support status in system_settings
      try {
        await knex.raw(`
          INSERT INTO system_settings (key, value)
          VALUES ('vector_support', '{"enabled": false, "version": null}')
          ON CONFLICT (key) DO UPDATE
          SET value = '{"enabled": false, "version": null}',
              updated_at = CURRENT_TIMESTAMP;
        `);
      } catch (settingsError) {
        console.warn('Could not update system_settings for vector support:', settingsError);
        // Continue even if this fails
      }
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error creating document_chunks table:', error);
    return Promise.reject(error);
  }
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('document_chunks');
}

async function checkVectorExtension(knex: Knex): Promise<boolean> {
  try {
    // Check if pgvector extension is available by trying to create it
    await knex.raw('CREATE EXTENSION IF NOT EXISTS vector;');
    
    // Verify that it was created successfully
    const result = await knex.raw("SELECT extname FROM pg_extension WHERE extname = 'vector';");
    const hasExtension = result.rows.length > 0;
    
    if (hasExtension) {
      console.log('pgvector extension is available and enabled');
    } else {
      console.log('pgvector extension is not available');
    }
    
    return hasExtension;
  } catch (error) {
    console.error('Error checking for pgvector extension:', error);
    return false;
  }
} 