import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('files', function(table) {
    // No need to change anything since we want to keep UUIDs
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('files', function(table) {
    // No need to change anything since we want to keep UUIDs
  });
}; 