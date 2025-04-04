import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if chat_sessions table exists
  const hasChatSessions = await knex.schema.hasTable('chat_sessions');
  
  if (hasChatSessions) {
    // Check if it has a user_id column
    const hasUserId = await knex.schema.hasColumn('chat_sessions', 'user_id');
    
    // Add user_id column if it doesn't exist
    if (!hasUserId) {
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.string('user_id').nullable();
        table.index('user_id');
      });
      console.log('Added user_id column to chat_sessions table');
    }
    
    // Check if it has is_active column
    const hasIsActive = await knex.schema.hasColumn('chat_sessions', 'is_active');
    
    // Add is_active column if it doesn't exist
    if (!hasIsActive) {
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.boolean('is_active').notNullable().defaultTo(true);
        table.index('is_active');
      });
      console.log('Added is_active column to chat_sessions table');
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Check if chat_sessions table exists
  const hasChatSessions = await knex.schema.hasTable('chat_sessions');
  
  if (hasChatSessions) {
    // Check if it has a user_id column
    const hasUserId = await knex.schema.hasColumn('chat_sessions', 'user_id');
    
    // Remove user_id column if it exists
    if (hasUserId) {
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.dropColumn('user_id');
      });
    }
    
    // Check if it has is_active column
    const hasIsActive = await knex.schema.hasColumn('chat_sessions', 'is_active');
    
    // Remove is_active column if it exists
    if (hasIsActive) {
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.dropColumn('is_active');
      });
    }
  }
} 