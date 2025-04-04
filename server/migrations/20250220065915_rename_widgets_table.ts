import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.renameTable('widgets', 'dashboard_widgets');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.renameTable('dashboard_widgets', 'widgets');
}; 