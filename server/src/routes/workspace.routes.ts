import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { WorkspaceService } from '../services/workspace.service';
import { BadRequestError, NotFoundError } from '../utils/errors';
import * as winston from 'winston';

const router = express.Router();
const workspaceService = WorkspaceService.getInstance();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [WorkspaceRoutes]: ${message}`;
      return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Get workspaces for current user
 * @route GET /api/workspaces
 * @access Private
 */
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const organizationId = req.query.organization_id ? Number(req.query.organization_id) : undefined;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  logger.info(`Getting workspaces for user: ${userId}`);
  const workspaces = await workspaceService.getWorkspacesByUser(userId, organizationId);
  
  res.json(workspaces);
}));

/**
 * Get workspace by ID with all charts
 * @route GET /api/workspaces/:id
 * @access Private
 */
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  logger.info(`Getting workspace with ID: ${id}`);
  const workspace = await workspaceService.getWorkspaceWithCharts(id);
  
  if (!workspace) {
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  // Check if this workspace belongs to the current user
  if (workspace.workspace.user_id !== userId) {
    logger.warn(`User ${userId} attempted to access workspace ${id} belonging to user ${workspace.workspace.user_id}`);
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  res.json(workspace);
}));

/**
 * Create a new workspace
 * @route POST /api/workspaces
 * @access Private
 */
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  const { title, description, organization_id, dashboard_id, tags } = req.body;
  
  if (!title) {
    throw new BadRequestError('Title is required');
  }
  
  logger.info(`Creating workspace: ${title}`);
  const workspace = await workspaceService.createWorkspace({
    title,
    description,
    user_id: userId,
    organization_id: organization_id ? Number(organization_id) : undefined,
    dashboard_id,
    tags
  });
  
  res.status(201).json(workspace);
}));

/**
 * Update a workspace
 * @route PUT /api/workspaces/:id
 * @access Private
 */
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  // Get existing workspace to check permissions
  const existingWorkspace = await workspaceService.getWorkspaceById(id);
  
  if (!existingWorkspace) {
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  // Check if this workspace belongs to the current user
  if (existingWorkspace.user_id !== userId) {
    logger.warn(`User ${userId} attempted to update workspace ${id} belonging to user ${existingWorkspace.user_id}`);
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  const { title, description, organization_id, dashboard_id, tags } = req.body;
  
  logger.info(`Updating workspace: ${id}`);
  const workspace = await workspaceService.updateWorkspace(id, {
    title,
    description,
    organization_id: organization_id ? Number(organization_id) : undefined,
    dashboard_id,
    tags
  });
  
  if (!workspace) {
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  res.json(workspace);
}));

/**
 * Delete a workspace
 * @route DELETE /api/workspaces/:id
 * @access Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  // Get existing workspace to check permissions
  const existingWorkspace = await workspaceService.getWorkspaceById(id);
  
  if (!existingWorkspace) {
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  // Check if this workspace belongs to the current user
  if (existingWorkspace.user_id !== userId) {
    logger.warn(`User ${userId} attempted to delete workspace ${id} belonging to user ${existingWorkspace.user_id}`);
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  logger.info(`Deleting workspace: ${id}`);
  const deleted = await workspaceService.deleteWorkspace(id);
  
  if (!deleted) {
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  res.status(204).end();
}));

/**
 * Add a chart to a workspace
 * @route POST /api/workspaces/:id/charts
 * @access Private
 */
router.post('/:id/charts', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  // Get existing workspace to check permissions
  const existingWorkspace = await workspaceService.getWorkspaceById(id);
  
  if (!existingWorkspace) {
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  // Check if this workspace belongs to the current user
  if (existingWorkspace.user_id !== userId) {
    logger.warn(`User ${userId} attempted to add chart to workspace ${id} belonging to user ${existingWorkspace.user_id}`);
    throw new NotFoundError(`Workspace with ID ${id} not found`);
  }
  
  const { title, chart_type, data_source_id, config, position } = req.body;
  
  if (!chart_type || !config) {
    throw new BadRequestError('Chart type and config are required');
  }
  
  logger.info(`Adding chart to workspace: ${id}`);
  const chart = await workspaceService.addChart({
    workspace_id: id,
    title,
    chart_type,
    data_source_id,
    config,
    position
  });
  
  res.status(201).json(chart);
}));

/**
 * Update a chart
 * @route PUT /api/workspaces/:workspaceId/charts/:chartId
 * @access Private
 */
router.put('/:workspaceId/charts/:chartId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { workspaceId, chartId } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  // Get existing workspace to check permissions
  const existingWorkspace = await workspaceService.getWorkspaceById(workspaceId);
  
  if (!existingWorkspace) {
    throw new NotFoundError(`Workspace with ID ${workspaceId} not found`);
  }
  
  // Check if this workspace belongs to the current user
  if (existingWorkspace.user_id !== userId) {
    logger.warn(`User ${userId} attempted to update chart in workspace ${workspaceId} belonging to user ${existingWorkspace.user_id}`);
    throw new NotFoundError(`Workspace with ID ${workspaceId} not found`);
  }
  
  const { title, chart_type, data_source_id, config, position } = req.body;
  
  logger.info(`Updating chart: ${chartId}`);
  const chart = await workspaceService.updateChart(chartId, {
    title,
    chart_type,
    data_source_id,
    config,
    position
  });
  
  if (!chart) {
    throw new NotFoundError(`Chart with ID ${chartId} not found`);
  }
  
  res.json(chart);
}));

/**
 * Delete a chart
 * @route DELETE /api/workspaces/:workspaceId/charts/:chartId
 * @access Private
 */
router.delete('/:workspaceId/charts/:chartId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { workspaceId, chartId } = req.params;
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }
  
  // Get existing workspace to check permissions
  const existingWorkspace = await workspaceService.getWorkspaceById(workspaceId);
  
  if (!existingWorkspace) {
    throw new NotFoundError(`Workspace with ID ${workspaceId} not found`);
  }
  
  // Check if this workspace belongs to the current user
  if (existingWorkspace.user_id !== userId) {
    logger.warn(`User ${userId} attempted to delete chart from workspace ${workspaceId} belonging to user ${existingWorkspace.user_id}`);
    throw new NotFoundError(`Workspace with ID ${workspaceId} not found`);
  }
  
  logger.info(`Deleting chart: ${chartId}`);
  const deleted = await workspaceService.deleteChart(chartId);
  
  if (!deleted) {
    throw new NotFoundError(`Chart with ID ${chartId} not found`);
  }
  
  res.status(204).end();
}));

export default router; 