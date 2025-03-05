import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if the table already exists
  const tableExists = await knex.schema.hasTable('file_to_data_source');
  
  if (!tableExists) {
    await knex.schema.createTable('file_to_data_source', (table) => {
      table.uuid('file_id').notNullable().comment('UUID of the file');
      table.string('data_source_id').notNullable().comment('ID of the data source');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Create a composite primary key
      table.primary(['file_id', 'data_source_id']);
      
      // Add indices for faster lookups
      table.index('file_id');
      table.index('data_source_id');
    });
    
    console.log('Created file_to_data_source table');
  } else {
    console.log('file_to_data_source table already exists');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop the table if it exists
  if (await knex.schema.hasTable('file_to_data_source')) {
    await knex.schema.dropTable('file_to_data_source');
    console.log('Dropped file_to_data_source table');
  }
} 