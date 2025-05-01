import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Starting database synchronization process...');
  
  // Create PostgreSQL pool for direct queries
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || '***REMOVED***ql://***REMOVED***:***REMOVED***@localhost:5432/ciro_db',
  });
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    
    // Check users table structure
    console.log('Checking users table structure...');
    const { rows: userColumns } = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Users table structure:');
    userColumns.forEach((col: any) => {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });
    
    // Find the id column's data type
    const idColumn = userColumns.find((col: any) => col.column_name === 'id');
    const userId_DataType = idColumn ? idColumn.data_type : 'uuid';
    const userId_UdtName = idColumn ? idColumn.udt_name : 'uuid';
    
    console.log(`User ID column type: ${userId_DataType} (${userId_UdtName})`);
    
    // Check missing tables
    console.log('Checking for missing tables...');
    const requiredTables = [
      'conversations', 
      'conversation_participants', 
      'messages',
      'chat_sessions',
      'chat_messages'
    ];
    
    const { rows: existingTables } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    
    const existingTableNames = existingTables.map((t: any) => t.table_name);
    console.log('Existing tables:', existingTableNames);
    
    const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));
    console.log('Missing tables:', missingTables);
    
    if (missingTables.length > 0) {
      console.log('Creating missing tables...');
      
      // Based on whether users.id is UUID or INTEGER, adjust the foreign key constraints
      const createdByType = userId_UdtName === 'uuid' ? 'UUID' : 'INTEGER';
      const userIdType = userId_UdtName === 'uuid' ? 'UUID' : 'INTEGER';
      
      // Create missing tables using raw SQL with correct data types
      if (missingTables.includes('conversations') || 
          missingTables.includes('conversation_participants') || 
          missingTables.includes('messages')) {
        console.log(`Creating conversations tables with user_id as ${userIdType}...`);
        await pool.query(`
          -- Create conversations table if it doesn't exist
          CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            created_by ${createdByType} REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Create conversation_participants table if it doesn't exist
          CREATE TABLE IF NOT EXISTS conversation_participants (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(conversation_id, user_id)
          );
          
          -- Create messages table if it doesn't exist
          CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            content TEXT NOT NULL,
            role VARCHAR(50) DEFAULT 'user' NOT NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);
        console.log('Conversations tables created successfully!');
      }
      
      if (missingTables.includes('chat_sessions') || missingTables.includes('chat_messages')) {
        console.log(`Creating chat tables with user_id as ${userIdType}...`);
        await pool.query(`
          -- Create chat_sessions table if it doesn't exist
          CREATE TABLE IF NOT EXISTS chat_sessions (
            id SERIAL PRIMARY KEY,
            user_id ${userIdType === 'UUID' ? 'INTEGER' : userIdType} NOT NULL,
            organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
            dashboard_id VARCHAR(255),
            title VARCHAR(255) NOT NULL,
            last_message TEXT,
            message_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
          
          -- Create indexes for chat_sessions
          CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
          CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON chat_sessions(organization_id);
          
          -- Create chat_messages table if it doesn't exist
          CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            message_type VARCHAR(20) CHECK (message_type IN ('user', 'assistant', 'system', 'error')) NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            position INTEGER,
            user_id ${userIdType} ${userIdType === 'UUID' ? 'REFERENCES users(id)' : ''},
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Create index for chat_messages
          CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
        `);
        console.log('Chat tables created successfully!');
      }
      
      // Update Prisma schema with new tables
      console.log('Updating Prisma schema to match database...');
      try {
        execSync('npx prisma db pull', {
          stdio: 'inherit',
        });
        console.log('Prisma schema updated successfully!');
        
        // Generate Prisma client
        console.log('Generating Prisma client...');
        execSync('npx prisma generate', {
          stdio: 'inherit',
        });
        console.log('Prisma client generated successfully!');
      } catch (prismaError) {
        console.error('Error updating Prisma schema:', prismaError);
      }
    } else {
      console.log('All required tables already exist.');
    }
    
    // Verify tables were created
    const { rows: updatedTables } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    
    console.log('Current tables in database:');
    console.log(updatedTables.map((t: any) => t.table_name));
    
    console.log('Database synchronization completed successfully!');
  } catch (error) {
    console.error('Database synchronization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 