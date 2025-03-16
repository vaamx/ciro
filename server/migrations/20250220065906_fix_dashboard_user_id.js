/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if the dashboards table exists
  const hasDashboardsTable = await knex.schema.hasTable('dashboards');
  if (!hasDashboardsTable) {
    console.log('Dashboards table does not exist, skipping modification');
    return;
  }

  // Check if created_by column exists
  const dashboardsColumns = await knex.table('dashboards').columnInfo();
  const hasCreatedByColumn = dashboardsColumns.hasOwnProperty('created_by');

  if (hasCreatedByColumn) {
    // Get the column type
    const columnType = dashboardsColumns.created_by.type;
    console.log(`Found existing created_by column of type: ${columnType}`);

    // Only proceed if it's not already UUID type
    if (columnType.toLowerCase() !== 'uuid') {
      try {
        // Get the first user ID to use as a default value
        const firstUser = await knex('users').select('id').first();
        let defaultUserId = null;
        
        if (firstUser && firstUser.id) {
          defaultUserId = firstUser.id;
          console.log(`Using user ID ${defaultUserId} as default value for created_by column`);
        } else {
          console.log('No users found to use as default value for created_by column');
        }

        // First, drop the old column
        await knex.schema.alterTable('dashboards', function(table) {
          table.dropColumn('created_by');
        });
        
        // Add the new column with NULL constraint initially
        await knex.schema.alterTable('dashboards', function(table) {
          table.uuid('created_by').references('id').inTable('users').onDelete('CASCADE').nullable();
        });

        // Set the default user ID if available
        if (defaultUserId) {
          await knex('dashboards').update({ created_by: defaultUserId });
          console.log('Updated dashboards with default user ID');
        }

        // Set NOT NULL constraint if required
        if (defaultUserId) {
          await knex.schema.alterTable('dashboards', function(table) {
            table.uuid('created_by').notNullable().alter();
          });
          console.log('Added NOT NULL constraint to created_by column');
        }
      } catch (error) {
        console.error('Error during dashboard created_by column migration:', error);
        throw error;
      }
    } else {
      console.log('created_by column is already UUID type, skipping modification');
    }
  } else {
    // If column doesn't exist, add it but allow NULL values
    await knex.schema.alterTable('dashboards', function(table) {
      table.uuid('created_by').references('id').inTable('users').onDelete('CASCADE').nullable();
    });
    console.log('Added created_by column with NULL constraint');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasDashboardsTable = await knex.schema.hasTable('dashboards');
  if (!hasDashboardsTable) {
    return;
  }

  const dashboardsColumns = await knex.table('dashboards').columnInfo();
  if (dashboardsColumns.hasOwnProperty('created_by')) {
    await knex.schema.alterTable('dashboards', function(table) {
      // Drop the UUID column
      table.dropColumn('created_by');
    });
    
    await knex.schema.alterTable('dashboards', function(table) {
      // Add back the integer column
      table.integer('created_by').nullable();
    });
  }
}; 