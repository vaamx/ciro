import { Knex } from 'knex';
export function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('files', (table) => {
    // First drop the foreign key constraint
    table.dropForeign('uploaded_by');
    
    // Then modify the column to be nullable and recreate the foreign key
    table.uuid('uploaded_by')
      .nullable()
      .alter();
    
    // Recreate the foreign key constraint
    table.foreign('uploaded_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('files', (table) => {
    // No rollback needed as we're just ensuring nullable which is likely the desired state
  });
}; 