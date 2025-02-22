/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('data_sources', function(table) {
    table.increments('id').primary();
    table.integer('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').notNullable();
    table.string('status').notNullable().defaultTo('connected');
    table.text('description');
    table.timestamp('last_sync');
    table.jsonb('metadata').defaultTo('{}');
    table.jsonb('metrics').defaultTo('{}');
    table.jsonb('data').defaultTo('{}');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('data_sources');
}; 