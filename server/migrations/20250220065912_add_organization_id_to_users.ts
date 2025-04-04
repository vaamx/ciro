import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  // Step 1: Add the organization_id column without constraints
  await knex.schema.alterTable('users', (table) => {
    table.integer('organization_id').nullable();
  });

  // Step 2: Add the foreign key constraint
  await knex.schema.alterTable('users', (table) => {
    table.foreign('organization_id', 'users_organization_id_foreign')
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
  });

  // Step 3: Add the index
  return knex.schema.alterTable('users', (table) => {
    table.index(['organization_id'], 'users_organization_id_index');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  // Step 1: Drop the index
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex([], 'users_organization_id_index');
  });

  // Step 2: Drop the foreign key constraint
  await knex.schema.alterTable('users', (table) => {
    table.dropForeign(['organization_id'], 'users_organization_id_foreign');
  });

  // Step 3: Drop the column
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('organization_id');
  });
}; 