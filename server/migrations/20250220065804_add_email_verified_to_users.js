/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if the email_verified column already exists
  const hasEmailVerifiedColumn = await knex.schema.hasColumn('users', 'email_verified');
  
  if (!hasEmailVerifiedColumn) {
    return knex.schema.alterTable('users', function(table) {
      table.boolean('email_verified').defaultTo(false).notNullable();
      console.log('Added email_verified column to users table');
    });
  } else {
    console.log('Column email_verified already exists in users table, skipping addition');
    return Promise.resolve();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Check if the email_verified column exists before trying to drop it
  const hasEmailVerifiedColumn = await knex.schema.hasColumn('users', 'email_verified');
  
  if (hasEmailVerifiedColumn) {
    return knex.schema.alterTable('users', function(table) {
      table.dropColumn('email_verified');
      console.log('Dropped email_verified column from users table');
    });
  } else {
    console.log('Column email_verified does not exist in users table, skipping removal');
    return Promise.resolve();
  }
}; 