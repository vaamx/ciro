import path from 'path';
import Knex from 'knex';
import { config } from '../../config';

/**
 * Run knex migrations to ensure database schema is up to date
 */
export async function runMigrations(): Promise<void> {
  console.log('Attempting to run database migrations...');
  
  const knexConfig = {
    client: 'pg',
    connection: {
      host: config.database.host || process.env.DB_HOST || 'localhost',
      port: Number(config.database.port || process.env.DB_PORT || 5432),
      user: config.database.user || process.env.DB_USER || '***REMOVED***',
      password: config.database.password || process.env.DB_PASSWORD || '***REMOVED***',
      database: config.database.database || process.env.DB_NAME || 'ciro_db',
    },
    migrations: {
      directory: path.join(__dirname, '../../../migrations'),
      loadExtensions: ['.js', '.ts'],
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    debug: false,
  };

  const knex = Knex(knexConfig);

  try {
    // Check if migration table exists
    const hasTable = await knex.schema.hasTable('knex_migrations');
    if (!hasTable) {
      console.log('Migration table does not exist, creating it...');
    }

    // Run pending migrations
    console.log('Running migrations from:', knexConfig.migrations.directory);
    const [completed, failed] = await knex.migrate.latest();
    
    if (!completed || completed.length === 0) {
      console.log('No new migrations to run. Database schema is up-to-date.');
    } else {
      console.log(`Successfully ran ${Array.isArray(completed) ? completed.length : 'undefined'} migrations:`);
      if (Array.isArray(completed)) {
        completed.forEach((migration: string) => console.log(`- ${migration}`));
      }
    }
    
    if (failed && failed.length > 0) {
      console.error('Some migrations failed:', failed);
    }

    // Get current migration status
    const version = await knex.migrate.currentVersion();
    console.log(`Current database version: ${version}`);
    
    return;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

// Allow running from command line
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
} 