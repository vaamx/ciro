import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('document_processing_jobs', (table) => {
    table.uuid('id').primary().notNullable();
    table.string('data_source_id').notNullable().index();
    table.string('file_path').notNullable();
    table.string('file_type').notNullable();
    table.string('file_name').notNullable();
    table.bigInteger('file_size').notNullable();
    table.string('current_state').notNullable().index();
    table.string('previous_state');
    table.jsonb('stage_statuses').notNullable().defaultTo('{}');
    table.integer('total_chunks').notNullable().defaultTo(0);
    table.integer('processed_chunks').notNullable().defaultTo(0);
    table.integer('attempts').notNullable().defaultTo(0);
    table.integer('max_attempts').notNullable().defaultTo(3);
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.jsonb('result');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.timestamp('failed_at');

    // Indexes
    table.index(['data_source_id', 'current_state']);
    table.index(['created_at']);
    table.index(['updated_at']);
  });

  // Create materialized view for job statistics
  await knex.raw(`
    CREATE MATERIALIZED VIEW document_processing_job_stats AS
    SELECT
      current_state,
      COUNT(*) as job_count,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_duration_ms,
      MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as max_duration_ms,
      MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as min_duration_ms,
      COUNT(CASE WHEN attempts > 1 THEN 1 END) as retry_count,
      MAX(attempts) as max_attempts_used,
      SUM(total_chunks) as total_chunks_processed,
      AVG(total_chunks) as avg_chunks_per_job
    FROM document_processing_jobs
    GROUP BY current_state;
  `);

  // Create function to refresh the materialized view
  await knex.raw(`
    CREATE OR REPLACE FUNCTION refresh_document_processing_job_stats()
    RETURNS TRIGGER AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW document_processing_job_stats;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create trigger to refresh the stats view periodically (not on every change to avoid performance issues)
  await knex.raw(`
    CREATE TRIGGER refresh_document_processing_job_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON document_processing_jobs
    FOR EACH STATEMENT
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION refresh_document_processing_job_stats();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop trigger and function
  await knex.raw(`DROP TRIGGER IF EXISTS refresh_document_processing_job_stats_trigger ON document_processing_jobs;`);
  await knex.raw(`DROP FUNCTION IF EXISTS refresh_document_processing_job_stats();`);
  
  // Drop materialized view
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS document_processing_job_stats;`);
  
  // Drop table
  await knex.schema.dropTableIfExists('document_processing_jobs');
} 