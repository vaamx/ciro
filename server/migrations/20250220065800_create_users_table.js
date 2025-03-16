/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if users table already exists
  const exists = await knex.schema.hasTable('users');
  
  if (!exists) {
    return knex.schema.createTable('users', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('first_name');
      table.string('last_name');
      table.string('avatar_url');
      table.jsonb('settings').defaultTo('{}');
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_verified').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  } else {
    console.log('Users table already exists, skipping creation');
    return Promise.resolve();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
}; 