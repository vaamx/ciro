/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if dashboards table exists
  const hasDashboardsTable = await knex.schema.hasTable('dashboards');
  if (!hasDashboardsTable) {
    // Create dashboards table
    await knex.schema.createTable('dashboards', function(table) {
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
    console.log('Created dashboards table');
  } else {
    console.log('Dashboards table already exists, skipping creation');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('dashboards');
};
