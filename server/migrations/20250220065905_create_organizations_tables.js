/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if organizations table exists
  const hasOrganizationsTable = await knex.schema.hasTable('organizations');
  if (!hasOrganizationsTable) {
    // Create organizations table
    await knex.schema.createTable('organizations', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.text('description');
      table.string('logo_url');
      table.jsonb('settings').defaultTo('{}');
      table.timestamps(true, true);
    });
    console.log('Created organizations table');
  } else {
    console.log('Organizations table already exists, skipping creation');
  }

  // Check if organization_members table exists
  const hasOrgMembersTable = await knex.schema.hasTable('organization_members');
  if (!hasOrgMembersTable) {
    // Create organization_members table
    await knex.schema.createTable('organization_members', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
      table.string('role').defaultTo('member').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['organization_id', 'user_id']);
    });
    console.log('Created organization_members table');
  } else {
    console.log('Organization_members table already exists, skipping creation');
  }

  // Check if teams table exists
  const hasTeamsTable = await knex.schema.hasTable('teams');
  if (!hasTeamsTable) {
    // Create teams table
    await knex.schema.createTable('teams', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable();
      table.string('name').notNullable();
      table.text('description');
      table.timestamps(true, true);
    });
    console.log('Created teams table');
  } else {
    console.log('Teams table already exists, skipping creation');
  }

  // Check if team_members table exists
  const hasTeamMembersTable = await knex.schema.hasTable('team_members');
  if (!hasTeamMembersTable) {
    // Create team_members table
    await knex.schema.createTable('team_members', (table) => {
      table.increments('id').primary();
      table.integer('team_id').references('id').inTable('teams').onDelete('CASCADE').notNullable();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
      table.string('role').defaultTo('member').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['team_id', 'user_id']);
    });
    console.log('Created team_members table');
  } else {
    console.log('Team_members table already exists, skipping creation');
  }

  // Check if categories table exists
  const hasCategoriesTable = await knex.schema.hasTable('categories');
  if (!hasCategoriesTable) {
    // Create categories table
    await knex.schema.createTable('categories', (table) => {
      table.increments('id').primary();
      table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable();
      table.string('name').notNullable();
      table.text('description');
      table.string('color');
      table.timestamps(true, true);
    });
    console.log('Created categories table');
  } else {
    console.log('Categories table already exists, skipping creation');
  }
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