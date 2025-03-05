/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('filename').notNullable();
    table.string('original_filename').notNullable();
    table.string('mime_type').notNullable();
    table.bigInteger('size').notNullable();
    table.string('file_type').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.binary('content');
    table.uuid('uploaded_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.integer('organization_id')
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
exports.down = function(knex) {
  return knex.schema.dropTable('files');
}; 