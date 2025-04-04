import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('metrics', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('dashboard_id').references('id').inTable('dashboards').onDelete('CASCADE');
    table.string('title').notNullable();
    table.string('value').notNullable();
    table.string('type').notNullable(); // 'currency', 'number', 'percentage', 'users'
    table.string('timeframe');
    table.jsonb('trend').defaultTo(null); // { value: number, isPositive: boolean }
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('metrics');
};
