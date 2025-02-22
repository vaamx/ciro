import { pool } from './index';

async function resetDatabase() {
  try {
    console.log('Dropping all tables...');
    await pool.query(`
      DROP TABLE IF EXISTS files CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS metrics CASCADE;
      DROP TABLE IF EXISTS dashboards CASCADE;
      DROP TABLE IF EXISTS migrations CASCADE;
    `);
    console.log('All tables dropped successfully');

    console.log('Dropping extensions...');
    await pool.query(`
      DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
      DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
      DROP EXTENSION IF EXISTS "vector" CASCADE;
    `);
    console.log('Extensions dropped successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase(); 