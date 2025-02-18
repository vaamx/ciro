import { Pool, DatabaseError } from 'pg';
import { config } from '../../config';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Starting database initialization...');
    
    // Start transaction
    await client.query('BEGIN');

    console.log('Creating users table...');
    const createTableResult = await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW(),
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token TEXT,
        email_verification_token_expires_at TIMESTAMP WITH TIME ZONE,
        password_reset_token TEXT,
        password_reset_token_expires_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Users table creation result:', createTableResult.command);

    console.log('Creating updated_at function...');
    const createFunctionResult = await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('Function creation result:', createFunctionResult.command);

    console.log('Creating users trigger...');
    const dropTriggerResult = await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    `);
    console.log('Drop trigger result:', dropTriggerResult.command);

    const createTriggerResult = await client.query(`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('Create trigger result:', createTriggerResult.command);

    // Create test user
    console.log('Creating test user...');
    const insertUserResult = await client.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, email',
      ['test@example.com', '$2b$10$rMT5V5U5SHC0oNnNO3Vrx.OMU0VFGTZxEtQpF5y0YvFkrXxEVzXn6', 'Test User']
    );
    console.log('Test user creation result:', insertUserResult.command, insertUserResult.rowCount);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Database initialization completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    if (error instanceof DatabaseError) {
      console.error('Error position:', error.position);
      console.error('Error code:', error.code);
      console.error('Error detail:', error.detail);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initializeDatabase }; 