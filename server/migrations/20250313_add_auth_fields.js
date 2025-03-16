/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if last_login field already exists in users table
  const hasLastLogin = await knex.schema.hasColumn('users', 'last_login');
  
  if (!hasLastLogin) {
    // Only add last_login field if it doesn't already exist
    return knex.schema.alterTable('users', (table) => {
      table.timestamp('last_login').nullable();
    });
  } else {
    console.log('last_login column already exists in users table, skipping addition');
    return Promise.resolve();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Only drop the column if it exists
  const hasLastLogin = await knex.schema.hasColumn('users', 'last_login');
  
  if (hasLastLogin) {
    return knex.schema.alterTable('users', (table) => {
      table.dropColumn('last_login');
    });
  } else {
    return Promise.resolve();
  }
}; 