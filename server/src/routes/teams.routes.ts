import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../infrastructure/database';
import { Request, Response } from 'express';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all teams (optionally filtered by organization)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { organization_id } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let query = db('teams')
      .select('teams.*');
    
    // If organization_id is provided, filter by it
    if (organization_id) {
      query = query.where('teams.organization_id', organization_id);
    } else {
      // Otherwise, get teams from organizations the user is a member of
      query = query
        .join('organization_members', 'teams.organization_id', 'organization_members.organization_id')
        .where('organization_members.user_id', userId);
    }

    const teams = await query;
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get a specific team by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the team and check if user has access to it
    const team = await db('teams')
      .join('organization_members', 'teams.organization_id', 'organization_members.organization_id')
      .where('teams.id', id)
      .andWhere('organization_members.user_id', userId)
      .select('teams.*')
      .first();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create a new team
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, organization_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!name || !organization_id) {
      return res.status(400).json({ error: 'Name and organization_id are required' });
    }

    // Check if user is a member of the organization
    const member = await db('organization_members')
      .where({
        organization_id,
        user_id: userId,
      })
      .first();

    if (!member) {
      return res.status(403).json({ error: 'Not authorized to create teams in this organization' });
    }

    // Create the team
    const [team] = await db('teams')
      .insert({
        name,
        description,
        organization_id,
        settings: {},
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update a team
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the team to check if user has access to it
    const team = await db('teams')
      .where('id', id)
      .first();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is a member of the organization
    const member = await db('organization_members')
      .where({
        organization_id: team.organization_id,
        user_id: userId,
      })
      .first();

    if (!member) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Update the team
    const [updatedTeam] = await db('teams')
      .where('id', id)
      .update({
        name: name || team.name,
        description: description !== undefined ? description : team.description,
        updated_at: db.fn.now(),
      })
      .returning('*');

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete a team
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the team to check if user has access to it
    const team = await db('teams')
      .where('id', id)
      .first();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is a member of the organization
    const member = await db('organization_members')
      .where({
        organization_id: team.organization_id,
        user_id: userId,
      })
      .first();

    if (!member) {
      return res.status(403).json({ error: 'Not authorized to delete this team' });
    }

    // Delete the team
    await db('teams')
      .where('id', id)
      .delete();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router; 