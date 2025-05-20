import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Starting database fix script...');
  
  // Create PostgreSQL pool for direct queries
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || '***REMOVED***ql://***REMOVED***:***REMOVED***@localhost:5432/ciro_db',
  });
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    
    // Fix for workspaces table
    console.log('Checking if workspaces table exists...');
    const { rows: tableCheck } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'workspaces'
      );
    `);
    
    if (!tableCheck[0].exists) {
      console.log('Creating workspaces table...');
      await pool.query(`
        -- First ensure the uuid-ossp extension exists
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        CREATE TABLE workspaces (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
          is_shared BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
        CREATE INDEX idx_workspaces_org_id ON workspaces(organization_id);
      `);
      console.log('Workspaces table created successfully!');
    } else {
      console.log('Workspaces table already exists, checking id column type...');
      
      // Check if the id column is already a UUID
      const { rows: columnCheck } = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'workspaces' 
        AND column_name = 'id';
      `);
      
      if (columnCheck.length > 0 && columnCheck[0].data_type.toLowerCase() !== 'uuid') {
        console.log('Workspaces table has incorrect id column type, recreating table...');
        
        // First get the dependent tables
        const { rows: dependents } = await pool.query(`
          SELECT tc.table_name, tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'workspaces'
          AND ccu.column_name = 'id';
        `);
        
        // Drop constraints referring to workspaces.id
        for (const dep of dependents) {
          console.log(`Dropping constraint ${dep.constraint_name} on table ${dep.table_name}`);
          await pool.query(`
            ALTER TABLE ${dep.table_name} DROP CONSTRAINT "${dep.constraint_name}";
          `);
        }
        
        // Drop the table and recreate it
        await pool.query(`
          DROP TABLE workspaces CASCADE;
          
          -- First ensure the uuid-ossp extension exists
          CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
          
          CREATE TABLE workspaces (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
            is_shared BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
          CREATE INDEX idx_workspaces_org_id ON workspaces(organization_id);
        `);
        
        console.log('Workspaces table recreated with UUID id column!');
      } else {
        console.log('Workspaces table already has correct UUID id column type.');
      }
    }
    
    // Fix for chat_sessions metadata column
    console.log('Checking if metadata column exists in chat_sessions table...');
    const { rows: columnCheck } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_sessions' 
        AND column_name = 'metadata'
      );
    `);
    
    if (!columnCheck[0].exists) {
      console.log('Adding metadata column to chat_sessions table...');
      await pool.query(`
        ALTER TABLE chat_sessions ADD COLUMN metadata JSONB DEFAULT '{}';
      `);
      console.log('Added metadata column to chat_sessions table.');
    } else {
      console.log('Metadata column already exists in chat_sessions table.');
    }
    
    // Check if session_id in chat_messages references chat_sessions
    console.log('Checking chat_messages.session_id foreign key...');
    const { rows: fkCheck } = await pool.query(`
      SELECT COUNT(*) 
      FROM information_schema.table_constraints tc 
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name 
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'chat_messages' 
      AND ccu.column_name = 'id' 
      AND ccu.table_name = 'chat_sessions';
    `);
    
    if (parseInt(fkCheck[0].count) === 0) {
      console.log('Adding foreign key constraint to chat_messages.session_id...');
      // First check if constraint exists but is broken
      const { rows: constraintCheck } = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'chat_messages'
        AND constraint_name LIKE '%session_id%';
      `);
      
      // Drop existing constraint if needed
      for (const row of constraintCheck) {
        console.log(`Dropping existing constraint: ${row.constraint_name}`);
        await pool.query(`
          ALTER TABLE chat_messages DROP CONSTRAINT "${row.constraint_name}";
        `);
      }
      
      // Add the correct constraint
      await pool.query(`
        ALTER TABLE chat_messages 
        ADD CONSTRAINT chat_messages_session_id_fkey 
        FOREIGN KEY (session_id) 
        REFERENCES chat_sessions(id) 
        ON DELETE CASCADE;
      `);
      console.log('Added foreign key constraint to chat_messages.session_id.');
    } else {
      console.log('Foreign key constraint for chat_messages.session_id already exists.');
    }
    
    // List tables to verify changes
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('Tables in database:');
    console.log(tables.map((t: any) => t.table_name));
    
    // List columns in chat_sessions
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'chat_sessions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in chat_sessions table:');
    columns.forEach((col: any) => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('Database fix script completed successfully!');
  } catch (error) {
    console.error('Database fix script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 