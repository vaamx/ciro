import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if data column exists in data_sources table
  const hasDataColumn = await knex.schema.hasColumn('data_sources', 'data');
  
  if (!hasDataColumn) {
    console.log('Adding data column to data_sources table...');
    await knex.schema.alterTable('data_sources', (table) => {
      table.jsonb('data').defaultTo('{}');
    });
    console.log('Data column added successfully');
  } else {
    console.log('Data column already exists in data_sources table');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Rollback logic - remove the column if needed
  const hasDataColumn = await knex.schema.hasColumn('data_sources', 'data');
  
  if (hasDataColumn) {
    console.log('Removing data column from data_sources table...');
    await knex.schema.alterTable('data_sources', (table) => {
      table.dropColumn('data');
    });
    console.log('Data column removed successfully');
  }
} 