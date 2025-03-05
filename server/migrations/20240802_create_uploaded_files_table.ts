import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if uploaded_files table already exists
  const hasUploadedFiles = await knex.schema.hasTable('uploaded_files');
  
  if (!hasUploadedFiles) {
    await knex.schema.createTable('uploaded_files', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('filename').notNullable();
      table.string('original_filename').notNullable();
      table.string('mimetype').notNullable();
      table.integer('size').notNullable();
      table.string('path').notNullable();
      table.string('uploaded_by').nullable(); // User ID who uploaded the file
      table.integer('organization_id').nullable();
      table.boolean('is_temporary').notNullable().defaultTo(false);
      table.jsonb('metadata').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index('uploaded_by');
      table.index('organization_id');
      table.index('is_temporary');
    });
    
    console.log('Created uploaded_files table');
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('uploaded_files');
} 