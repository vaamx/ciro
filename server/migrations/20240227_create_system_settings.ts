import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  try {
    console.log('Creating system_settings table...');
    
    // Check if the table exists before creating it
    const tableExists = await knex.schema.hasTable('system_settings');
    
    if (!tableExists) {
      await knex.schema.createTable('system_settings', (table) => {
        table.string('key').primary();
        table.jsonb('value').notNullable().defaultTo('{}');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      });
      
      console.log('Created system_settings table');
    } else {
      console.log('system_settings table already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error creating system_settings table:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    await knex.schema.dropTableIfExists('system_settings');
    console.log('Dropped system_settings table');
  } catch (error) {
    console.error('Error dropping system_settings table:', error);
    throw error;
  }
} 