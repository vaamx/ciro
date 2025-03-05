import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  try {
    console.log('Starting migration to add missing tables...');
    
    // Create teams table if it doesn't exist
    if (!(await knex.schema.hasTable('teams'))) {
      console.log('Creating teams table...');
      await knex.schema.createTable('teams', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.integer('organization_id').notNullable()
          .references('id')
          .inTable('organizations')
          .onDelete('CASCADE');
        table.jsonb('settings').defaultTo('{}');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
      console.log('Teams table created successfully');
    } else {
      console.log('Teams table already exists, skipping');
    }
    
    // Create dashboards table if it doesn't exist
    if (!(await knex.schema.hasTable('dashboards'))) {
      console.log('Creating dashboards table...');
      await knex.schema.createTable('dashboards', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable();
        table.text('description');
        table.integer('organization_id').notNullable()
          .references('id')
          .inTable('organizations')
          .onDelete('CASCADE');
        table.jsonb('layout').defaultTo('{}');
        table.jsonb('settings').defaultTo('{}');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
      console.log('Dashboards table created successfully');
    } else {
      console.log('Dashboards table already exists, skipping');
    }
    
    // Create dashboard_widgets table if it doesn't exist
    if (!(await knex.schema.hasTable('dashboard_widgets'))) {
      console.log('Creating dashboard_widgets table...');
      await knex.schema.createTable('dashboard_widgets', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('dashboard_id').notNullable()
          .references('id')
          .inTable('dashboards')
          .onDelete('CASCADE');
        table.string('widget_type').notNullable();
        table.string('title').notNullable();
        table.jsonb('size').defaultTo('{"w":6,"h":4}');
        table.jsonb('position').defaultTo('{"x":0,"y":0}');
        table.jsonb('settings').defaultTo('{}');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        
        // Add index on dashboard_id for faster lookups
        table.index('dashboard_id');
      });
      console.log('dashboard_widgets table created successfully');
    } else {
      console.log('dashboard_widgets table already exists, skipping');
    }
    
    // Create automations table if it doesn't exist
    if (!(await knex.schema.hasTable('automations'))) {
      console.log('Creating automations table...');
      await knex.schema.createTable('automations', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.integer('organization_id').notNullable()
          .references('id')
          .inTable('organizations')
          .onDelete('CASCADE');
        table.string('trigger_type').notNullable();
        table.jsonb('trigger_config').defaultTo('{}');
        table.jsonb('actions').defaultTo('[]');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('last_run');
        table.jsonb('run_history').defaultTo('[]');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
      console.log('Automations table created successfully');
    } else {
      console.log('Automations table already exists, skipping');
    }
    
    console.log('Migration to add missing tables completed successfully');
  } catch (error) {
    console.error('Error creating missing tables:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of dependencies
  console.log('Reverting missing tables migration...');
  
  try {
    if (await knex.schema.hasTable('automations')) {
      await knex.schema.dropTable('automations');
      console.log('Automations table dropped');
    }
    
    if (await knex.schema.hasTable('dashboard_widgets')) {
      await knex.schema.dropTable('dashboard_widgets');
      console.log('Dashboard widgets table dropped');
    }
    
    if (await knex.schema.hasTable('dashboards')) {
      await knex.schema.dropTable('dashboards');
      console.log('Dashboards table dropped');
    }
    
    if (await knex.schema.hasTable('teams')) {
      await knex.schema.dropTable('teams');
      console.log('Teams table dropped');
    }
    
    console.log('Missing tables migration reverted successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  }
} 