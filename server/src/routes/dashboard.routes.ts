import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication
router.use(authenticate);

// Get all dashboards for the current user
router.get('/', dashboardController.getDashboards.bind(dashboardController));

// Create a new dashboard
router.post('/', dashboardController.createDashboard.bind(dashboardController));

// Update a dashboard
router.put('/:id', dashboardController.updateDashboard.bind(dashboardController));

// Delete a dashboard
router.delete('/:id', dashboardController.deleteDashboard.bind(dashboardController));

// Update dashboard widgets
router.put('/:id/widgets', dashboardController.updateDashboardWidgets.bind(dashboardController));

// Update dashboard metrics
router.put('/:id/metrics', dashboardController.updateDashboardMetrics.bind(dashboardController));

export default router; 