import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
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
export function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('email_verification_token');
    table.dropColumn('email_verification_token_expires_at');
    table.dropColumn('last_login');
  });
}; 