import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  try {
    // Check if conversations table exists
    const hasConversationsTable = await knex.schema.hasTable('conversations');
    if (hasConversationsTable) {
      console.log('conversations table already exists, skipping creation');
    } else {
      // Create conversations table
      await knex.schema.createTable('conversations', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.uuid('created_by')
          .references('id')
          .inTable('users')
          .onDelete('CASCADE')
          .notNullable();
        table.integer('organization_id')
          .references('id')
          .inTable('organizations')
          .onDelete('CASCADE')
          .notNullable();
        table.timestamps(true, true);
      });
      console.log('Created conversations table');
    }

    // Check if conversation_participants table exists
    const hasParticipantsTable = await knex.schema.hasTable('conversation_participants');
    if (hasParticipantsTable) {
      console.log('conversation_participants table already exists, skipping creation');
    } else {
      // Create conversation_participants table
      await knex.schema.createTable('conversation_participants', (table) => {
        table.increments('id').primary();
        table.integer('conversation_id')
          .references('id')
          .inTable('conversations')
          .onDelete('CASCADE')
          .notNullable();
        table.uuid('user_id')
          .references('id')
          .inTable('users')
          .onDelete('CASCADE')
          .notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.unique(['conversation_id', 'user_id']);
      });
      console.log('Created conversation_participants table');
    }

    // Check if messages table exists
    const hasMessagesTable = await knex.schema.hasTable('messages');
    if (hasMessagesTable) {
      console.log('messages table already exists, skipping creation');
    } else {
      // Create messages table
      await knex.schema.createTable('messages', (table) => {
        table.increments('id').primary();
        table.integer('conversation_id')
          .references('id')
          .inTable('conversations')
          .onDelete('CASCADE')
          .notNullable();
        table.uuid('user_id')
          .references('id')
          .inTable('users')
          .onDelete('CASCADE')
          .notNullable();
        table.text('content').notNullable();
        table.string('role').defaultTo('user').notNullable();
        table.jsonb('metadata').defaultTo('{}');
        table.timestamps(true, true);
      });
      console.log('Created messages table');
    }
  } catch (error: any) {
    console.error('Error in create_conversations_tables migration:', error.message);
    throw error;
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  try {
    // Drop tables in reverse order of creation
    await knex.schema.dropTableIfExists('messages');
    await knex.schema.dropTableIfExists('conversation_participants');
    await knex.schema.dropTableIfExists('conversations');
    console.log('Dropped conversations tables');
  } catch (error: any) {
    console.error('Error in create_conversations_tables down migration:', error.message);
    throw error;
  }
}; 