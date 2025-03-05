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
    console.log('Beginning transaction...');
    await client.query('BEGIN');

    console.log('Creating organizations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        logo_url TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Organizations table created successfully');

    console.log('Creating users table...');
    const createTableResult = await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        organization_id INTEGER REFERENCES organizations(id),
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW(),
        email_verified BOOLEAN DEFAULT FALSE,
        email_verification_token TEXT,
        email_verification_token_expires_at TIMESTAMP WITH TIME ZONE,
        password_reset_token TEXT,
        password_reset_token_expires_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('Users table creation result:', createTableResult.command);

    console.log('Creating organization_members table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(organization_id, user_id)
      );
    `);
    console.log('Organization members table created successfully');

    // Create default organization
    console.log('Creating default organization...');
    try {
      const [defaultOrg] = await client.query(
        'INSERT INTO organizations (name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
        ['Default Organization', 'Default organization for all users']
      ).then(res => res.rows);
      console.log('Default organization created:', defaultOrg);
    } catch (error) {
      console.error('Error creating default organization:', error);
      throw error;
    }

    console.log('Creating conversations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_by INTEGER REFERENCES users(id) NOT NULL,
        organization_id INTEGER REFERENCES organizations(id) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Conversations table created successfully');

    console.log('Creating conversation_participants table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id, user_id)
      );
    `);
    console.log('Conversation participants table created successfully');

    console.log('Creating messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Messages table created successfully');

    // Create test user
    console.log('Creating test user...');
    try {
      const defaultOrg = await client.query('SELECT id FROM organizations LIMIT 1').then(res => res.rows[0]);
      
      // Create test users
      const users = [
        {
          email: 'test@example.com',
          name: 'Test User',
          password_hash: '$2b$10$vwsXH1Thu2sQUJPtvIyVHOGgBD/lmaYvHjtP4t6E59EyKOqGc5aGK',
        },
        {
          email: 'test2@example.com',
          name: 'Test User 2',
          password_hash: '$2b$10$vwsXH1Thu2sQUJPtvIyVHOGgBD/lmaYvHjtP4t6E59EyKOqGc5aGK',
        }
      ];

      for (const user of users) {
        const insertUserResult = await client.query(
          'INSERT INTO users (email, password_hash, name, organization_id, email_verified) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET password_hash = $2, organization_id = $4, email_verified = $5 RETURNING id, email',
          [user.email, user.password_hash, user.name, defaultOrg.id, true]
        );
        console.log(`User creation result for ${user.email}:`, insertUserResult.command, insertUserResult.rowCount);

        // Add user to organization_members
        await client.query(
          'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (organization_id, user_id) DO NOTHING',
          [defaultOrg.id, insertUserResult.rows[0].id, 'admin']
        );
        console.log(`Added ${user.email} to organization_members`);
      }
    } catch (error) {
      console.error('Error creating test users:', error);
      throw error;
    }

    // Commit transaction
    console.log('Committing transaction...');
    await client.query('COMMIT');
    console.log('Database initialization completed successfully');
  } catch (error) {
    // Rollback transaction on error
    console.error('Error during database initialization, rolling back...');
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error initializing database:', error);
    if (error instanceof DatabaseError) {
      console.error('Error position:', error.position);
      console.error('Error code:', error.code);
      console.error('Error detail:', error.detail);
    }
    throw error;
  } finally {
    console.log('Releasing database client...');
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('Database client released and pool ended');
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initializeDatabase }; 