import { Router } from 'express';
import { DataSourceController } from '../controllers/data-source.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth';
import { RequestHandler } from 'express';

const router = Router();
const dataSourceController = new DataSourceController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all data sources for an organization
router.get('/', asyncHandler(dataSourceController.getDataSources) as RequestHandler);

// Create a new data source
router.post('/', asyncHandler(dataSourceController.createDataSource) as RequestHandler);

// Update a data source
router.put('/:id', asyncHandler(dataSourceController.updateDataSource) as RequestHandler);

// Delete a data source
router.delete('/:id', asyncHandler(dataSourceController.deleteDataSource) as RequestHandler);

// Test data source connection
router.post('/:id/test', asyncHandler(dataSourceController.testConnection) as RequestHandler);

// Sync data source
router.post('/:id/sync', asyncHandler(dataSourceController.syncData) as RequestHandler);

export default router; 