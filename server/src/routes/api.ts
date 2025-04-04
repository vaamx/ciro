import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { dataSourceController } from '../controllers/dataSourceController';

// Create an Express-compatible handler from an async function
// This properly types the handler and handles Promise rejections
function createHandler(handler: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

const router = Router();

// Data Sources routes
// @ts-ignore - Express handler type compatibility
router.get('/data-sources', authenticate, createHandler(dataSourceController.getDataSources));
// @ts-ignore - Express handler type compatibility
router.post('/data-sources', authenticate, createHandler(dataSourceController.createDataSource));
// @ts-ignore - Express handler type compatibility
router.put('/data-sources/:id', authenticate, createHandler(dataSourceController.updateDataSource));
// @ts-ignore - Express handler type compatibility
router.delete('/data-sources/:id', authenticate, createHandler(dataSourceController.deleteDataSource));

export default router; 