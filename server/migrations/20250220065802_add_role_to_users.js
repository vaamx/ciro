/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if the role column already exists in the users table
  const hasRoleColumn = await knex.schema.hasColumn('users', 'role');
  
  if (!hasRoleColumn) {
    return knex.schema.alterTable('users', function(table) {
      table.string('role').defaultTo('user').notNullable();
    });
  } else {
    console.log('Column role already exists in users table, skipping addition');
    return Promise.resolve();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Check if the role column exists before trying to drop it
  const hasRoleColumn = await knex.schema.hasColumn('users', 'role');
  
  if (hasRoleColumn) {
    return knex.schema.alterTable('users', function(table) {
      table.dropColumn('role');
    });
  } else {
    console.log('Column role does not exist in users table, skipping removal');
    return Promise.resolve();
  }
}; 