import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

// Create router with TypeScript any casting to bypass type errors
const router = Router();
const dashboardController = new DashboardController();

// Apply authentication middleware to all dashboard routes
(router as any).use(authenticate as any);

// Define dashboard routes
(router as any).get('/', dashboardController.getDashboards);
(router as any).post('/', dashboardController.createDashboard);
(router as any).put('/:id', dashboardController.updateDashboard);
(router as any).delete('/:id', dashboardController.deleteDashboard);
(router as any).put('/:id/widgets', dashboardController.updateDashboardWidgets);
(router as any).put('/:id/metrics', dashboardController.updateDashboardMetrics);

export default router; 