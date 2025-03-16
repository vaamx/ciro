/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  try {
    // Check if dashboard_widgets table already exists
    const hasDashboardWidgetsTable = await knex.schema.hasTable('dashboard_widgets');
    if (hasDashboardWidgetsTable) {
      console.log('dashboard_widgets table already exists, skipping rename');
      return;
    }

    // Check if widgets table exists
    const hasWidgetsTable = await knex.schema.hasTable('widgets');
    if (!hasWidgetsTable) {
      console.log('widgets table does not exist, skipping rename');
      return;
    }

    // Rename the table
    await knex.schema.renameTable('widgets', 'dashboard_widgets');
    console.log('Successfully renamed widgets table to dashboard_widgets');
  } catch (error) {
    console.error('Error in rename_widgets_table migration:', error.message);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  try {
    // Check if widgets table already exists
    const hasWidgetsTable = await knex.schema.hasTable('widgets');
    if (hasWidgetsTable) {
      console.log('widgets table already exists, skipping rename');
      return;
    }

    // Check if dashboard_widgets table exists
    const hasDashboardWidgetsTable = await knex.schema.hasTable('dashboard_widgets');
    if (!hasDashboardWidgetsTable) {
      console.log('dashboard_widgets table does not exist, skipping rename');
      return;
    }

    // Rename the table back
    await knex.schema.renameTable('dashboard_widgets', 'widgets');
    console.log('Successfully renamed dashboard_widgets table back to widgets');
  } catch (error) {
    console.error('Error in rename_widgets_table down migration:', error.message);
    throw error;
  }
}; 