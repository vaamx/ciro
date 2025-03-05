import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping migration');
    return;
  }

  // Check if the position column already exists
  const columnExists = await knex.schema.hasColumn('chat_messages', 'position');
  if (columnExists) {
    console.log('position column already exists in chat_messages table, skipping migration');
    return;
  }

  console.log('Adding position column to chat_messages table');
  await knex.schema.table('chat_messages', (table) => {
    table.integer('position').nullable();
  });

  // Create an index on the position column
  console.log('Adding index on position column');
  await knex.schema.table('chat_messages', (table) => {
    table.index(['session_id', 'position'], 'idx_chat_messages_session_position');
  });

  // Populate the position field for existing messages
  const sessions = await knex('chat_sessions').select('id');
  console.log(`Found ${sessions.length} chat sessions to update`);

  for (const session of sessions) {
    const messages = await knex('chat_messages')
      .where('session_id', session.id)
      .orderBy('created_at')
      .select('id');

    console.log(`Updating ${messages.length} messages for session ${session.id}`);
    
    for (let i = 0; i < messages.length; i++) {
      await knex('chat_messages')
        .where('id', messages[i].id)
        .update({ position: i });
    }
  }

  console.log('Migration completed successfully');
}

export async function down(knex: Knex): Promise<void> {
  // Check if the chat_messages table exists
  const tableExists = await knex.schema.hasTable('chat_messages');
  if (!tableExists) {
    console.log('chat_messages table does not exist, skipping down migration');
    return;
  }

  // Check if the position column exists
  const columnExists = await knex.schema.hasColumn('chat_messages', 'position');
  if (!columnExists) {
    console.log('position column does not exist in chat_messages table, skipping down migration');
    return;
  }

  // Drop the index first if it exists
  try {
    await knex.schema.table('chat_messages', (table) => {
      table.dropIndex(['session_id', 'position'], 'idx_chat_messages_session_position');
    });
    console.log('Dropped index idx_chat_messages_session_position');
  } catch (error) {
    console.log('Index might not exist, continuing...');
  }

  // Remove the position column
  console.log('Removing position column from chat_messages table');
  await knex.schema.table('chat_messages', (table) => {
    table.dropColumn('position');
  });

  console.log('Down migration completed successfully');
} 