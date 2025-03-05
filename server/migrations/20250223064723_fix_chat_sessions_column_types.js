/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check and drop foreign key constraints if they exist
  const constraints = await knex.raw(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'chat_messages'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'chat_messages_session_id_foreign'
  `);

  if (constraints.rows.length > 0) {
    await knex.schema.alterTable('chat_messages', function(table) {
      table.dropForeign(['session_id']);
    });
  }

  // Drop existing indexes
  await knex.raw('DROP INDEX IF EXISTS idx_chat_sessions_org_dash_user');
  await knex.raw('DROP INDEX IF EXISTS idx_chat_sessions_org_id');
  await knex.raw('DROP INDEX IF EXISTS idx_chat_sessions_user_id');

  // Drop the sequence if it exists
  await knex.raw('DROP SEQUENCE IF EXISTS chat_sessions_id_seq CASCADE');

  // Recreate the table with correct column types
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');

  // Create chat_sessions table with correct types
  await knex.schema.createTable('chat_sessions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('dashboard_id').notNullable();
    table.string('title').notNullable();
    table.text('last_message');
    table.integer('message_count').defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Add indexes
    table.index(['organization_id', 'dashboard_id', 'user_id'], 'idx_chat_sessions_org_dash_user');
    table.index(['organization_id'], 'idx_chat_sessions_org_id');
    table.index(['user_id'], 'idx_chat_sessions_user_id');
  });

  // Create chat_messages table
  await knex.schema.createTable('chat_messages', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('message_type').notNullable();
    table.text('content').notNullable();
    table.jsonb('metadata');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Add index
    table.index('session_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');
}; 