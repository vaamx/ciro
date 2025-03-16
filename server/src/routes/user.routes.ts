import { Router } from '../types/express-types';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { db } from '../infrastructure/database';

const router = Router();
const authController = new AuthController(db);

// All user routes require authentication
router.use(authenticate);

// User profile routes
router.get('/profile', authController.getCurrentUser);
router.put('/profile', (req, res) => {
  // This is a placeholder for a future updateUserProfile method
  res.status(501).json({ message: 'Update user profile not implemented yet' });
});

// User management routes
router.get('/', (req, res) => {
  // This is a placeholder for a future getAllUsers method (admin only)
  res.status(501).json({ message: 'Get all users not implemented yet' });
});

router.get('/:id', (req, res) => {
  // This is a placeholder for a future getUserById method
  res.status(501).json({ message: 'Get user by ID not implemented yet' });
});

export default router; 