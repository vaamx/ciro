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

  try {
    // Create chat_sessions table
    console.log('Creating chat_sessions table...');
    const chat_sessionsExists = await knex.schema.hasTable('chat_sessions');
    if (!chat_sessionsExists) {
      await knex.schema.createTable('chat_sessions', (table) => {
        // Use gen_random_uuid() from pgcrypto instead of uuid_generate_v4()
        table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.uuid('user_id').nullable();
        table.string('session_id', 255).notNullable().unique();
        table.string('title', 255).nullable();
        table.jsonb('metadata').nullable();
        table.boolean('is_active').defaultTo(true).notNullable();
        table.integer('message_count').defaultTo(0).notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now()).notNullable();
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now()).notNullable();
        
        // Add indexes
        table.index('user_id');
        table.index('is_active');
        table.index('updated_at');
      });
      console.log('Created chat_sessions table');
    } else {
      console.log('chat_sessions table already exists, skipping creation');
    }
    
    // Create chat_messages table
    console.log('Creating chat_messages table...');
    const chat_messagesExists = await knex.schema.hasTable('chat_messages');
    if (!chat_messagesExists) {
      await knex.schema.createTable('chat_messages', (table) => {
        table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.uuid('chat_session_id').notNullable()
          .references('id')
          .inTable('chat_sessions')
          .onDelete('CASCADE');
        table.string('role', 50).notNullable();
        table.text('content').notNullable();
        table.jsonb('metadata').nullable();
        table.integer('token_count').defaultTo(0).notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now()).notNullable();
        
        // Add indexes
        table.index('chat_session_id');
        table.index('role');
      });
      console.log('Created chat_messages table');
    } else {
      console.log('chat_messages table already exists, skipping creation');
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error creating chat tables:', error);
    return Promise.reject(error);
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    // Drop tables in reverse order of creation
    await knex.schema.dropTableIfExists('chat_messages');
    await knex.schema.dropTableIfExists('chat_sessions');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error dropping chat tables:', error);
    return Promise.reject(error);
  }
} 