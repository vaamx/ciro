import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('files', (table) => {
    table.text('error').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('files', (table) => {
    table.dropColumn('error');
  });
} 