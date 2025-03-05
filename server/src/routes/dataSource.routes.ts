import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { DataSourceController } from '../controllers/dataSource.controller';
import { RequestHandler } from 'express';

const router = Router();
const dataSourceController = new DataSourceController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes
router.get('/', dataSourceController.getDataSources as RequestHandler);
router.post('/', dataSourceController.createDataSource as RequestHandler);
router.delete('/:id', dataSourceController.deleteDataSource as RequestHandler);
router.put('/:id', dataSourceController.updateDataSource as RequestHandler);

export default router; 