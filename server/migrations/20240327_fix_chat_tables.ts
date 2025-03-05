import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Starting fix for chat tables...');

  // Drop existing chat tables if they exist
  if (await knex.schema.hasTable('chat_messages')) {
    console.log('Dropping chat_messages table...');
    await knex.schema.dropTable('chat_messages');
  }
  
  if (await knex.schema.hasTable('chat_sessions')) {
    console.log('Dropping chat_sessions table...');
    await knex.schema.dropTable('chat_sessions');
  }

  // Create chat_sessions table with text type for user_id
  console.log('Creating chat_sessions table with text user_id...');
  await knex.schema.createTable('chat_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('user_id').notNullable();
    table.integer('organization_id').notNullable();
    table.uuid('dashboard_id').nullable();
    table.string('title').notNullable().defaultTo('New Chat');
    table.boolean('is_active').defaultTo(true);
    table.text('last_message').nullable();
    table.integer('message_count').defaultTo(0);
    table.timestamps(true, true);
  });

  // Create chat_messages table
  console.log('Creating chat_messages table...');
  await knex.schema.createTable('chat_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').notNullable();
    table.string('role').notNullable();
    table.text('content').notNullable();
    table.jsonb('metadata').nullable();
    table.timestamps(true, true);
    
    // Add foreign key to chat_sessions table
    table.foreign('session_id').references('id').inTable('chat_sessions').onDelete('CASCADE');
  });

  console.log('Chat tables fix completed successfully.');
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order to avoid foreign key constraints
  if (await knex.schema.hasTable('chat_messages')) {
    await knex.schema.dropTable('chat_messages');
  }
  
  if (await knex.schema.hasTable('chat_sessions')) {
    await knex.schema.dropTable('chat_sessions');
  }
} 