/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  try {
    // First, check if the widgets_pkey constraint exists and drop it if needed
    const constraintExists = await knex.raw(`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'widgets_pkey' 
      AND pg_get_constraintdef(oid) LIKE '%PRIMARY KEY%'
    `);
    
    if (constraintExists.rows && constraintExists.rows.length > 0) {
      console.log('widgets_pkey constraint exists, attempting to drop it');
      // Drop the constraint if it exists
      try {
        await knex.raw('ALTER TABLE IF EXISTS widgets DROP CONSTRAINT IF EXISTS widgets_pkey');
        console.log('Dropped widgets_pkey constraint');
      } catch (dropError) {
        console.log('Error dropping widgets_pkey constraint:', dropError.message);
        // Continue anyway, as the table might not exist
      }
    }

    // Check if widgets table exists
    const hasWidgetsTable = await knex.schema.hasTable('widgets');
    if (!hasWidgetsTable) {
      // Create widgets table
      await knex.schema.createTable('widgets', function(table) {
        // Use a different constraint name to avoid conflicts
        table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('dashboard_id').references('id').inTable('dashboards').onDelete('CASCADE');
        table.string('widget_type').notNullable();
        table.string('title').notNullable();
        table.string('size').notNullable();
        table.jsonb('settings').defaultTo('{}');
        table.integer('position').notNullable();
        table.timestamps(true, true);
        
        // Add primary key with a different name
        table.primary(['id'], 'widgets_pkey_new');
      });
      console.log('Created widgets table with new primary key constraint');
    } else {
      console.log('Widgets table already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error in widgets table migration:', error.message);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('widgets');
};
