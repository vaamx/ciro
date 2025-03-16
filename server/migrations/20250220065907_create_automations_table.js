/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if automations table exists
  const hasAutomationsTable = await knex.schema.hasTable('automations');
  if (!hasAutomationsTable) {
    // Create automations table
    await knex.schema.createTable('automations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.text('description');
      table.integer('organization_id').notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');
      table.jsonb('config').defaultTo('{}');
      table.timestamps(true, true);
    });
    console.log('Created automations table');
  } else {
    console.log('Automations table already exists, skipping creation');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('automations');
}; 