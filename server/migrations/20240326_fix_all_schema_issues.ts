import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Starting comprehensive schema fix migration...');

  // 1. Check if users table exists before trying to create it
  const hasUsersTable = await knex.schema.hasTable('users');
  if (!hasUsersTable) {
    console.log('Creating users table...');
    await knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('email').unique().notNullable();
      table.string('password').nullable();
      table.string('name').nullable();
      table.string('role').defaultTo('user');
      table.string('verification_token').nullable();
      table.boolean('email_verified').defaultTo(false);
      table.timestamps(true, true);
    });
  } else {
    console.log('Users table already exists, skipping creation.');
  }

  // 2. Create missing sequences for metrics, dashboards, and dashboard_widgets
  const sequences = [
    { name: 'metrics_id_seq', start: 1 },
    { name: 'dashboards_id_seq', start: 1 },
    { name: 'dashboard_widgets_id_seq', start: 1 }
  ];

  for (const seq of sequences) {
    const hasSequence = await knex.raw(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.sequences 
        WHERE sequence_name = '${seq.name}'
      );
    `);
    
    if (!hasSequence.rows[0].exists) {
      console.log(`Creating ${seq.name}...`);
      await knex.raw(`CREATE SEQUENCE ${seq.name} START ${seq.start};`);
    } else {
      console.log(`Sequence ${seq.name} already exists, skipping creation.`);
    }
  }

  // 3. Add created_by column to data_sources table if it doesn't exist
  const hasDataSourcesTable = await knex.schema.hasTable('data_sources');
  if (hasDataSourcesTable) {
    const hasCreatedByColumn = await knex.schema.hasColumn('data_sources', 'created_by');
    
    if (!hasCreatedByColumn) {
      console.log('Adding created_by column to data_sources table...');
      await knex.schema.alterTable('data_sources', (table) => {
        table.uuid('created_by').nullable();
      });
    } else {
      console.log('created_by column already exists in data_sources table, skipping.');
    }
  } else {
    console.log('data_sources table does not exist, skipping column addition.');
  }

  // 4. Fix team column in dashboards table (change from UUID to text)
  const hasDashboardsTable = await knex.schema.hasTable('dashboards');
  if (hasDashboardsTable) {
    const hasTeamColumn = await knex.schema.hasColumn('dashboards', 'team');
    
    if (hasTeamColumn) {
      const teamColumnInfo = await knex.raw(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'dashboards' AND column_name = 'team';
      `);

      if (teamColumnInfo.rows.length > 0 && teamColumnInfo.rows[0].data_type === 'uuid') {
        console.log('Altering team column in dashboards table to be text type...');
        await knex.raw(`
          ALTER TABLE dashboards 
          ALTER COLUMN team TYPE text USING team::text;
        `);
      } else {
        console.log('team column in dashboards table is already text type, skipping.');
      }
    } else {
      console.log('team column does not exist in dashboards table, skipping.');
    }
  } else {
    console.log('dashboards table does not exist, skipping team column fix.');
  }

  console.log('Comprehensive schema fix migration completed successfully.');
}

export async function down(knex: Knex): Promise<void> {
  // This is a fix migration, so down migration is not really applicable
  console.log('No rollback needed for comprehensive schema fixes.');
} 