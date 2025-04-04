import { Router, RequestHandler } from 'express';
import { AutomationController } from '../controllers/automation.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();
const automationController = new AutomationController();

// Get all automations for an organization
router.get('/', asyncHandler(automationController.getAutomations) as unknown as RequestHandler);

// Create a new automation
router.post('/', asyncHandler(automationController.createAutomation) as unknown as RequestHandler);

// Update an automation
router.put('/:id', asyncHandler(automationController.updateAutomation) as unknown as RequestHandler);

// Delete an automation
router.delete('/:id', asyncHandler(automationController.deleteAutomation) as unknown as RequestHandler);

// Toggle automation status
router.put('/:id/status', asyncHandler(automationController.toggleStatus) as unknown as RequestHandler);

// Run automation now
router.post('/:id/run', asyncHandler(automationController.runNow) as unknown as RequestHandler);

export default router; 