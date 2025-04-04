/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Delete any chat sessions that don't have a dashboard_id
  await knex('chat_sessions')
    .whereNull('dashboard_id')
    .delete();

  // Make dashboard_id not nullable if it isn't already
  await knex.schema.alterTable('chat_sessions', function(table) {
    table.uuid('dashboard_id').notNullable().alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Make dashboard_id nullable again
  await knex.schema.alterTable('chat_sessions', function(table) {
    table.uuid('dashboard_id').nullable().alter();
  });
}; 