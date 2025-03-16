/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if data_sources table exists
  const hasDataSourcesTable = await knex.schema.hasTable('data_sources');
  if (!hasDataSourcesTable) {
    // Create data_sources table
    await knex.schema.createTable('data_sources', function(table) {
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
    console.log('Created data_sources table');
  } else {
    console.log('Data_sources table already exists, skipping creation');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('data_sources');
}; 