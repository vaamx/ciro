/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if each column already exists
  const hasEmailVerificationToken = await knex.schema.hasColumn('users', 'email_verification_token');
  const hasTokenExpiresAt = await knex.schema.hasColumn('users', 'email_verification_token_expires_at');
  const hasLastLogin = await knex.schema.hasColumn('users', 'last_login');
  
  return knex.schema.alterTable('users', function(table) {
    if (!hasEmailVerificationToken) {
      table.string('email_verification_token', 64);
      console.log('Added email_verification_token column to users table');
    } else {
      console.log('email_verification_token column already exists in users table, skipping');
    }
    
    if (!hasTokenExpiresAt) {
      table.timestamp('email_verification_token_expires_at');
      console.log('Added email_verification_token_expires_at column to users table');
    } else {
      console.log('email_verification_token_expires_at column already exists in users table, skipping');
    }
    
    if (!hasLastLogin) {
      table.timestamp('last_login');
      console.log('Added last_login column to users table');
    } else {
      console.log('last_login column already exists in users table, skipping');
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Check if each column exists before trying to drop it
  const hasEmailVerificationToken = await knex.schema.hasColumn('users', 'email_verification_token');
  const hasTokenExpiresAt = await knex.schema.hasColumn('users', 'email_verification_token_expires_at');
  const hasLastLogin = await knex.schema.hasColumn('users', 'last_login');
  
  return knex.schema.alterTable('users', function(table) {
    if (hasEmailVerificationToken) {
      table.dropColumn('email_verification_token');
      console.log('Dropped email_verification_token column from users table');
    }
    
    if (hasTokenExpiresAt) {
      table.dropColumn('email_verification_token_expires_at');
      console.log('Dropped email_verification_token_expires_at column from users table');
    }
    
    if (hasLastLogin) {
      table.dropColumn('last_login');
      console.log('Dropped last_login column from users table');
    }
  });
}; 