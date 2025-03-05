import knex from 'knex';
// Import using CommonJS require syntax
const configurations = require('./knexfile');

// Get the development configuration
const config = configurations.development;

// Override with Docker container connection details
const db = knex({
  ...config,
  connection: {
    host: 'localhost',
    port: 5433,
    database: 'ciro_db',
    user: '***REMOVED***',
    password: '***REMOVED***'
  }
});

async function runMigrations() {
  try {
    console.log('Running migrations...');
    console.log('Using connection:', db.client.config.connection);
    await db.migrate.latest();
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.destroy();
  }
}

runMigrations(); 