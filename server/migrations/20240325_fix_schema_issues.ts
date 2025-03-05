import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check if metrics_id_seq exists, create if it doesn't
  const hasMetricsSeq = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.sequences 
      WHERE sequence_name = 'metrics_id_seq'
    );
  `);
  
  if (!hasMetricsSeq.rows[0].exists) {
    console.log('Creating metrics_id_seq...');
    await knex.raw('CREATE SEQUENCE metrics_id_seq START 1;');
  }

  // Check if dashboards_id_seq exists, create if it doesn't
  const hasDashboardsSeq = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.sequences 
      WHERE sequence_name = 'dashboards_id_seq'
    );
  `);
  
  if (!hasDashboardsSeq.rows[0].exists) {
    console.log('Creating dashboards_id_seq...');
    await knex.raw('CREATE SEQUENCE dashboards_id_seq START 1;');
  }

  // Check if dashboard_widgets_id_seq exists, create if it doesn't
  const hasWidgetsSeq = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.sequences 
      WHERE sequence_name = 'dashboard_widgets_id_seq'
    );
  `);
  
  if (!hasWidgetsSeq.rows[0].exists) {
    console.log('Creating dashboard_widgets_id_seq...');
    await knex.raw('CREATE SEQUENCE dashboard_widgets_id_seq START 1;');
  }

  // Check if data_sources table has created_by column
  const hasCreatedByColumn = await knex.schema.hasColumn('data_sources', 'created_by');
  
  if (!hasCreatedByColumn) {
    console.log('Adding created_by column to data_sources table...');
    await knex.schema.alterTable('data_sources', (table) => {
      table.uuid('created_by').nullable();
    });
  }

  // Check if team column in dashboards table is UUID type
  const teamColumnInfo = await knex.raw(`
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'dashboards' AND column_name = 'team';
  `);

  // If team column exists and is not UUID, alter it
  if (teamColumnInfo.rows.length > 0 && teamColumnInfo.rows[0].data_type !== 'uuid') {
    console.log('Altering team column in dashboards table to be text type...');
    await knex.schema.alterTable('dashboards', (table) => {
      table.text('team').alter();
    });
  }

  console.log('Schema fixes completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  // This is a fix migration, so down migration is not really applicable
  // But we can provide some rollback logic if needed
  console.log('No rollback needed for schema fixes');
} 