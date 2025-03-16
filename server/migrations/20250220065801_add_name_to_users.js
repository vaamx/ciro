/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if the name column already exists in the users table
  const hasNameColumn = await knex.schema.hasColumn('users', 'name');
  
  if (!hasNameColumn) {
    return knex.schema.alterTable('users', function(table) {
      table.string('name').after('email');
    });
  } else {
    console.log('Column name already exists in users table, skipping addition');
    return Promise.resolve();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Check if the name column exists before trying to drop it
  const hasNameColumn = await knex.schema.hasColumn('users', 'name');
  
  if (hasNameColumn) {
    return knex.schema.alterTable('users', function(table) {
      table.dropColumn('name');
    });
  } else {
    console.log('Column name does not exist in users table, skipping removal');
    return Promise.resolve();
  }
}; 