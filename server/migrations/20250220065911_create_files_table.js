/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  try {
    // First, check if the files_pkey constraint exists and drop it if needed
    const constraintExists = await knex.raw(`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'files_pkey' 
      AND pg_get_constraintdef(oid) LIKE '%PRIMARY KEY%'
    `);
    
    if (constraintExists.rows && constraintExists.rows.length > 0) {
      console.log('files_pkey constraint exists, attempting to drop it');
      // Drop the constraint if it exists
      try {
        await knex.raw('ALTER TABLE IF EXISTS files DROP CONSTRAINT IF EXISTS files_pkey');
        console.log('Dropped files_pkey constraint');
      } catch (dropError) {
        console.log('Error dropping files_pkey constraint:', dropError.message);
        // Continue anyway, as the table might not exist
      }
    }

    // Check if files table exists
    const hasFilesTable = await knex.schema.hasTable('files');
    if (!hasFilesTable) {
      // Create files table
      await knex.schema.createTable('files', (table) => {
        table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
        table.string('filename').notNullable();
        table.string('original_filename').notNullable();
        table.string('mime_type').notNullable();
        table.bigInteger('size').notNullable();
        table.string('file_type').notNullable();
        table.jsonb('metadata').defaultTo('{}');
        table.binary('content');
        table.uuid('uploaded_by')
          .nullable()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL');
        table.integer('organization_id')
          .references('id')
          .inTable('organizations')
          .onDelete('CASCADE');
        table.timestamps(true, true);
        
        // Add primary key with a different name
        table.primary(['id'], 'files_pkey_new');
      });
      console.log('Created files table with new primary key constraint');
    } else {
      console.log('Files table already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error in files table migration:', error.message);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('files');
}; 