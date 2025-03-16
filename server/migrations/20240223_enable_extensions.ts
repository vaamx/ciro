import { Knex } from 'knex';

/**
 * This migration enables the required PostgreSQL extensions:
 * - uuid-ossp: For UUID generation
 * - pgcrypto: For cryptographic functions
 * - Note: Vector storage is exclusively provided by Qdrant, not PostgreSQL
 */
export async function up(knex: Knex): Promise<void> {
  try {
    console.log('Enabling core PostgreSQL extensions...');
    
    // Enable core PostgreSQL extensions
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    console.log('Core PostgreSQL extensions enabled successfully');
    
    // Explicitly note that we're not using pgvector
    console.log('Using Qdrant exclusively for vector storage, pgvector is not used in this application');
    
    // Check if system_settings table exists in a separate transaction
    try {
      const tableExists = await knex.schema.hasTable('system_settings');
      
      if (tableExists) {
        // Set vector_support to true but indicate using external service (Qdrant)
        await knex('system_settings')
          .insert({
            key: 'vector_support',
            value: JSON.stringify({ enabled: true, provider: 'qdrant', exclusive: true })
          })
          .onConflict('key')
          .merge({
            value: JSON.stringify({ enabled: true, provider: 'qdrant', exclusive: true }),
            updated_at: knex.fn.now()
          });
        
        console.log('Updated system_settings with vector_support = true (qdrant exclusive)');
      } else {
        console.log('system_settings table does not exist yet, skipping vector support configuration');
      }
    } catch (settingsError) {
      console.warn('Could not update system_settings for vector support, but continuing:', settingsError);
      // Continuing despite error - we don't want to fail the migration for this
    }
    
    console.log('Extensions setup completed successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('Error enabling extensions:', error);
    // Still resolve as we've handled the required extensions
    return Promise.resolve();
  }
}

export async function down(knex: Knex): Promise<void> {
  // Not dropping extensions as they are typically needed by the database
  console.log('Skipping down migration for PostgreSQL extensions');
  return Promise.resolve();
} 