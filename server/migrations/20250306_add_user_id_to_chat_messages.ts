import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping migration');
    return;
  }

  // Check if the user_id column already exists
  const columnExists = await knex.schema.hasColumn('chat_messages', 'user_id');
  if (columnExists) {
    console.log('user_id column already exists in chat_messages table, skipping migration');
    return;
  }

  console.log('Adding user_id column to chat_messages table');
  await knex.schema.table('chat_messages', (table) => {
    table.uuid('user_id').nullable();
  });

  // Create an index on the user_id column
  console.log('Adding index on user_id column');
  await knex.schema.table('chat_messages', (table) => {
    table.index('user_id', 'idx_chat_messages_user_id');
  });

  console.log('Migration completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping down migration');
    return;
  }

  // Check if the user_id column exists
  const columnExists = await knex.schema.hasColumn('chat_messages', 'user_id');
  if (!columnExists) {
    console.log('user_id column does not exist in chat_messages table, skipping down migration');
    return;
  }

  // Drop the index first if it exists
  try {
    await knex.schema.table('chat_messages', (table) => {
      table.dropIndex([], 'idx_chat_messages_user_id');
    });
    console.log('Dropped index idx_chat_messages_user_id');
  } catch (error) {
    console.log('Index might not exist, continuing...');
  }

  // Remove the user_id column
  console.log('Removing user_id column from chat_messages table');
  await knex.schema.table('chat_messages', (table) => {
    table.dropColumn('user_id');
  });

  console.log('Down migration completed successfully');
} 