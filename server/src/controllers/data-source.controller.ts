import { Request, Response } from 'express';
import { db } from '../infrastructure/database';
import { BadRequestError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';

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

      res.json(dataSources);
    } catch (error) {
      console.error('Error fetching data sources:', error);
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  }

  async createDataSource(req: AuthRequest, res: Response) {
    const { organization_id, name, type, status, description, metadata, metrics, data } = req.body;
    const userId = req.user!.id;

    if (!organization_id || !name || !type) {
      throw new BadRequestError('Organization ID, name, and type are required');
    }

    try {
      const [dataSource] = await db('data_sources')
        .insert({
          organization_id,
          name,
          type,
          status: status || 'connected',
          description,
          metadata: metadata || {},
          metrics: metrics || {},
          data: data || {},
          created_by: userId,
          last_sync: new Date().toISOString(),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      res.status(201).json(dataSource);
    } catch (error) {
      console.error('Error creating data source:', error);
      res.status(500).json({ error: 'Failed to create data source' });
    }
  }

  async updateDataSource(req: Request, res: Response) {
    const { id } = req.params;
    const updateData = req.body;

    try {
      const [dataSource] = await db('data_sources')
        .where({ id })
        .update({
          ...updateData,
          updated_at: new Date()
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

  async testConnection(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const dataSource = await db('data_sources')
        .where({ id })
        .first();

      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      // TODO: Implement actual connection testing logic based on data source type
      res.json({ success: true });
    } catch (error) {
      console.error('Error testing data source connection:', error);
      res.status(500).json({ error: 'Failed to test data source connection' });
    }
  }

  async syncData(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const dataSource = await db('data_sources')
        .where({ id })
        .first();

      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      // TODO: Implement actual data sync logic based on data source type
      res.json({ success: true });
    } catch (error) {
      console.error('Error syncing data source:', error);
      res.status(500).json({ error: 'Failed to sync data source' });
    }
  }
} 