import { Pool } from 'pg';

// PostgreSQL connection for chat history and structured data
export const pool = new Pool({
  user: process.env.POSTGRES_USER || '***REMOVED***',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'ciro_db',
  password: process.env.POSTGRES_PASSWORD || '***REMOVED***',
  port: Number(process.env.POSTGRES_PORT) || 5432,
});

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        message_type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
} 