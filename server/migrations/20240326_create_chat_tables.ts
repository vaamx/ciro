import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Starting chat tables migration...');

  // Get the user ID type from the users table
  let userIdType = 'text'; // Default to text
  try {
    const result = await knex.raw('SELECT data_type FROM information_schema.columns WHERE table_name = \'users\' AND column_name = \'id\'');
    if (result && result.rows && result.rows.length > 0) {
      userIdType = result.rows[0].data_type;
      console.log(`Users table ID type for migration: ${userIdType}`);
    } else {
      console.log('Could not find users table ID type, using default text type');
    }
  } catch (err) {
    console.warn('Could not determine user ID type:', err);
    // Continue with default text type
  }

  // Create chat_sessions table
  console.log('Creating chat_sessions table...');
  await knex.schema.createTable('chat_sessions', (table) => {
    // Use gen_random_uuid() from pgcrypto instead of uuid_generate_v4()
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    table.specificType('user_id', userIdType).notNullable();
    table.integer('organization_id').notNullable();
    table.uuid('dashboard_id').nullable();
    table.string('title', 255).notNullable().defaultTo('New Chat');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  console.log('chat_sessions table created successfully');

  // Create chat_messages table
  console.log('Creating chat_messages table...');
  await knex.schema.createTable('chat_messages', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    table.uuid('session_id').notNullable();
    table.string('role', 50).notNullable();
    table.text('content').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Add foreign key constraint
    table.foreign('session_id').references('id').inTable('chat_sessions').onDelete('CASCADE');
  });
  console.log('chat_messages table created successfully');

  console.log('Chat tables migration completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order to handle dependencies
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');
  
  console.log('Chat tables removed successfully');
} 