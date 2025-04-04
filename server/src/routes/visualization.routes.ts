import express from 'express';
import { VisualizationController } from '../controllers/visualization.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();
const visualizationController = new VisualizationController();

/**
 * Route to generate a visualization from a data source
 * @route POST /api/visualizations/generate/:dataSourceId
 * @param {string} dataSourceId - The ID of the data source
 * @access Private - Requires authentication
 */
router.post(
  '/generate/:dataSourceId',
  authenticate,
  asyncHandler(visualizationController.generateVisualization.bind(visualizationController))
);

export default router; 