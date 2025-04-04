import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Checking for metadata column in chat_sessions table...');
  
  // Check if the metadata column exists
  const hasMetadata = await knex.schema.hasColumn('chat_sessions', 'metadata');
  
  if (!hasMetadata) {
    console.log('Adding metadata column to chat_sessions table...');
    await knex.schema.alterTable('chat_sessions', (table) => {
      table.jsonb('metadata').nullable();
    });
    console.log('Successfully added metadata column to chat_sessions table');
  } else {
    console.log('metadata column already exists in chat_sessions table, skipping migration');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Check if the metadata column exists
  const hasMetadata = await knex.schema.hasColumn('chat_sessions', 'metadata');
  
  if (hasMetadata) {
    console.log('Removing metadata column from chat_sessions table...');
    await knex.schema.alterTable('chat_sessions', (table) => {
      table.dropColumn('metadata');
    });
  }
} 