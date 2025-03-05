import { Pool } from 'pg';
import { config } from './index';

// Determine if we're running in local development mode
const isLocalDevelopment = process.env.NODE_ENV === 'development' && 
                          (!process.env.IN_DOCKER || process.env.IN_DOCKER !== 'true');

// Use appropriate host based on environment
const host = isLocalDevelopment ? 
             (process.env.DB_HOST || 'localhost') : 
             (process.env.DB_HOST || '***REMOVED***');

// Connection pool for PostgreSQL
export const pool = new Pool({
  host: host,
  port: parseInt(process.env.DB_PORT || config.database.port.toString()),
  user: process.env.DB_USER || config.database.user,
  password: process.env.DB_PASSWORD || config.database.password,
  database: process.env.DB_NAME || config.database.database,
});

// Log connection details (without password)
console.log(`Database connection configured with:
- Host: ${host}
- Port: ${parseInt(process.env.DB_PORT || config.database.port.toString())}
- User: ${process.env.DB_USER || config.database.user}
- Database: ${process.env.DB_NAME || config.database.database}
- Environment: ${isLocalDevelopment ? 'Local Development' : 'Docker Container'}`);

// Simple function to test the database connection
export const testConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (err) {
    console.error('Database connection error:', err);
    return false;
  } finally {
    if (client) client.release();
  }
};

// Export default pool for use in the application
export default pool; 