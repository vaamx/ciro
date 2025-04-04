import { Knex, knex } from 'knex';
import * as path from 'path';

// Update import path for migrations
import { up, down } from '../20250220065800_create_users_table';

// Create an in-memory SQLite database for testing
const testDb = knex({
  client: 'sqlite3',
  connection: {
    filename: ':memory:'
  },
  useNullAsDefault: true
});

async function testMigration() {
  try {
    console.log('Testing migration: 20250220065800_create_users_table.ts');
    
    // Create a custom raw function for UUID generation
    const originalRaw = testDb.raw.bind(testDb);
    // @ts-ignore - Overriding for test purposes
    testDb.raw = (sql: any) => {
      if (sql === 'gen_random_uuid()') {
        return originalRaw('hex(randomblob(16))'); // SQLite equivalent for demo
      }
      return originalRaw(sql);
    };
    
    // Run the migration up
    console.log('Running up migration...');
    await up(testDb);
    
    // Check if the table was created
    const hasTable = await testDb.schema.hasTable('users');
    console.log(`Users table created: ${hasTable}`);
    
    if (hasTable) {
      // Check the table columns
      const tableInfo = await testDb.table('users').columnInfo();
      console.log('Table columns:', Object.keys(tableInfo).join(', '));
      
      // Run the migration down
      console.log('Running down migration...');
      await down(testDb);
      
      // Check if the table was dropped
      const tableExists = await testDb.schema.hasTable('users');
      console.log(`Users table still exists: ${tableExists}`);
      
      if (!tableExists) {
        console.log('Migration test passed successfully! ✅');
      } else {
        console.error('Migration down function failed to drop the table! ❌');
      }
    } else {
      console.error('Migration up function failed to create the table! ❌');
    }
  } catch (error) {
    console.error('Migration test failed:', error);
  } finally {
    // Close the database connection
    await testDb.destroy();
  }
}

// Run the test
testMigration().catch(console.error); 