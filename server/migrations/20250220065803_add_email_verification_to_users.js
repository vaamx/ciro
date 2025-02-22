/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.string('email_verification_token', 64);
    table.timestamp('email_verification_token_expires_at');
    table.timestamp('last_login');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('email_verification_token');
    table.dropColumn('email_verification_token_expires_at');
    table.dropColumn('last_login');
  });
}; 