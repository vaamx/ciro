import { Knex } from 'knex';
import fs from 'fs';
import path from 'path';

export async function up(knex: Knex): Promise<void> {
  console.log('Running migration: 20250301_update_files_table');
  
  // Check if files table exists
  const hasFilesTable = await knex.schema.hasTable('files');
  if (!hasFilesTable) {
    console.log('Files table does not exist, creating it');
    await knex.schema.createTable('files', (table) => {
      table.increments('id').primary();
      table.string('filename', 255).notNullable();
      table.string('original_filename', 255).notNullable();
      table.string('mime_type', 100).notNullable();
      table.bigInteger('size').notNullable();
      table.string('file_type', 50);
      table.binary('content').nullable();
      table.jsonb('metadata').defaultTo('{}');
      table.integer('organization_id');
      table.string('uploaded_by', 36);
      table.timestamps(true, true);
    });
    console.log('Files table created successfully');
    return;
  }

  // Check for the required columns and add them if missing
  const columns = await knex('information_schema.columns')
    .select('column_name')
    .where('table_name', 'files');
  
  const columnNames = columns.map(c => c.column_name);
  console.log('Existing columns:', columnNames);

  const requiredColumns = [
    { name: 'filename', type: 'string', length: 255 },
    { name: 'original_filename', type: 'string', length: 255 },
    { name: 'mime_type', type: 'string', length: 100 },
    { name: 'file_type', type: 'string', length: 50 },
    { name: 'content', type: 'binary' },
    { name: 'metadata', type: 'jsonb' },
    { name: 'organization_id', type: 'integer' },
    { name: 'uploaded_by', type: 'string', length: 36 }
  ];

  // Add missing columns
  for (const column of requiredColumns) {
    if (!columnNames.includes(column.name)) {
      console.log(`Adding missing column: ${column.name}`);
      
      switch (column.type) {
        case 'string':
          await knex.schema.alterTable('files', table => {
            table.string(column.name, column.length);
          });
          break;
        case 'binary':
          await knex.schema.alterTable('files', table => {
            table.binary(column.name);
          });
          break;
        case 'jsonb':
          await knex.schema.alterTable('files', table => {
            table.jsonb(column.name).defaultTo('{}');
          });
          break;
        case 'integer':
          await knex.schema.alterTable('files', table => {
            table.integer(column.name);
          });
          break;
      }
      
      console.log(`Added column: ${column.name}`);
    }
  }

  // Check if uploads directory exists and is writable
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log(`Creating uploads directory: ${uploadsDir}`);
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Check write permissions
  try {
    const testFile = path.join(uploadsDir, `.test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`Uploads directory is writable: ${uploadsDir}`);
  } catch (error) {
    console.error(`WARNING: Uploads directory is not writable: ${uploadsDir}`);
    console.error(error);
  }

  console.log('Migration completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  // This is a non-destructive migration, so we don't need to do anything
  console.log('No down migration necessary for 20250301_update_files_table');
} 