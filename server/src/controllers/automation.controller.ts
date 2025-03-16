import { Request, Response } from '../types/express-types';
import { db } from '../infrastructure/database';
import { BadRequestError } from '../utils/errors';

export class AutomationController {
  async getAutomations(req: Request, res: Response) {
    const { organization_id } = req.query;

    if (!organization_id) {
      throw new BadRequestError('Organization ID is required');
    }

    try {
      const automations = await db('automations')
        .where({ organization_id })
        .select('*');

      res.json(automations);
    } catch (error) {
      console.error('Error fetching automations:', error);
      res.status(500).json({ error: 'Failed to fetch automations' });
    }
  }

  async createAutomation(req: Request, res: Response) {
    const { organization_id, name, description, trigger, actions } = req.body;

    if (!organization_id || !name || !trigger || !actions) {
      throw new BadRequestError('Organization ID, name, trigger, and actions are required');
    }

    try {
      const [automation] = await db('automations')
        .insert({
          organization_id,
          name,
          description,
          trigger,
          actions,
          status: 'inactive',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      res.status(201).json(automation);
    } catch (error) {
      console.error('Error creating automation:', error);
      res.status(500).json({ error: 'Failed to create automation' });
    }
  }

  async getAutomation(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const automation = await db('automations')
        .where({ id })
        .first();

      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      res.json(automation);
    } catch (error) {
      console.error('Error fetching automation:', error);
      res.status(500).json({ error: 'Failed to fetch automation' });
    }
  }

  async updateAutomation(req: Request, res: Response) {
    const { id } = req.params;
    const updateData = req.body;

    try {
      const [automation] = await db('automations')
        .where({ id })
        .update({
          ...updateData,
          updated_at: new Date()
        })
        .returning('*');

      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      res.json(automation);
    } catch (error) {
      console.error('Error updating automation:', error);
      res.status(500).json({ error: 'Failed to update automation' });
    }
  }

  async deleteAutomation(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const deleted = await db('automations')
        .where({ id })
        .delete();

      if (!deleted) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting automation:', error);
      res.status(500).json({ error: 'Failed to delete automation' });
    }
  }

  async toggleStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      throw new BadRequestError('Active status must be a boolean');
    }

    try {
      const [automation] = await db('automations')
        .where({ id })
        .update({
          status: active ? 'active' : 'inactive',
          updated_at: new Date()
        })
        .returning('*');

      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      res.json(automation);
    } catch (error) {
      console.error('Error toggling automation status:', error);
      res.status(500).json({ error: 'Failed to toggle automation status' });
    }
  }

  async runNow(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const automation = await db('automations')
        .where({ id })
        .first();

      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      // TODO: Implement actual automation execution logic
      res.json({ success: true });
    } catch (error) {
      console.error('Error running automation:', error);
      res.status(500).json({ error: 'Failed to run automation' });
    }
  }
} 