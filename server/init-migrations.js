/**
 * Initial migration script to create the basic tables
 */

exports.up = async function(knex) {
  console.log('Running essential tables creation migration...');
  
  // Enable core PostgreSQL extensions
  console.log('Enabling core PostgreSQL extensions...');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  console.log('Core PostgreSQL extensions enabled successfully');
  
  // Create users table
  console.log('Creating users table...');
  const userTableExists = await knex.schema.hasTable('users');
  if (!userTableExists) {
    await knex.schema.createTable('users', function(table) {
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
      table.string('role').defaultTo('user');
      table.string('verification_token');
      table.timestamp('email_verified_at');
      table.boolean('email_verified').defaultTo(false);
    });
    console.log('Created users table');
  } else {
    console.log('Users table already exists');
  }

  // Create organizations table
  console.log('Creating organizations table...');
  const orgsTableExists = await knex.schema.hasTable('organizations');
  if (!orgsTableExists) {
    await knex.schema.createTable('organizations', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.string('description');
      table.string('logo_url');
      table.uuid('owner_id').references('id').inTable('users');
      table.jsonb('settings').defaultTo('{}');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('Created organizations table');
  } else {
    console.log('Organizations table already exists');
  }

  // Create organization_members table
  console.log('Creating organization_members table...');
  const orgMembersTableExists = await knex.schema.hasTable('organization_members');
  if (!orgMembersTableExists) {
    await knex.schema.createTable('organization_members', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('role').notNullable().defaultTo('member');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'user_id']);
    });
    console.log('Created organization_members table');
  } else {
    console.log('Organization_members table already exists');
  }

  // Add organization_id to users
  console.log('Adding organization_id to users table...');
  const hasOrgIdColumn = await knex.schema.hasColumn('users', 'organization_id');
  if (!hasOrgIdColumn) {
    await knex.schema.table('users', function(table) {
      table.uuid('organization_id').references('id').inTable('organizations');
    });
    console.log('Added organization_id to users table');
  } else {
    console.log('users table already has organization_id column');
  }

  // Create data_sources table
  console.log('Creating data_sources table...');
  const dataSourcesTableExists = await knex.schema.hasTable('data_sources');
  if (!dataSourcesTableExists) {
    await knex.schema.createTable('data_sources', function(table) {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('description');
      table.string('type').notNullable();
      table.jsonb('config').defaultTo('{}');
      table.uuid('created_by').references('id').inTable('users');
      table.uuid('organization_id').references('id').inTable('organizations');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('collection_name');
    });
    console.log('Created data_sources table');
  } else {
    console.log('Data_sources table already exists');
  }

  // Create system_settings table
  console.log('Creating system_settings table...');
  const systemSettingsTableExists = await knex.schema.hasTable('system_settings');
  if (!systemSettingsTableExists) {
    await knex.schema.createTable('system_settings', function(table) {
      table.string('key').primary();
      table.jsonb('value').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('Created system_settings table');
  } else {
    console.log('System_settings table already exists');
  }

  // Set vector_support setting
  try {
    await knex('system_settings')
      .insert({
        key: 'vector_support',
        value: JSON.stringify({ enabled: true, provider: 'qdrant', exclusive: true })
      })
      .onConflict('key')
      .merge({
        value: JSON.stringify({ enabled: true, provider: 'qdrant', exclusive: true }),
        updated_at: knex.fn.now()
      });
    console.log('Updated system_settings with vector_support = true (qdrant exclusive)');
  } catch (settingsError) {
    console.warn('Could not update system_settings for vector support:', settingsError);
  }

  console.log('Essential tables created successfully');
  return Promise.resolve();
};

exports.down = function(knex) {
  // We would normally drop tables here, but this is a critical migration
  return Promise.resolve();
}; 