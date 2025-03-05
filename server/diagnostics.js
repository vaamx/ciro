// Diagnostic script to check database issues
require('dotenv').config();

// Import the database module directly from the project
const { db } = require('./dist/infrastructure/database/knex');

async function runDiagnostics() {
  try {
    console.log('Starting database diagnostics...');
    
    // Check connection
    try {
      await db.raw('SELECT 1');
      console.log('✅ Database connection successful');
    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError.message);
      process.exit(1);
    }
    
    // Check for users
    try {
      console.log('\nChecking users table...');
      const userExists = await db.schema.hasTable('users');
      
      if (userExists) {
        console.log('✅ Users table exists');
        
        // Check for user records
        const users = await db('users').select('id', 'email').limit(3);
        if (users.length > 0) {
          console.log(`✅ Found ${users.length} users:`);
          users.forEach(user => console.log(`   - ${user.id} (${user.email})`));
          
          // Try to use a valid user ID for data source creation
          const userId = users[0].id;
          console.log(`\nUsing user ID "${userId}" for data source creation test...`);
          
          try {
            const inserted = await db('data_sources').insert({
              organization_id: 1,
              name: 'diagnostic-test-' + Date.now(),
              type: 'file',
              status: 'processing',
              description: 'Diagnostic test data source',
              created_by: userId,
              metadata: JSON.stringify({ test: true }),
              last_sync: new Date()
            }).returning('id');
            
            console.log('✅ Data source creation successful with ID:', inserted[0]);
          } catch (insertError) {
            console.error('❌ Data source creation failed:');
            console.error('   Error message:', insertError.message);
            if (insertError.detail) console.error('   Detail:', insertError.detail);
            
            // Check for foreign key constraint issues
            try {
              console.log('\nChecking organization with ID 1...');
              const org = await db('organizations').where({ id: 1 }).first();
              if (org) {
                console.log(`✅ Organization exists with ID 1: ${org.name}`);
              } else {
                console.error('❌ No organization found with ID 1, which could cause foreign key constraint failures');
              }
            } catch (orgError) {
              console.error('❌ Error checking organizations:', orgError.message);
            }
          }
        } else {
          console.log('❌ Users table exists but contains no records');
        }
      } else {
        console.error('❌ Users table does not exist');
      }
    } catch (tableError) {
      console.error('❌ Error checking users table:', tableError.message);
    }
    
    // Check data_sources table structure
    try {
      console.log('\nChecking data_sources table structure...');
      const columns = await db.raw(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'data_sources'
        ORDER BY ordinal_position
      `);
      
      console.log('Data sources table columns:');
      columns.rows.forEach(column => {
        console.log(`   - ${column.column_name} (${column.data_type}, ${column.is_nullable === 'YES' ? 'nullable' : 'not nullable'})`);
      });
      
      // Check foreign key constraints
      const fkConstraints = await db.raw(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'data_sources';
      `);
      
      console.log('\nForeign key constraints:');
      fkConstraints.rows.forEach(fk => {
        console.log(`   - ${fk.column_name} references ${fk.foreign_table_name}(${fk.foreign_column_name})`);
      });
    } catch (schemaError) {
      console.error('❌ Error checking data_sources schema:', schemaError.message);
    }
  } catch (error) {
    console.error('Unhandled error during diagnostics:', error);
  } finally {
    // Close the database connection
    await db.destroy();
    console.log('\nDiagnostics completed');
  }
}

// Run the diagnostics
runDiagnostics(); 