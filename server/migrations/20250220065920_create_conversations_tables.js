/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Create conversations table
  await knex.schema.createTable('conversations', (table) => {
    table.increments('id').primary();
    table.string('title').notNullable();
    table.uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .notNullable();
    table.integer('organization_id')
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE')
      .notNullable();
    table.timestamps(true, true);
  });

  // Create conversation_participants table
  await knex.schema.createTable('conversation_participants', (table) => {
    table.increments('id').primary();
    table.integer('conversation_id')
      .references('id')
      .inTable('conversations')
      .onDelete('CASCADE')
      .notNullable();
    table.uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['conversation_id', 'user_id']);
  });

  // Create messages table
  await knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    table.integer('conversation_id')
      .references('id')
      .inTable('conversations')
      .onDelete('CASCADE')
      .notNullable();
    table.uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .notNullable();
    table.text('content').notNullable();
    table.string('role').defaultTo('user').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTable('messages');
  await knex.schema.dropTable('conversation_participants');
  await knex.schema.dropTable('conversations');
}; 