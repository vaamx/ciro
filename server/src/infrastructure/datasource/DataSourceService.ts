import { pool } from '../database';

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
  user_id: number;
  provider: string;
  name: string;
  status: string;
  credentials?: any;
  metadata?: any;
  last_sync_at?: Date;
}

export class DataSourceService {
  // Create a new data source
  async createDataSource(
    userId: number,
    provider: string,
    name: string,
    credentials?: any,
    metadata?: any
  ): Promise<DataSource> {
    const result = await pool.query(
      `INSERT INTO data_sources (user_id, provider, name, credentials, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, provider, name, credentials, metadata]
    );

    return result.rows[0];
  }

  // Update data source credentials
  async updateCredentials(id: number, credentials: any): Promise<void> {
    await pool.query(
      `UPDATE data_sources
       SET credentials = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, credentials]
    );
  }

  // Add or update fields for a data source
  async upsertFields(
    dataSourceId: number,
    fields: DataSourceField[]
  ): Promise<void> {
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const field of fields) {
        await client.query(
          `INSERT INTO data_source_fields (
            data_source_id, field_name, field_type,
            is_required, is_array, description, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (data_source_id, field_name)
          DO UPDATE SET
            field_type = EXCLUDED.field_type,
            is_required = EXCLUDED.is_required,
            is_array = EXCLUDED.is_array,
            description = EXCLUDED.description,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()`,
          [
            dataSourceId,
            field.field_name,
            field.field_type,
            field.is_required,
            field.is_array,
            field.description,
            field.metadata
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Store records from the data source
  async storeRecords(
    dataSourceId: number,
    records: { external_id: string; data: any }[]
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const record of records) {
        await client.query(
          `INSERT INTO data_source_records (data_source_id, external_id, data)
           VALUES ($1, $2, $3)
           ON CONFLICT (data_source_id, external_id)
           DO UPDATE SET
             data = EXCLUDED.data,
             updated_at = NOW()`,
          [dataSourceId, record.external_id, record.data]
        );
      }

      // Update last sync time
      await client.query(
        `UPDATE data_sources
         SET last_sync_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [dataSourceId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get data source by ID
  async getDataSource(id: number): Promise<DataSource | null> {
    const result = await pool.query(
      'SELECT * FROM data_sources WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Get data sources for a user
  async getUserDataSources(userId: number): Promise<DataSource[]> {
    const result = await pool.query(
      'SELECT * FROM data_sources WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  // Get fields for a data source
  async getDataSourceFields(dataSourceId: number): Promise<DataSourceField[]> {
    const result = await pool.query(
      'SELECT * FROM data_source_fields WHERE data_source_id = $1',
      [dataSourceId]
    );
    return result.rows;
  }

  // Get records for a data source with pagination
  async getDataSourceRecords(
    dataSourceId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{ records: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const records = await pool.query(
      `SELECT * FROM data_source_records
       WHERE data_source_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [dataSourceId, limit, offset]
    );

    const count = await pool.query(
      'SELECT COUNT(*) FROM data_source_records WHERE data_source_id = $1',
      [dataSourceId]
    );

    return {
      records: records.rows,
      total: parseInt(count.rows[0].count)
    };
  }

  // Delete a data source and all related data
  async deleteDataSource(id: number): Promise<void> {
    await pool.query('DELETE FROM data_sources WHERE id = $1', [id]);
  }

  // Update data source status
  async updateStatus(id: number, status: string): Promise<void> {
    await pool.query(
      `UPDATE data_sources
       SET status = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, status]
    );
  }
} 