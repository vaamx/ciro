import { Request, Response } from 'express';
import { db } from '../infrastructure/database';
import { BadRequestError } from '../utils/errors';

export class DataSourceController {
  async getDataSources(req: Request, res: Response) {
    const { organization_id } = req.query;

    if (!organization_id) {
      throw new BadRequestError('Organization ID is required');
    }

    try {
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

  async createDataSource(req: Request, res: Response) {
    const { organization_id, name, type, description, status, metadata, metrics, lastSync } = req.body;

    if (!organization_id || !name || !type) {
      throw new BadRequestError('Organization ID, name, and type are required');
    }

    try {
      const [dataSource] = await db('data_sources')
        .insert({
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
        })
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