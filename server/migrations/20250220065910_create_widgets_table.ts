import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('widgets', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('dashboard_id').references('id').inTable('dashboards').onDelete('CASCADE');
    table.string('widget_type').notNullable();
    table.string('title').notNullable();
    table.string('size').notNullable();
    table.jsonb('settings').defaultTo('{}');
    table.integer('position').notNullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('widgets');
};
