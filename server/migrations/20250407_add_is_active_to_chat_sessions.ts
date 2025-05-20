import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if chat_sessions table exists
  const hasChatSessions = await knex.schema.hasTable('chat_sessions');
  
  if (hasChatSessions) {
    // Check if is_active column exists
    const hasIsActive = await knex.schema.hasColumn('chat_sessions', 'is_active');
    
    if (!hasIsActive) {
      console.log('Adding is_active column to chat_sessions table...');
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.boolean('is_active').defaultTo(true);
      });
      console.log('Added is_active column to chat_sessions table');
    } else {
      console.log('is_active column already exists in chat_sessions table, skipping migration');
    }
  } else {
    console.log('chat_sessions table does not exist, skipping migration');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Check if chat_sessions table exists
  const hasChatSessions = await knex.schema.hasTable('chat_sessions');
  
  if (hasChatSessions) {
    // Check if is_active column exists
    const hasIsActive = await knex.schema.hasColumn('chat_sessions', 'is_active');
    
    if (hasIsActive) {
      console.log('Removing is_active column from chat_sessions table...');
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.dropColumn('is_active');
      });
      console.log('Removed is_active column from chat_sessions table');
    }
  }
} 