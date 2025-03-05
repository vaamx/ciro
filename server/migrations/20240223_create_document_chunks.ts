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
        table.index('data_source_id');
      });
      
      console.log('Created document_chunks table WITHOUT vector support (fallback mode)');
      
      // Store vector support status in system_settings
      try {
        await knex.raw(`
          INSERT INTO system_settings (key, value)
          VALUES ('vector_support', '{"enabled": false, "reason": "extension_not_found"}')
          ON CONFLICT (key) DO UPDATE
          SET value = '{"enabled": false, "reason": "extension_not_found"}',
              updated_at = CURRENT_TIMESTAMP;
        `);
      } catch (settingsError) {
        console.warn('Could not update system_settings for vector support:', settingsError);
        // Continue even if this fails
      }
    }
  } catch (error) {
    console.error('Error creating document_chunks table:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    await knex.schema.dropTableIfExists('document_chunks');
    console.log('Dropped document_chunks table');
  } catch (error) {
    console.error('Error dropping document_chunks table:', error);
    throw error;
  }
}

async function checkVectorExtension(knex: Knex): Promise<boolean> {
  try {
    console.log('Checking for vector extension...');
    const result = await knex.raw(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      );
    `);
    
    const hasExtension = result.rows[0].exists;
    console.log(`Vector extension ${hasExtension ? 'is' : 'is not'} available`);
    
    return hasExtension;
  } catch (error) {
    console.warn('Error checking for vector extension:', error);
    return false;
  }
} 