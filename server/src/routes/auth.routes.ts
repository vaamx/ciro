import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { pool } from '../infrastructure/database';

const router = Router();
const authController = new AuthController(pool);

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Protected routes (authentication required)
router.get('/me', authenticate, authController.getCurrentUser);

export default router; 