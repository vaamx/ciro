import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Adding primary key constraint to dashboards table...');

  // First check if a primary key already exists
  const constraints = await knex.raw(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'dashboards'
    AND constraint_type = 'PRIMARY KEY';
  `);

  if (constraints.rows.length === 0) {
    // No primary key exists, add it
    console.log('No primary key found on dashboards table. Adding primary key constraint...');
    await knex.raw(`
      ALTER TABLE dashboards
      ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);
    `);
    console.log('Primary key constraint added to dashboards table');
  } else {
    console.log('Primary key already exists on dashboards table: ' + constraints.rows[0].constraint_name);
  }
}

export async function down(knex: Knex): Promise<void> {
  // We don't want to remove the primary key constraint as it would cause issues
  console.log('Skipping removal of primary key constraint from dashboards table');
} 