import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping migration');
    return;
  }

  // Check if both columns exist already
  const roleColumnExists = await knex.schema.hasColumn('chat_messages', 'role');
  const messageTypeColumnExists = await knex.schema.hasColumn('chat_messages', 'message_type');

  // Add role column if it doesn't exist
  if (!roleColumnExists) {
    console.log('Adding role column to chat_messages table');
    await knex.schema.table('chat_messages', (table) => {
      table.string('role').notNullable().defaultTo('user');
    });
    console.log('Added role column successfully');
  }

  // Add message_type column if it doesn't exist
  if (!messageTypeColumnExists) {
    console.log('Adding message_type column to chat_messages table');
    await knex.schema.table('chat_messages', (table) => {
      table.string('message_type').notNullable().defaultTo('text');
    });
    console.log('Added message_type column successfully');
  }

  console.log('Migration completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping down migration');
    return;
  }

  // Check if the columns exist
  const roleColumnExists = await knex.schema.hasColumn('chat_messages', 'role');
  const messageTypeColumnExists = await knex.schema.hasColumn('chat_messages', 'message_type');

  // Remove message_type column if it exists
  if (messageTypeColumnExists) {
    console.log('Removing message_type column from chat_messages table');
    await knex.schema.table('chat_messages', (table) => {
      table.dropColumn('message_type');
    });
  }

  // Remove role column if it exists
  if (roleColumnExists) {
    console.log('Removing role column from chat_messages table');
    await knex.schema.table('chat_messages', (table) => {
      table.dropColumn('role');
    });
  }

  console.log('Down migration completed successfully');
} 