import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Check the current type of created_by column
  const columnInfo = await knex.raw(`
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'data_sources' AND column_name = 'created_by';
  `);

  const currentType = columnInfo.rows.length > 0 ? columnInfo.rows[0].data_type : null;
  
  if (currentType === 'uuid') {
    console.log('Altering created_by column in data_sources table from UUID to INTEGER...');
    
    // First, drop any constraints or indexes that might reference the column
    const constraints = await knex.raw(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'data_sources'::regclass AND conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'data_sources'::regclass AND attname = 'created_by')
      ];
    `);
    
    for (const constraint of constraints.rows) {
      await knex.raw(`ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS ${constraint.conname};`);
    }
    
    // Drop indexes on the column
    const indexes = await knex.raw(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'data_sources' AND indexdef LIKE '%created_by%';
    `);
    
    for (const index of indexes.rows) {
      await knex.raw(`DROP INDEX IF EXISTS ${index.indexname};`);
    }
    
    // First, ensure the column is nullable
    await knex.raw(`
      ALTER TABLE data_sources 
      ALTER COLUMN created_by DROP NOT NULL;
    `);
    
    // Alter the column type, using COALESCE to handle NULL values
    await knex.raw(`
      ALTER TABLE data_sources 
      ALTER COLUMN created_by TYPE INTEGER USING COALESCE((created_by::text)::integer, 1);
    `);
    
    console.log('created_by column type changed to INTEGER');
  } else {
    console.log('created_by column is not of type UUID, no change needed');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Rollback logic - change back to UUID if needed
  console.log('No rollback implemented for this migration');
} 