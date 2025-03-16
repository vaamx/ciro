import { Router } from '../types/express-types';
import { AuthController } from '../controllers/auth.controller';
import { db } from '../infrastructure/database';

const router = Router();
const authController = new AuthController(db);

// Password reset routes
router.post('/request', authController.requestPasswordReset);
router.post('/validate-token', (req, res) => {
  // This is a placeholder for a future validateResetToken method
  res.status(501).json({ message: 'Token validation not implemented yet' });
});
router.post('/reset', authController.resetPassword);

export const resetPasswordRouter = router; 