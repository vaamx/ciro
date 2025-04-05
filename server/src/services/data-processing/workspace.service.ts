import { Injectable } from '@nestjs/common';
import { db } from '../../config/database';
import { createServiceLogger } from '../../utils/logger-factory';

/**
 * Workspace object interface
 */
export interface Workspace {
  id?: string;
  title: string;
  description?: string;
  user_id: string;
  organization_id?: number;
  dashboard_id?: string;
  tags?: string[];
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Chart within a workspace interface
 */
export interface WorkspaceChart {
  id?: string;
  workspace_id: string;
  title?: string;
  chart_type: string;
  data_source_id?: string;
  config: any;
  position?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Service for managing workspaces and their charts
 */
@Injectable()
export class WorkspaceService {
  private logger = createServiceLogger('WorkspaceService');
  

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  

  /**
   * Create a new workspace
   */
  async createWorkspace(workspace: Workspace): Promise<Workspace> {
    try {
      // Format tags as JSON safely
      let tagsJson = '[]';
      try {
        tagsJson = workspace.tags && Array.isArray(workspace.tags) 
          ? JSON.stringify(workspace.tags) 
          : '[]';
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error stringifying tags: ${errorMessage}`);
        tagsJson = '[]';
      }

      const formattedWorkspace = {
        ...workspace,
        tags: tagsJson
      };

      this.logger.info(`Creating workspace: ${workspace.title}`);
      const [newWorkspace] = await db('workspaces')
        .insert(formattedWorkspace)
        .returning('*');
      
      if (!newWorkspace) {
        throw new Error('Failed to create workspace - no data returned');
      }
      
      // Parse the tags back to an array safely
      let parsedTags = [];
      try {
        parsedTags = newWorkspace.tags && typeof newWorkspace.tags === 'string'
          ? JSON.parse(newWorkspace.tags)
          : [];
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing tags: ${errorMessage}`);
      }
      
      return {
        ...newWorkspace,
        tags: parsedTags
      };
    } catch (error) {
      this.logger.error(`Error creating workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get workspaces by user ID
   */
  async getWorkspacesByUser(userId: string, organizationId?: number): Promise<Workspace[]> {
    try {
      this.logger.info(`Getting workspaces for user: ${userId}`);
      
      let query = db('workspaces').where('user_id', userId);
      
      // Add organization filter if provided
      if (organizationId) {
        query = query.where('organization_id', organizationId);
      }
      
      const workspaces = await query.orderBy('updated_at', 'desc');
      
      if (!workspaces || !Array.isArray(workspaces)) {
        return [];
      }
      
      // Parse tags for each workspace safely
      return workspaces.map(workspace => {
        let parsedTags = [];
        try {
          parsedTags = workspace.tags && typeof workspace.tags === 'string'
            ? JSON.parse(workspace.tags)
            : [];
        } catch (jsonError: unknown) {
          const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
          this.logger.warn(`Error parsing tags for workspace ${workspace.id}: ${errorMessage}`);
        }
        
        return {
          ...workspace,
          tags: parsedTags
        };
      });
    } catch (error) {
      this.logger.error(`Error getting workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get workspace by ID
   */
  async getWorkspaceById(id: string): Promise<Workspace | null> {
    try {
      this.logger.info(`Getting workspace by ID: ${id}`);
      const workspace = await db('workspaces').where('id', id).first();
      
      if (!workspace) {
        return null;
      }
      
      // Parse tags safely
      let parsedTags = [];
      try {
        parsedTags = workspace.tags && typeof workspace.tags === 'string'
          ? JSON.parse(workspace.tags)
          : [];
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing tags for workspace ${id}: ${errorMessage}`);
      }
      
      return {
        ...workspace,
        tags: parsedTags
      };
    } catch (error) {
      this.logger.error(`Error getting workspace by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update a workspace
   */
  async updateWorkspace(id: string, workspace: Partial<Workspace>): Promise<Workspace | null> {
    try {
      this.logger.info(`Updating workspace: ${id}`);
      
      // Format tags as JSON if provided safely
      const updateData: any = { ...workspace };
      
      if (workspace.tags) {
        try {
          updateData.tags = Array.isArray(workspace.tags) 
            ? JSON.stringify(workspace.tags) 
            : '[]';
        } catch (jsonError: unknown) {
          const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
          this.logger.warn(`Error stringifying tags during update: ${errorMessage}`);
          updateData.tags = '[]';
        }
      }
      
      // Always update the updated_at timestamp
      updateData.updated_at = new Date();
      
      const [updatedWorkspace] = await db('workspaces')
        .where('id', id)
        .update(updateData)
        .returning('*');
      
      if (!updatedWorkspace) {
        return null;
      }
      
      // Parse tags safely
      let parsedTags = [];
      try {
        parsedTags = updatedWorkspace.tags && typeof updatedWorkspace.tags === 'string'
          ? JSON.parse(updatedWorkspace.tags)
          : [];
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing tags after update for workspace ${id}: ${errorMessage}`);
      }
      
      return {
        ...updatedWorkspace,
        tags: parsedTags
      };
    } catch (error) {
      this.logger.error(`Error updating workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(id: string): Promise<boolean> {
    try {
      this.logger.info(`Deleting workspace: ${id}`);
      
      // Cascade delete will automatically remove associated charts
      const deleted = await db('workspaces')
        .where('id', id)
        .delete();
      
      return deleted > 0;
    } catch (error) {
      this.logger.error(`Error deleting workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Add a chart to a workspace
   */
  async addChart(chart: WorkspaceChart): Promise<WorkspaceChart> {
    try {
      this.logger.info(`Adding chart to workspace: ${chart.workspace_id}`);
      
      // Convert config and position to JSON safely
      let configJson = '{}';
      let positionJson = '{}';
      
      try {
        configJson = chart.config && typeof chart.config === 'object'
          ? JSON.stringify(chart.config)
          : typeof chart.config === 'string' ? chart.config : '{}';
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error stringifying config: ${errorMessage}`);
      }
      
      try {
        positionJson = chart.position && typeof chart.position === 'object'
          ? JSON.stringify(chart.position)
          : '{}';
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error stringifying position: ${errorMessage}`);
      }
      
      const formattedChart = {
        ...chart,
        config: configJson,
        position: positionJson
      };
      
      const [newChart] = await db('workspace_charts')
        .insert(formattedChart)
        .returning('*');
      
      if (!newChart) {
        throw new Error('Failed to create chart - no data returned');
      }
      
      // Parse JSON fields back to objects safely
      let parsedConfig = {};
      let parsedPosition = {};
      
      try {
        parsedConfig = newChart.config && typeof newChart.config === 'string'
          ? JSON.parse(newChart.config)
          : newChart.config || {};
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing config: ${errorMessage}`);
      }
      
      try {
        parsedPosition = newChart.position && typeof newChart.position === 'string'
          ? JSON.parse(newChart.position)
          : {};
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing position: ${errorMessage}`);
      }
      
      return {
        ...newChart,
        config: parsedConfig,
        position: parsedPosition
      };
    } catch (error) {
      this.logger.error(`Error adding chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get all charts for a workspace
   */
  async getChartsByWorkspace(workspaceId: string): Promise<WorkspaceChart[]> {
    try {
      this.logger.info(`Getting charts for workspace: ${workspaceId}`);
      
      const charts = await db('workspace_charts')
        .where('workspace_id', workspaceId)
        .orderBy('created_at', 'asc');
      
      if (!charts || !Array.isArray(charts)) {
        return [];
      }
      
      // Parse JSON fields safely
      return charts.map(chart => {
        let parsedConfig = {};
        let parsedPosition = {};
        
        try {
          parsedConfig = chart.config && typeof chart.config === 'string'
            ? JSON.parse(chart.config)
            : chart.config || {};
        } catch (jsonError: unknown) {
          const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
          this.logger.warn(`Error parsing config for chart ${chart.id}: ${errorMessage}`);
        }
        
        try {
          parsedPosition = chart.position && typeof chart.position === 'string'
            ? JSON.parse(chart.position)
            : {};
        } catch (jsonError: unknown) {
          const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
          this.logger.warn(`Error parsing position for chart ${chart.id}: ${errorMessage}`);
        }
        
        return {
          ...chart,
          config: parsedConfig,
          position: parsedPosition
        };
      });
    } catch (error) {
      this.logger.error(`Error getting charts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update a chart
   */
  async updateChart(id: string, chart: Partial<WorkspaceChart>): Promise<WorkspaceChart | null> {
    try {
      this.logger.info(`Updating chart: ${id}`);
      
      // Format JSON fields safely
      const updateData: any = { ...chart };
      
      if (chart.config) {
        try {
          updateData.config = typeof chart.config === 'object' 
            ? JSON.stringify(chart.config) 
            : typeof chart.config === 'string' ? chart.config : '{}';
        } catch (jsonError: unknown) {
          const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
          this.logger.warn(`Error stringifying config during update: ${errorMessage}`);
          updateData.config = '{}';
        }
      }
      
      if (chart.position) {
        try {
          updateData.position = typeof chart.position === 'object'
            ? JSON.stringify(chart.position)
            : '{}';
        } catch (jsonError: unknown) {
          const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
          this.logger.warn(`Error stringifying position during update: ${errorMessage}`);
          updateData.position = '{}';
        }
      }
      
      // Always update the updated_at timestamp
      updateData.updated_at = new Date();
      
      const [updatedChart] = await db('workspace_charts')
        .where('id', id)
        .update(updateData)
        .returning('*');
      
      if (!updatedChart) {
        return null;
      }
      
      // Parse JSON fields back to objects safely
      let parsedConfig = {};
      let parsedPosition = {};
      
      try {
        parsedConfig = updatedChart.config && typeof updatedChart.config === 'string'
          ? JSON.parse(updatedChart.config)
          : updatedChart.config || {};
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing config after update for chart ${id}: ${errorMessage}`);
      }
      
      try {
        parsedPosition = updatedChart.position && typeof updatedChart.position === 'string'
          ? JSON.parse(updatedChart.position)
          : {};
      } catch (jsonError: unknown) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
        this.logger.warn(`Error parsing position after update for chart ${id}: ${errorMessage}`);
      }
      
      return {
        ...updatedChart,
        config: parsedConfig,
        position: parsedPosition
      };
    } catch (error) {
      this.logger.error(`Error updating chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Delete a chart
   */
  async deleteChart(id: string): Promise<boolean> {
    try {
      this.logger.info(`Deleting chart: ${id}`);
      
      const deleted = await db('workspace_charts')
        .where('id', id)
        .delete();
      
      return deleted > 0;
    } catch (error) {
      this.logger.error(`Error deleting chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get a complete workspace with all its charts
   */
  async getWorkspaceWithCharts(id: string): Promise<{workspace: Workspace, charts: WorkspaceChart[]} | null> {
    try {
      this.logger.info(`Getting complete workspace with charts: ${id}`);
      
      // Get workspace
      const workspace = await this.getWorkspaceById(id);
      if (!workspace) {
        return null;
      }
      
      // Get charts
      const charts = await this.getChartsByWorkspace(id);
      
      return {
        workspace,
        charts
      };
    } catch (error) {
      this.logger.error(`Error getting workspace with charts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 