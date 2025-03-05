/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  return knex.transaction(async (trx) => {
    // Drop existing tables if they exist
    await trx.schema.dropTableIfExists('chat_messages');
    await trx.schema.dropTableIfExists('chat_sessions');
    
    // Create chat_sessions table
    await trx.schema.createTable('chat_sessions', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.integer('organization_id')
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');
      table.string('dashboard_id');
      table.string('title').notNullable();
      table.text('last_message');
      table.integer('message_count').defaultTo(0);
      table.timestamps(true, true);
    });

    // Create indexes for chat_sessions
    await trx.raw('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)');
    await trx.raw('CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON chat_sessions(organization_id)');

    // Create chat_messages table
    await trx.schema.createTable('chat_messages', (table) => {
      table.increments('id').primary();
      table.integer('session_id').notNullable()
        .references('id')
        .inTable('chat_sessions')
        .onDelete('CASCADE');
      table.enum('message_type', ['user', 'assistant', 'system', 'error']).notNullable();
      table.text('content').notNullable();
      table.jsonb('metadata');
      table.timestamp('timestamp').defaultTo(trx.fn.now());
    });

    // Create index for chat_messages
    await trx.raw('CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  return knex.transaction(async (trx) => {
    await trx.schema.dropTableIfExists('chat_messages');
    await trx.schema.dropTableIfExists('chat_sessions');
  });
}; 