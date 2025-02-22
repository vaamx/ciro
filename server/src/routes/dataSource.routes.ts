import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { dataSourceController } from '../controllers/dataSourceController';
import { RequestHandler } from 'express';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes
router.get('/', dataSourceController.getDataSources as RequestHandler);
router.post('/', dataSourceController.createDataSource as RequestHandler);
router.delete('/:id', dataSourceController.deleteDataSource as RequestHandler);
router.put('/:id', dataSourceController.updateDataSource as RequestHandler);

export default router; 