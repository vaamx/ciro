import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping migration');
    return;
  }

  // Check if the updated_at column already exists
  const columnExists = await knex.schema.hasColumn('chat_messages', 'updated_at');
  if (columnExists) {
    console.log('updated_at column already exists in chat_messages table, skipping migration');
    return;
  }

  // Add the updated_at column with default value of CURRENT_TIMESTAMP
  console.log('Adding updated_at column to chat_messages table');
  return knex.schema.table('chat_messages', (table) => {
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping down migration');
    return;
  }

  // Check if the updated_at column exists
  const columnExists = await knex.schema.hasColumn('chat_messages', 'updated_at');
  if (!columnExists) {
    console.log('updated_at column does not exist in chat_messages table, skipping down migration');
    return;
  }

  // Remove the updated_at column
  console.log('Removing updated_at column from chat_messages table');
  return knex.schema.table('chat_messages', (table) => {
    table.dropColumn('updated_at');
  });
}

