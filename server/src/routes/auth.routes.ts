import { Router } from '../types/express-types';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { db } from '../infrastructure/database';

const router = Router();
const authController = new AuthController(db);

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

// Protected routes (require authentication)
router.use(authenticate);
router.get('/me', authController.getCurrentUser);
router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

export default router; 