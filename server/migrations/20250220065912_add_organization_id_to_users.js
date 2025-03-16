/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  try {
    // Check if organization_id column exists
    const hasColumn = await knex.schema.hasColumn('users', 'organization_id');
    if (!hasColumn) {
      // Step 1: Add the organization_id column without constraints
      await knex.schema.alterTable('users', (table) => {
        table.integer('organization_id').nullable();
      });
      console.log('Added organization_id column to users table');

      // Step 2: Add the foreign key constraint
      await knex.schema.alterTable('users', (table) => {
        table.foreign('organization_id', 'users_organization_id_foreign')
          .references('id')
          .inTable('organizations')
          .onDelete('SET NULL');
      });
      console.log('Added foreign key constraint for organization_id');

      // Step 3: Add the index
      await knex.schema.alterTable('users', (table) => {
        table.index(['organization_id'], 'users_organization_id_index');
      });
      console.log('Added index for organization_id');
    } else {
      console.log('organization_id column already exists in users table, skipping');
    }
  } catch (error) {
    console.error('Error in add_organization_id_to_users migration:', error.message);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  try {
    // Check if organization_id column exists
    const hasColumn = await knex.schema.hasColumn('users', 'organization_id');
    if (hasColumn) {
      // Step 1: Drop the index
      await knex.schema.alterTable('users', (table) => {
        table.dropIndex([], 'users_organization_id_index');
      });

      // Step 2: Drop the foreign key constraint
      await knex.schema.alterTable('users', (table) => {
        table.dropForeign(['organization_id'], 'users_organization_id_foreign');
      });

      // Step 3: Drop the column
      await knex.schema.alterTable('users', (table) => {
        table.dropColumn('organization_id');
      });
      console.log('Removed organization_id column and related constraints');
    } else {
      console.log('organization_id column does not exist in users table, skipping');
    }
  } catch (error) {
    console.error('Error in add_organization_id_to_users down migration:', error.message);
    throw error;
  }
}; 