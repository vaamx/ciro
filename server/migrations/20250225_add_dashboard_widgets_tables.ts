import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  try {
    console.log('Starting dashboard tables migration...');
    
    // Create dashboard_widgets table
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
      console.log('dashboard_widgets table already exists');
    }
    
    // Create metrics table
    if (!(await knex.schema.hasTable('metrics'))) {
      console.log('Creating metrics table...');
      await knex.schema.createTable('metrics', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('dashboard_id').notNullable()
          .references('id')
          .inTable('dashboards')
          .onDelete('CASCADE');
        table.string('title').notNullable();
        table.string('type').notNullable().defaultTo('number');
        table.decimal('value', 20, 4).defaultTo(0);
        table.string('timeframe').defaultTo('daily');
        table.decimal('trend', 10, 2).defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        
        // Add index on dashboard_id for faster lookups
        table.index('dashboard_id');
      });
      console.log('metrics table created successfully');
    } else {
      console.log('metrics table already exists');
    }
    
    console.log('Dashboard tables migration completed successfully');
  } catch (error) {
    console.error('Error creating dashboard tables:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of dependencies
  console.log('Reverting dashboard tables migration...');
  
  try {
    if (await knex.schema.hasTable('metrics')) {
      await knex.schema.dropTable('metrics');
      console.log('metrics table dropped');
    }
    
    if (await knex.schema.hasTable('dashboard_widgets')) {
      await knex.schema.dropTable('dashboard_widgets');
      console.log('dashboard_widgets table dropped');
    }
    
    console.log('Dashboard tables migration reverted successfully');
  } catch (error) {
    console.error('Error dropping dashboard tables:', error);
    throw error;
  }
} 