import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', function(table) {
    table.string('role').defaultTo('user').notNullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('role');
  });
}; 