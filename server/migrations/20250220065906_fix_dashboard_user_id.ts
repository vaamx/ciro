import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dashboards', function(table) {
    // Drop the old column
    table.dropColumn('created_by');
  });
  
  await knex.schema.alterTable('dashboards', function(table) {
    // Add the new UUID column
    table.uuid('created_by').references('id').inTable('users').onDelete('CASCADE').notNullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dashboards', function(table) {
    // Drop the UUID column
    table.dropColumn('created_by');
  });
  
  await knex.schema.alterTable('dashboards', function(table) {
    // Add back the integer column
    table.integer('created_by').notNullable();
  });
}; 