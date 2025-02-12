import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

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
    // Read and execute the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

// User-related queries
export async function createUser(email: string, name: string, oauthProvider?: string, oauthId?: string) {
  const result = await pool.query(
    `INSERT INTO users (email, name, oauth_provider, oauth_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [email, name, oauthProvider, oauthId]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function findUserByOAuth(provider: string, oauthId: string) {
  const result = await pool.query(
    'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
    [provider, oauthId]
  );
  return result.rows[0];
}

// Session-related queries
export async function createSession(userId: number, sessionToken: string, expiresAt: Date) {
  const result = await pool.query(
    `INSERT INTO sessions (user_id, session_token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, sessionToken, expiresAt]
  );
  return result.rows[0];
}

export async function findSessionByToken(token: string) {
  const result = await pool.query(
    `SELECT s.*, u.* 
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return result.rows[0];
}

// OAuth token-related queries
export async function upsertOAuthToken(
  userId: number,
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null
) {
  const result = await pool.query(
    `INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING id`,
    [userId, provider, accessToken, refreshToken, expiresAt]
  );
  return result.rows[0];
}

// Chat-related queries
export async function saveChatMessage(
  sessionId: string,
  messageType: string,
  content: string,
  metadata: any = null
) {
  const result = await pool.query(
    `INSERT INTO chat_messages (session_id, message_type, content, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [sessionId, messageType, content, metadata]
  );
  return result.rows[0];
}

export async function getChatHistory(sessionId: string) {
  const result = await pool.query(
    `SELECT * FROM chat_messages
     WHERE session_id = $1
     ORDER BY timestamp ASC`,
    [sessionId]
  );
  return result.rows;
} 