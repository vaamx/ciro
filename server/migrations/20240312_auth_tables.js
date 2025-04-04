exports.up = async function(knex) {
  // Check if users table exists
  const usersTableExists = await knex.schema.hasTable('users');
  const systemSettingsTableExists = await knex.schema.hasTable('system_settings');
  
  // Create a transaction to ensure all operations succeed or fail together
  return knex.transaction(async (trx) => {
    // Only create users table if it doesn't exist
    if (!usersTableExists) {
      await trx.schema.createTable('users', function(table) {
        table.increments('id').primary();
        table.string('email').notNullable().unique();
        table.string('password_hash').notNullable();
        table.string('name');
        table.timestamps(true, true);
      });
      console.log('Created users table');
    } else {
      console.log('Users table already exists, skipping creation');
    }
    
    // Only create system_settings table if it doesn't exist
    if (!systemSettingsTableExists) {
      await trx.schema.createTable('system_settings', function(table) {
        table.string('id').primary();
        table.jsonb('value').notNullable();
        table.timestamps(true, true);
      });
      console.log('Created system_settings table');
    } else {
      console.log('System_settings table already exists, skipping creation');
    }
  });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('users')
    .dropTableIfExists('system_settings');
};
