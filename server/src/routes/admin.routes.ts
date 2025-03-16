import { Router, Request, Response } from '../types/express-types';
import { authenticate } from '../middleware/auth';
import { db } from '../infrastructure/database';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// Middleware to check if user is admin
const isAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// Apply admin check to all routes
router.use(isAdmin);

// Admin routes
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'name', 'role', 'email_verified', 'created_at', 'updated_at')
      .orderBy('created_at', 'desc');
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin".' });
    }
    
    await db('users')
      .where({ id })
      .update({ 
        role,
        updated_at: db.fn.now()
      });
    
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router; 