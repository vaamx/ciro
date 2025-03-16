/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  try {
    // First, check if the metrics_pkey constraint exists and drop it if needed
    const constraintExists = await knex.raw(`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'metrics_pkey' 
      AND pg_get_constraintdef(oid) LIKE '%PRIMARY KEY%'
    `);
    
    if (constraintExists.rows && constraintExists.rows.length > 0) {
      console.log('metrics_pkey constraint exists, attempting to drop it');
      // Drop the constraint if it exists
      try {
        await knex.raw('ALTER TABLE IF EXISTS metrics DROP CONSTRAINT IF EXISTS metrics_pkey');
        console.log('Dropped metrics_pkey constraint');
      } catch (dropError) {
        console.log('Error dropping metrics_pkey constraint:', dropError.message);
        // Continue anyway, as the table might not exist
      }
    }

    // Check if metrics table exists
    const hasMetricsTable = await knex.schema.hasTable('metrics');
    if (!hasMetricsTable) {
      // Create metrics table
      await knex.schema.createTable('metrics', function(table) {
        // Use a different constraint name to avoid conflicts
        table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('dashboard_id').references('id').inTable('dashboards').onDelete('CASCADE');
        table.string('title').notNullable();
        table.string('value').notNullable();
        table.string('type').notNullable(); // 'currency', 'number', 'percentage', 'users'
        table.string('timeframe');
        table.jsonb('trend').defaultTo(null); // { value: number, isPositive: boolean }
        table.timestamps(true, true);
        
        // Add primary key with a different name
        table.primary(['id'], 'metrics_pkey_new');
      });
      console.log('Created metrics table with new primary key constraint');
    } else {
      console.log('Metrics table already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error in metrics table migration:', error.message);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('metrics');
};
