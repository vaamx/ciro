import { Router } from 'express';
import { AutomationController } from '../controllers/automation.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const automationController = new AutomationController();

// Get all automations for an organization
router.get('/', asyncHandler(automationController.getAutomations));

// Create a new automation
router.post('/', asyncHandler(automationController.createAutomation));

// Update an automation
router.put('/:id', asyncHandler(automationController.updateAutomation));

// Delete an automation
router.delete('/:id', asyncHandler(automationController.deleteAutomation));

// Toggle automation status
router.put('/:id/status', asyncHandler(automationController.toggleStatus));

// Run automation now
router.post('/:id/run', asyncHandler(automationController.runNow));

export default router; 