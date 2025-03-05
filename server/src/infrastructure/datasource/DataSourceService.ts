import { Knex } from 'knex';
import { db } from '../database/knex';

interface DataSourceField {
  field_name: string;
  field_type: string;
  is_required: boolean;
  is_array: boolean;
  description?: string;
  metadata?: any;
}

interface DataSource {
  id: number;
  user_id: string;
  provider: string;
  name: string;
  status: string;
  credentials?: any;
  metadata?: any;
  last_sync_at?: Date;
}

export class DataSourceService {
  private readonly db: Knex;

  constructor(dbInstance?: Knex) {
    this.db = dbInstance || db;
  }

  // Create a new data source
  async createDataSource(
    userId: string,
    provider: string,
    name: string,
    credentials?: any,
    metadata?: any
  ): Promise<DataSource> {
    const [result] = await this.db('data_sources')
      .insert({
        user_id: userId,
        provider,
        name,
        credentials,
        metadata
      })
      .returning('*');

    return result;
  }

  // Update data source credentials
  async updateCredentials(id: number, credentials: any): Promise<void> {
    await this.db('data_sources')
      .where({ id })
      .update({
        credentials,
        updated_at: this.db.fn.now()
      });
  }

  // Add or update fields for a data source
  async upsertFields(
    dataSourceId: number,
    fields: DataSourceField[]
  ): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (const field of fields) {
        await trx('data_source_fields')
          .insert({
            data_source_id: dataSourceId,
            field_name: field.field_name,
            field_type: field.field_type,
            is_required: field.is_required,
            is_array: field.is_array,
            description: field.description,
            metadata: field.metadata
          })
          .onConflict(['data_source_id', 'field_name'])
          .merge({
            field_type: field.field_type,
            is_required: field.is_required,
            is_array: field.is_array,
            description: field.description,
            metadata: field.metadata,
            updated_at: trx.fn.now()
          });
      }
    });
  }

  // Store records from the data source
  async storeRecords(
    dataSourceId: number,
    records: { external_id: string; data: any }[]
  ): Promise<void> {
    await this.db.transaction(async (trx) => {
      for (const record of records) {
        await trx('data_source_records')
          .insert({
            data_source_id: dataSourceId,
            external_id: record.external_id,
            data: record.data
          })
          .onConflict(['data_source_id', 'external_id'])
          .merge({
            data: record.data,
            updated_at: trx.fn.now()
          });
      }

      // Update last sync time
      await trx('data_sources')
        .where({ id: dataSourceId })
        .update({
          last_sync_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });
    });
  }

  // Get data source by ID
  async getDataSource(id: number): Promise<DataSource | null> {
    return this.db('data_sources')
      .where({ id })
      .first() || null;
  }

  // Get data sources for a user
  async getUserDataSources(userId: string): Promise<DataSource[]> {
    return this.db('data_sources')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
  }

  // Get fields for a data source
  async getDataSourceFields(dataSourceId: number): Promise<DataSourceField[]> {
    return this.db('data_source_fields')
      .where({ data_source_id: dataSourceId });
  }

  // Get records for a data source with pagination
  async getDataSourceRecords(
    dataSourceId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{ records: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const records = await this.db('data_source_records')
      .where({ data_source_id: dataSourceId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db('data_source_records')
      .where({ data_source_id: dataSourceId })
      .count();

    return {
      records,
      total: parseInt(count as string)
    };
  }

  // Delete a data source and all related data
  async deleteDataSource(id: number): Promise<void> {
    await this.db('data_sources')
      .where({ id })
      .delete();
  }

  // Update data source status
  async updateStatus(id: number, status: string): Promise<void> {
    await this.db('data_sources')
      .where({ id })
      .update({
        status,
        updated_at: this.db.fn.now()
      });
  }
} 