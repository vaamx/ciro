/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Create organizations table
  await knex.schema.createTable('organizations', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.text('description');
    table.string('logo_url');
    table.jsonb('settings').defaultTo('{}');
    table.timestamps(true, true);
  });

  // Create organization_members table
  await knex.schema.createTable('organization_members', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('role').defaultTo('member').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['organization_id', 'user_id']);
  });

  // Create teams table
  await knex.schema.createTable('teams', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable();
    table.string('name').notNullable();
    table.text('description');
    table.timestamps(true, true);
  });

  // Create team_members table
  await knex.schema.createTable('team_members', (table) => {
    table.increments('id').primary();
    table.integer('team_id').references('id').inTable('teams').onDelete('CASCADE').notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('role').defaultTo('member').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['team_id', 'user_id']);
  });

  // Create categories table
  await knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable();
    table.string('name').notNullable();
    table.text('description');
    table.string('color');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('team_members');
  await knex.schema.dropTableIfExists('teams');
  await knex.schema.dropTableIfExists('organization_members');
  await knex.schema.dropTableIfExists('organizations');
}; 