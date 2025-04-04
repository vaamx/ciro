import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  // Delete any chat sessions that don't have a dashboard_id
  await knex('chat_sessions')
    .whereNull('dashboard_id')
    .delete();

  // Delete any chat sessions where dashboard_id doesn't match a valid UUID format
  await knex.raw(`
    DELETE FROM chat_sessions
    WHERE dashboard_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  `);

  // Make sure all existing dashboard_ids are valid UUIDs
  await knex.schema.alterTable('chat_sessions', function(table) {
    // First make it nullable temporarily to handle any invalid values
    table.uuid('new_dashboard_id').nullable();
  });

  // Update the new column with the existing valid UUIDs
  await knex.raw(`
    UPDATE chat_sessions
    SET new_dashboard_id = dashboard_id::uuid
    WHERE dashboard_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  `);

  // Drop the old column and rename the new one
  await knex.schema.alterTable('chat_sessions', function(table) {
    table.dropColumn('dashboard_id');
  });

  await knex.schema.alterTable('chat_sessions', function(table) {
    table.renameColumn('new_dashboard_id', 'dashboard_id');
  });

  // Make it not nullable
  await knex.schema.alterTable('chat_sessions', function(table) {
    table.uuid('dashboard_id').notNullable().alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  // No down migration needed as this is a cleanup migration
}; 