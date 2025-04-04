import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('dashboards', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');
    table.string('team');
    table.string('category');
    table.uuid('created_by').notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.integer('organization_id').notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('dashboards');
};
