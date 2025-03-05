import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Only create tables if they don't exist already
  const hasFinetuningTable = await knex.schema.hasTable('fine_tuning_jobs');
  if (!hasFinetuningTable) {
    await knex.schema.createTable('fine_tuning_jobs', (table) => {
      table.string('id').primary();
      table.string('status').notNullable();
      table.string('model').notNullable();
      table.string('file_id');
      table.string('organization_id');
      table.jsonb('metadata');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index('status');
      table.index('organization_id');
    });
    
    console.log('Created fine_tuning_jobs table');
  }

  // Add necessary fields to chat_messages table if it exists
  const hasChatMessages = await knex.schema.hasTable('chat_messages');
  if (hasChatMessages) {
    // Check if metadata column exists before trying to add it
    const hasMetadata = await knex.schema.hasColumn('chat_messages', 'metadata');
    if (!hasMetadata) {
      await knex.schema.alterTable('chat_messages', (table) => {
        table.jsonb('metadata').nullable();
      });
      console.log('Added metadata column to chat_messages table');
    }
  } else {
    // Create chat_messages table with all required fields
    await knex.schema.createTable('chat_messages', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.uuid('session_id').notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.string('role').notNullable();
      table.text('content').notNullable();
      table.jsonb('metadata').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index('session_id');
      table.index('role');
    });
    
    // Create an index on the archived flag using raw SQL after table creation
    await knex.raw(`
      CREATE INDEX idx_chat_messages_archived ON chat_messages ((metadata->>'archived')::boolean);
    `);
    
    console.log('Created chat_messages table');
  }

  // Make sure chat_sessions table exists with all required fields
  const hasChatSessions = await knex.schema.hasTable('chat_sessions');
  if (!hasChatSessions) {
    await knex.schema.createTable('chat_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('user_id').notNullable();
      table.integer('organization_id').nullable();
      table.string('dashboard_id').nullable();
      table.string('title').notNullable().defaultTo('New Conversation');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.jsonb('metadata').nullable();
      
      table.index('user_id');
      table.index('organization_id');
      table.index('is_active');
    });
    
    console.log('Created chat_sessions table');
  } else {
    // Ensure chat_sessions has a metadata column
    const hasMetadata = await knex.schema.hasColumn('chat_sessions', 'metadata');
    if (!hasMetadata) {
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.jsonb('metadata').nullable();
      });
      console.log('Added metadata column to chat_sessions table');
    }
  }

  // Create a system_settings table for app configuration
  const hasSettingsTable = await knex.schema.hasTable('system_settings');
  if (!hasSettingsTable) {
    await knex.schema.createTable('system_settings', (table) => {
      table.increments('id').primary();
      table.string('key').notNullable().unique();
      table.jsonb('value').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index('key');
    });
    
    console.log('Created system_settings table');
    
    // Insert default settings
    await knex('system_settings').insert([
      {
        key: 'chat_defaults',
        value: JSON.stringify({
          default_model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 4096,
          summarize_threshold: 15,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          conversation_context_weight: 0.5
        })
      }
    ]);
    
    console.log('Inserted default system settings');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('fine_tuning_jobs');
  
  // For the other tables, we'll just remove added columns
  // rather than dropping the tables, to preserve data
  
  const hasChatMessages = await knex.schema.hasTable('chat_messages');
  if (hasChatMessages) {
    // Drop the custom index first
    await knex.raw(`DROP INDEX IF EXISTS idx_chat_messages_archived;`);
    
    const hasMetadata = await knex.schema.hasColumn('chat_messages', 'metadata');
    if (hasMetadata) {
      await knex.schema.alterTable('chat_messages', (table) => {
        table.dropColumn('metadata');
      });
    }
  }
  
  const hasChatSessions = await knex.schema.hasTable('chat_sessions');
  if (hasChatSessions) {
    const hasMetadata = await knex.schema.hasColumn('chat_sessions', 'metadata');
    if (hasMetadata) {
      await knex.schema.alterTable('chat_sessions', (table) => {
        table.dropColumn('metadata');
      });
    }
  }
  
  await knex.schema.dropTableIfExists('system_settings');
} 