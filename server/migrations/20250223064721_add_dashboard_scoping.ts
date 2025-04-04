import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  // Check if chat_sessions table exists
  const hasSessionsTable = await knex.schema.hasTable('chat_sessions');
  if (!hasSessionsTable) {
    // Create chat_sessions table
    await knex.schema.createTable('chat_sessions', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('organization_id').notNullable();
      table.uuid('dashboard_id').notNullable();
      table.string('title').notNullable();
      table.text('last_message');
      table.integer('message_count').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Check if chat_messages table exists
  const hasMessagesTable = await knex.schema.hasTable('chat_messages');
  if (!hasMessagesTable) {
    // Create chat_messages table
    await knex.schema.createTable('chat_messages', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('session_id').references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.string('message_type').notNullable();
      table.text('content').notNullable();
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Add composite index for chat_sessions if it doesn't exist
  const indexExists = await knex.raw(`
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_chat_sessions_org_dash_user'
  `);

  if (!indexExists.rows.length) {
    await knex.schema.alterTable('chat_sessions', function(table) {
      table.index(['organization_id', 'dashboard_id', 'user_id'], 'idx_chat_sessions_org_dash_user');
    });
  }

  // Add session_id index to chat_messages if it doesn't exist
  const messageIndexExists = await knex.raw(`
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'chat_messages_session_id_index'
  `);

  if (!messageIndexExists.rows.length && hasMessagesTable) {
    await knex.schema.alterTable('chat_messages', function(table) {
      table.index('session_id');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  // Remove indexes if they exist
  const indexExists = await knex.raw(`
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_chat_sessions_org_dash_user'
  `);

  if (indexExists.rows.length) {
    await knex.schema.alterTable('chat_sessions', function(table) {
      table.dropIndex([], 'idx_chat_sessions_org_dash_user');
    });
  }

  const messageIndexExists = await knex.raw(`
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'chat_messages_session_id_index'
  `);

  if (messageIndexExists.rows.length) {
    await knex.schema.alterTable('chat_messages', function(table) {
      table.dropIndex([], 'chat_messages_session_id_index');
    });
  }

  // Drop tables if they exist
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');
}; 