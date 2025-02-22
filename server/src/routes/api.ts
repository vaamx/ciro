import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { dataSourceController } from '../controllers/dataSourceController';
import { RequestHandler } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Data Sources routes
router.get('/data-sources', authenticate, dataSourceController.getDataSources as RequestHandler);
router.post('/data-sources', authenticate, dataSourceController.createDataSource as RequestHandler);
router.put('/data-sources/:id', authenticate, dataSourceController.updateDataSource as RequestHandler);
router.delete('/data-sources/:id', authenticate, dataSourceController.deleteDataSource as RequestHandler);

export default router; 