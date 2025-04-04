import { Knex } from 'knex';

/**
 * Migration to create workspaces tables
 */
export async function up(knex: Knex): Promise<void> {
  // Ensure the uuid-ossp extension is available first
  console.log('Creating uuid-ossp extension if it doesn\'t exist...');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  
  // Check if workspaces table already exists
  const workspacesExists = await knex.schema.hasTable('workspaces');
  if (!workspacesExists) {
    console.log('Creating workspaces table...');
    await knex.schema.createTable('workspaces', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('title').notNullable();
      table.text('description');
      table.uuid('user_id').notNullable();
      table.integer('organization_id');
      table.uuid('dashboard_id');
      table.jsonb('tags').defaultTo('[]');
      table.timestamps(true, true);
    });
    console.log('Workspaces table created successfully');
  }

  // Check if workspace_charts table already exists
  const workspaceChartsExists = await knex.schema.hasTable('workspace_charts');
  if (!workspaceChartsExists) {
    console.log('Creating workspace_charts table...');
    await knex.schema.createTable('workspace_charts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('title');
      table.string('chart_type').notNullable();
      table.string('data_source_id');
      table.jsonb('config').notNullable();
      table.jsonb('position').defaultTo('{}');
      table.timestamps(true, true);
    });
    console.log('Workspace_charts table created successfully');
  }
}

/**
 * Migration to drop workspaces tables
 */
export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order to avoid foreign key constraints
  if (await knex.schema.hasTable('workspace_charts')) {
    await knex.schema.dropTable('workspace_charts');
    console.log('Dropped workspace_charts table');
  }
  
  if (await knex.schema.hasTable('workspaces')) {
    await knex.schema.dropTable('workspaces');
    console.log('Dropped workspaces table');
  }
} 