import { Request, Response } from 'express';
import { db } from '../infrastructure/database';
import { AuthRequest } from '../middleware/auth';

export const dataSourceController = {
  // Get all data sources for an organization
  async getDataSources(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.query;
      const userId = req.user!.id;

      if (!organization_id) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Verify user is a member of the organization
      const [membershipCheck] = await db('organization_members')
        .where({ 
          organization_id: organization_id,
          user_id: userId 
        })
        .count('id as count');

      if (parseInt(membershipCheck.count as string, 10) === 0) {
        return res.status(403).json({ message: 'Not authorized to access data sources in this organization' });
      }

      const dataSources = await db('data_sources')
        .where({ organization_id })
        .orderBy('created_at', 'desc');

      res.json(dataSources);
    } catch (error) {
      console.error('Error fetching data sources:', error);
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  },

  // Create a new data source
  async createDataSource(req: AuthRequest, res: Response) {
    try {
      const { organization_id, name, type, status, description, metadata, metrics, data } = req.body;
      const userId = req.user!.id;

      console.log('=== Starting createDataSource ===');
      console.log('Request user:', { userId, user: req.user });
      console.log('Request body:', req.body);

      if (!organization_id || !name || !type || !status) {
        const missingFields = {
          organization_id: !organization_id,
          name: !name,
          type: !type,
          status: !status
        };
        console.warn('Missing required fields:', missingFields);
        return res.status(400).json({ 
          error: 'Required fields missing',
          details: missingFields
        });
      }

      // Verify user is a member of the organization
      const [membershipCheck] = await db('organization_members')
        .where({ 
          organization_id: organization_id,
          user_id: userId 
        })
        .count('id as count');

      if (parseInt(membershipCheck.count as string, 10) === 0) {
        console.warn('User not authorized:', { user_id: userId, organization_id });
        return res.status(403).json({ message: 'Not authorized to create data sources in this organization' });
      }

      const now = new Date().toISOString();

      // Use a transaction to ensure data consistency
      const result = await db.transaction(async trx => {
        console.log('Starting database transaction');
        
        const insertData = {
          organization_id,
          name,
          type,
          status,
          description: description || null,
          metadata: metadata || {},
          metrics: metrics || {},
          data: data || {},
          created_by: userId,
          last_sync: now,
          created_at: now,
          updated_at: now
        };

        console.log('Attempting to insert data source with data:', insertData);

        // Get the query without executing it
        const query = trx('data_sources')
          .insert(insertData)
          .returning('*')
          .toQuery();

        console.log('Generated SQL:', query);

        const [newDataSource] = await trx('data_sources')
          .insert(insertData)
          .returning('*');

        console.log('Successfully created data source:', newDataSource);
        return newDataSource;
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating data source:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        message: error instanceof Error ? error.message : 'Unknown error',
        sql: error instanceof Error && 'sql' in error ? (error as any).sql : undefined,
        code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
        detail: error instanceof Error && 'detail' in error ? (error as any).detail : undefined
      });
      res.status(500).json({ 
        error: 'Failed to create data source',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  // Delete a data source
  async deleteDataSource(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Get the data source to check organization ownership
      const dataSource = await db('data_sources')
        .where({ id })
        .first();

      if (!dataSource) {
        return res.status(404).json({ message: 'Data source not found' });
      }

      // Verify user is a member of the organization
      const [membershipCheck] = await db('organization_members')
        .where({ 
          organization_id: dataSource.organization_id,
          user_id: userId 
        })
        .count('id as count');

      if (parseInt(membershipCheck.count as string, 10) === 0) {
        return res.status(403).json({ message: 'Not authorized to delete this data source' });
      }

      await db('data_sources')
        .where({ id })
        .delete();

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting data source:', error);
      res.status(500).json({ error: 'Failed to delete data source' });
    }
  },

  // Update a data source
  async updateDataSource(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user!.id;

      // Get the data source to check organization ownership
      const dataSource = await db('data_sources')
        .where({ id })
        .first();

      if (!dataSource) {
        return res.status(404).json({ message: 'Data source not found' });
      }

      // Verify user is a member of the organization
      const [membershipCheck] = await db('organization_members')
        .where({ 
          organization_id: dataSource.organization_id,
          user_id: userId 
        })
        .count('id as count');

      if (parseInt(membershipCheck.count as string, 10) === 0) {
        return res.status(403).json({ message: 'Not authorized to update this data source' });
      }

      const [updatedDataSource] = await db('data_sources')
        .where({ id })
        .update({
          ...updates,
          updated_at: db.fn.now()
        })
        .returning('*');

      res.json(updatedDataSource);
    } catch (error) {
      console.error('Error updating data source:', error);
      res.status(500).json({ error: 'Failed to update data source' });
    }
  }
}; 