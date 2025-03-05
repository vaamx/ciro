import { Request, Response } from 'express';
import { db } from '../infrastructure/database';
import { BadRequestError } from '../utils/errors';

export class DataSourceController {
  constructor() {
    // Bind the methods to ensure 'this' context is preserved
    this.getDataSources = this.getDataSources.bind(this);
    this.createDataSource = this.createDataSource.bind(this);
    this.updateDataSource = this.updateDataSource.bind(this);
    this.deleteDataSource = this.deleteDataSource.bind(this);
    this.tableExists = this.tableExists.bind(this);
  }

  async getDataSources(req: Request, res: Response) {
    const { organization_id } = req.query;

    if (!organization_id) {
      throw new BadRequestError('Organization ID is required');
    }

    try {
      // First, check if the data_sources table exists
      const tableExists = await this.tableExists('data_sources');
      
      if (!tableExists) {
        console.warn('data_sources table does not exist. Returning empty array.');
        return res.json([]);
      }

      const dataSources = await db('data_sources')
        .where({ organization_id })
        .select('*');

      // Transform each data source to match the frontend model
      const transformedDataSources = dataSources.map(dataSource => ({
        id: dataSource.id,
        name: dataSource.name,
        type: dataSource.type,
        status: dataSource.status,
        description: dataSource.description,
        lastSync: dataSource.last_sync,
        metadata: dataSource.metadata,
        metrics: {
          records: dataSource.metrics?.records || 0,
          syncRate: dataSource.metrics?.syncRate || 0,
          avgSyncTime: dataSource.metrics?.avgSyncTime || '0s',
          lastError: dataSource.metrics?.lastError
        }
      }));

      res.json(transformedDataSources);
    } catch (error) {
      console.error('Error fetching data sources:', error);
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  }

  // Helper method to check if a table exists
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      console.log(`Checking if table ${tableName} exists...`);
      const result = await db.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ?
        );
      `, [tableName]);
      
      const exists = result.rows[0].exists;
      console.log(`Table ${tableName} ${exists ? 'exists' : 'does not exist'}`);
      return exists;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  // Helper to check all required tables
  private async checkRequiredTables(): Promise<Record<string, boolean>> {
    const requiredTables = [
      'data_sources',
      'document_chunks',
      'system_settings'
    ];
    
    const results: Record<string, boolean> = {};
    
    for (const table of requiredTables) {
      results[table] = await this.tableExists(table);
    }
    
    console.log('Required tables status:', results);
    return results;
  }

  async createDataSource(req: Request, res: Response) {
    const { organization_id, name, type, description, status, metadata, metrics, lastSync, created_by } = req.body;
    const userId = req.user?.id || req.body.userId || created_by || 'system';

    if (!organization_id || !name || !type) {
      throw new BadRequestError('Organization ID, name, and type are required');
    }

    try {
      // Build the insert object
      const insertData: any = {
        organization_id,
        name,
        type,
        description,
        status: status || 'connected',
        metadata: metadata || {},
        metrics: metrics || {
          records: 0,
          syncRate: 0,
          avgSyncTime: '0s'
        },
        last_sync: lastSync || new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      // IMPROVED: Always convert created_by to a numeric value
      let numericUserId = 1; // Default fallback
      
      // Try different sources for the user ID in order of priority
      const userIdToConvert = created_by || userId;
      
      if (userIdToConvert) {
        // If it's already a number, use it directly
        if (typeof userIdToConvert === 'number') {
          numericUserId = userIdToConvert;
          console.log(`Using numeric userId directly: ${numericUserId}`);
        }
        // If it's a string that can be directly converted to a number
        else if (typeof userIdToConvert === 'string' && !isNaN(Number(userIdToConvert)) && !userIdToConvert.includes('-')) {
          numericUserId = Number(userIdToConvert);
          console.log(`Converted string userId to number: ${numericUserId}`);
        }
        // If it's a UUID string, extract a numeric value
        else if (typeof userIdToConvert === 'string' && userIdToConvert.includes('-')) {
          try {
            const uuidDigits = userIdToConvert.replace(/-/g, '');
            numericUserId = parseInt(uuidDigits.substring(0, 8), 16) % 1000000;
            numericUserId = Math.abs(numericUserId) || 1;
            console.log(`Converted UUID ${userIdToConvert} to numeric ID: ${numericUserId}`);
          } catch (e) {
            console.warn('Failed to convert UUID to numeric ID, using default:', e);
          }
        }
      }
      
      // Always use the numeric user ID
      insertData.created_by = numericUserId;

      const [dataSource] = await db('data_sources')
        .insert(insertData)
        .returning('*');

      // Transform the response to match the frontend model
      const response = {
        ...dataSource,
        lastSync: dataSource.last_sync,
        metrics: {
          ...dataSource.metrics,
          records: dataSource.metrics.records || 0,
          syncRate: dataSource.metrics.syncRate || 0,
          avgSyncTime: dataSource.metrics.avgSyncTime || '0s'
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating data source:', error);
      res.status(500).json({ error: 'Failed to create data source' });
    }
  }

  async getDataSource(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const dataSource = await db('data_sources')
        .where({ id })
        .first();

      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      res.json(dataSource);
    } catch (error) {
      console.error('Error fetching data source:', error);
      res.status(500).json({ error: 'Failed to fetch data source' });
    }
  }

  async updateDataSource(req: Request, res: Response) {
    const { id } = req.params;
    const { name, description, config, type } = req.body;

    try {
      const [dataSource] = await db('data_sources')
        .where({ id })
        .update({
          name,
          description,
          type,
          config: config || db.raw('config'),
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      res.json(dataSource);
    } catch (error) {
      console.error('Error updating data source:', error);
      res.status(500).json({ error: 'Failed to update data source' });
    }
  }

  async deleteDataSource(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const deleted = await db('data_sources')
        .where({ id })
        .delete();

      if (!deleted) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting data source:', error);
      res.status(500).json({ error: 'Failed to delete data source' });
    }
  }
} 