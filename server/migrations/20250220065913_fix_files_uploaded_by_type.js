/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('files', function(table) {
    // No need to change anything since we want to keep UUIDs
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('files', function(table) {
    // No need to change anything since we want to keep UUIDs
  });
}; 