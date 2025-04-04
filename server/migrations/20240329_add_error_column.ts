import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // First check if the error column already exists
  const hasErrorColumn = await knex.schema.hasColumn('files', 'error');
  
  // Only add the error column if it doesn't already exist
  if (!hasErrorColumn) {
    await knex.schema.alterTable('files', (table) => {
      table.text('error').nullable();
    });
    console.log('Added error column to files table');
  } else {
    console.log('Column error already exists in files table, skipping addition');
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasError = await knex.schema.hasColumn('files', 'error');
  
  if (hasError) {
    await knex.schema.alterTable('files', (table) => {
      table.dropColumn('error');
    });
    console.log('Dropped error column from files table');
  } else {
    console.log('Column error does not exist in files table, skipping removal');
  }
} 