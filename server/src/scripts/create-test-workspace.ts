import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Creating test workspace...');
  
  // Create PostgreSQL pool for direct queries
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || '***REMOVED***ql://***REMOVED***:***REMOVED***@localhost:5432/ciro_db',
  });
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    
    // Check if the workspace already exists
    console.log('Checking if workspace exists...');
    const { rows: workspaceCheck } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM workspaces 
        WHERE id = '3d38b52d-7f88-439c-810c-90dc2b706461'
      );
    `);
    
    if (!workspaceCheck[0].exists) {
      console.log('Creating workspace with ID 3d38b52d-7f88-439c-810c-90dc2b706461...');
      const { rows } = await pool.query(`
        INSERT INTO workspaces (
          id, 
          name, 
          description, 
          user_id, 
          organization_id, 
          is_shared, 
          created_at, 
          updated_at
        ) VALUES (
          '3d38b52d-7f88-439c-810c-90dc2b706461', 
          'Test Workspace', 
          'Created to fix 404 error', 
          '1', 
          236, 
          false, 
          NOW(), 
          NOW()
        ) RETURNING *;
      `);
      
      console.log('Workspace created successfully!');
      console.log('Workspace details:', rows[0]);
    } else {
      console.log('Workspace with ID 3d38b52d-7f88-439c-810c-90dc2b706461 already exists, updating user_id...');
      
      // Check the column type
      const { rows: columnInfo } = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'workspaces' 
        AND column_name = 'user_id';
      `);
      
      console.log('user_id column type:', columnInfo[0]?.data_type);
      
      // Update the existing workspace with integer (since the column is integer type)
      const { rows } = await pool.query(`
        UPDATE workspaces
        SET user_id = 1, 
            updated_at = NOW()
        WHERE id = '3d38b52d-7f88-439c-810c-90dc2b706461'
        RETURNING *;
      `);
      
      console.log('Workspace updated successfully!');
      console.log('Updated workspace details:', rows[0]);
    }
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main(); 