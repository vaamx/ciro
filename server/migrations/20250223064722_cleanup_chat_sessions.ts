import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
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
export async function down(knex: Knex): Promise<void> {
  // Make dashboard_id nullable again
  await knex.schema.alterTable('chat_sessions', function(table) {
    table.uuid('dashboard_id').nullable().alter();
  });
}; 