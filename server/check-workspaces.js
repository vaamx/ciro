const { Client } = require('pg');

async function checkWorkspaces() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || '***REMOVED***',
    password: process.env.DB_PASSWORD || '***REMOVED***',
    database: process.env.DB_NAME || 'ciro_db'
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if workspaces table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'workspaces'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log('Workspaces table exists:', tableExists);
    
    if (tableExists) {
      // Query all workspaces
      const workspaces = await client.query('SELECT * FROM workspaces');
      console.log('Total workspaces:', workspaces.rowCount);
      console.log('Workspaces:');
      workspaces.rows.forEach(workspace => {
        console.log(`ID: ${workspace.id}, Name: ${workspace.name}, Created: ${workspace.created_at}`);
      });
      
      // Check for the specific workspace ID
      const specificId = 'dab93f05-d80d-4dcb-ada0-b5f6ec01fb87';
      const specificWorkspace = await client.query('SELECT * FROM workspaces WHERE id = $1', [specificId]);
      
      if (specificWorkspace.rowCount > 0) {
        console.log('\nWorkspace with ID', specificId, 'exists:');
        console.log(specificWorkspace.rows[0]);
      } else {
        console.log('\nWorkspace with ID', specificId, 'does not exist in the database');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

checkWorkspaces(); 