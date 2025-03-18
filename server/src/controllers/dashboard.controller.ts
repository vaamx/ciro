import { Request, Response } from '../types/express-types';
import { Knex } from 'knex';
import { db } from '../infrastructure/database';
import { AuthRequest } from '../middleware/auth';
import { BadRequestError } from '../utils/errors';

interface Widget {
  widget_type: string;
  title: string;
  size: string | { w: number; h: number } | any;
  settings: Record<string, any>;
  position: number;
}

interface Metric {
  title: string;
  value: number;
  type: string;
  timeframe: string;
  trend?: string | Record<string, any>;
}

interface DashboardMetric {
  id: number;
  dashboard_id: number;
  title: string;
  value: number;
  type: string;
  timeframe: string;
  trend: string | Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface DashboardWidget {
  id: number;
  dashboard_id: number;
  widget_type: string;
  title: string;
  size: string;
  settings: string | Record<string, any>;
  position: number;
  created_at: Date;
  updated_at: Date;
}

interface Dashboard {
  id: number;
  name: string;
  description: string;
  team: string;
  category: string;
  created_by: number;
  organization_id: number;
  created_at: Date;
  updated_at: Date;
}

interface QueryResult {
  count: string;
}

interface DashboardQueryResult {
  id: number;
  name: string;
  description: string;
  team: string;
  category: string;
  created_by: number;
  organization_id: number;
  created_at: Date;
  updated_at: Date;
  widgets: DashboardWidget[];
  metrics: DashboardMetric[];
}

export class DashboardController {
  private readonly db: Knex;

  constructor(dbInstance?: Knex) {
    this.db = dbInstance || db;
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user.organizationId;

      // Get total users in organization
      const [userCount] = await this.db('users')
        .where({ organization_id: organizationId })
        .count('id as count');

      // Get total files
      const [fileCount] = await this.db('files')
        .where({ organization_id: organizationId })
        .count('id as count');

      // Get total storage used (in bytes)
      const [storageUsed] = await this.db('files')
        .where({ organization_id: organizationId })
        .sum('size as total');

      // Get file type distribution
      const fileTypes = await this.db('files')
        .where({ organization_id: organizationId })
        .select('file_type')
        .count('id as count')
        .groupBy('file_type');

      // Get recent activity
      const recentActivity = await this.db('files')
        .where({ organization_id: organizationId })
        .select('id', 'filename', 'file_type', 'created_at', 'uploaded_by')
        .orderBy('created_at', 'desc')
        .limit(10);

      res.json({
        users: parseInt(userCount.count as string, 10),
        files: parseInt(fileCount.count as string, 10),
        storageUsed: parseInt(storageUsed.total as string || '0', 10),
        fileTypes,
        recentActivity,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
  }

  async getActivityTimeline(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user.organizationId;
      const days = parseInt(req.query.days as string || '30', 10);

      if (isNaN(days) || days < 1 || days > 365) {
        throw new BadRequestError('Invalid days parameter. Must be between 1 and 365.');
      }

      const activity = await this.db('files')
        .where({ organization_id: organizationId })
        .whereRaw('created_at > CURRENT_DATE - INTERVAL ? DAY', [days.toString()])
        .select(
          this.db.raw('DATE(created_at) as date'),
          this.db.raw('COUNT(*) as count')
        )
        .groupByRaw('DATE(created_at)')
        .orderBy('date', 'asc');

      res.json(activity);
    } catch (error) {
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Error fetching activity timeline:', error);
        res.status(500).json({ error: 'Failed to fetch activity timeline' });
      }
    }
  }

  async getStorageUsage(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user.organizationId;

      const usage = await this.db('files')
        .where({ organization_id: organizationId })
        .select('file_type')
        .sum('size as total_size')
        .count('id as file_count')
        .groupBy('file_type');

      res.json(usage);
    } catch (error) {
      console.error('Error fetching storage usage:', error);
      res.status(500).json({ error: 'Failed to fetch storage usage' });
    }
  }

  async getUserActivity(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user.organizationId;
      const days = parseInt(req.query.days as string || '30', 10);

      if (isNaN(days) || days < 1 || days > 365) {
        throw new BadRequestError('Invalid days parameter. Must be between 1 and 365.');
      }

      const activity = await this.db('files')
        .join('users', 'files.uploaded_by', 'users.id')
        .where({ 'files.organization_id': organizationId })
        .whereRaw('files.created_at > CURRENT_DATE - INTERVAL ? DAY', [days.toString()])
        .select(
          'users.id',
          'users.name',
          'users.email',
          this.db.raw('COUNT(*) as upload_count'),
          this.db.raw('SUM(files.size) as total_size')
        )
        .groupBy('users.id', 'users.name', 'users.email')
        .orderBy('upload_count', 'desc');

      res.json(activity);
    } catch (error) {
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: 'Failed to fetch user activity' });
      }
    }
  }

  async getDashboards(req: Request, res: Response) {
    try {
      const { organization_id } = req.query;
      const userId = req.user?.id;

      if (!organization_id) {
        throw new BadRequestError('Organization ID is required');
      }

      if (!userId) {
        throw new BadRequestError('User ID is required');
      }

      // Verify user is a member of the organization
      const [membershipCheck] = await this.db('organization_members')
        .where({ 
          organization_id: organization_id,
          user_id: userId 
        })
        .count('id as count');

      if (parseInt(membershipCheck.count as string, 10) === 0) {
        console.warn('Unauthorized dashboard access attempt:', { userId, organization_id });
        return res.status(403).json({ message: 'Not authorized to access dashboards in this organization' });
      }

      // Get all dashboards with their widgets and metrics in a single query
      const dashboards = await this.db('dashboards')
        .where({ organization_id })
        .select(
          'dashboards.*',
          this.db.raw(`
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', w.id,
                    'dashboard_id', w.dashboard_id,
                    'widget_type', w.widget_type,
                    'title', w.title,
                    'size', w.size,
                    'settings', w.settings,
                    'position', w.position,
                    'created_at', w.created_at,
                    'updated_at', w.updated_at
                  )
                )
                FROM dashboard_widgets w
                WHERE w.dashboard_id = dashboards.id
              ),
              '[]'::json
            ) as widgets`
          ),
          this.db.raw(`
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', m.id,
                    'dashboard_id', m.dashboard_id,
                    'title', m.title,
                    'value', m.value,
                    'type', m.type,
                    'timeframe', m.timeframe,
                    'trend', m.trend,
                    'created_at', m.created_at,
                    'updated_at', m.updated_at
                  )
                )
                FROM metrics m
                WHERE m.dashboard_id = dashboards.id
              ),
              '[]'::json
            ) as metrics`
          )
        )
        .orderBy('dashboards.created_at', 'desc');

      // Process the results
      const processedDashboards = dashboards.map(dashboard => ({
        ...dashboard,
        widgets: dashboard.widgets.map((w: any) => ({
          ...w,
          settings: typeof w.settings === 'string' ? JSON.parse(w.settings) : w.settings,
        })),
        metrics: dashboard.metrics.map((m: any) => ({
          ...m,
          trend: typeof m.trend === 'string' ? JSON.parse(m.trend) : m.trend,
        })),
      }));

      console.log('Found dashboards:', processedDashboards.length);
      res.json(processedDashboards);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      res.status(500).json({ error: 'Failed to fetch dashboards' });
    }
  }

  async createDashboard(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        console.error('User ID not found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const { name, description, team, category, created_by, organization_id } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Dashboard name is required' });
      }

      if (!organization_id) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }

      console.log('Creating dashboard:', {
        name,
        description,
        team,
        category,
        created_by: created_by || userId,
        organization_id
      });

      const trx = await this.db.transaction();

      try {
        // Create the dashboard with the user ID as a UUID string
        const [dashboard] = await trx('dashboards')
          .insert({
            name,
            description,
            team,
            category,
            created_by: created_by || userId,
            organization_id,
          })
          .returning('*');

        console.log('Dashboard created successfully:', dashboard);

        // If widgets were provided, create them
        if (req.body.widgets && Array.isArray(req.body.widgets)) {
          for (const widget of req.body.widgets) {
            // Convert string size values to JSON objects
            let sizeValue = widget.size;
            if (typeof widget.size === 'string') {
              // Map string sizes to appropriate dimensions
              switch(widget.size) {
                case 'small':
                  sizeValue = { w: 4, h: 3 };
                  break;
                case 'medium':
                  sizeValue = { w: 6, h: 4 };
                  break;
                case 'large':
                  sizeValue = { w: 12, h: 6 };
                  break;
                default:
                  // If it's already a JSON string, keep it as is
                  try {
                    JSON.parse(widget.size);
                    sizeValue = widget.size;
                  } catch (e) {
                    // If parsing fails, use default medium size
                    sizeValue = { w: 6, h: 4 };
                  }
              }
            }
            
            // Extract the widget type from the client data or use a default
            const widgetType = widget.widget_type || widget.type || 'default';
            console.log('Widget type:', widgetType);

            // Use raw SQL to ensure widget_type is properly included
            await trx.raw(`
              INSERT INTO dashboard_widgets 
              (dashboard_id, widget_type, title, size, settings, position) 
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              dashboard.id, 
              widgetType, 
              widget.title, 
              sizeValue, 
              JSON.stringify(widget.settings), 
              widget.position || 0
            ]);
          }
          console.log(`Added ${req.body.widgets.length} widgets to dashboard:`, dashboard.id);
        }

        await trx.commit();

        // Fetch the complete dashboard with details
        const result = await this.getDashboardWithDetails(dashboard.id);
        res.status(201).json(result);
      } catch (error) {
        console.error('Transaction error:', error);
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error creating dashboard:', error);
      console.error('Request details:', {
        body: req.body,
        user: req.user,
        headers: req.headers
      });
      res.status(500).json({ 
        error: 'Failed to create dashboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getDashboardWithDetails(dashboardId: number) {
    const dashboard = await this.db('dashboards')
      .where({ id: dashboardId })
      .first();

    if (!dashboard) {
      return null;
    }

    const widgets: DashboardWidget[] = await this.db('dashboard_widgets')
      .where({ dashboard_id: dashboardId })
      .select('*');

    const metrics: DashboardMetric[] = await this.db('metrics')
      .where({ dashboard_id: dashboardId })
      .select('*');

    return {
      ...dashboard,
      widgets: widgets.map(w => ({
        ...w,
        settings: typeof w.settings === 'string' ? JSON.parse(w.settings) : w.settings,
      })),
      metrics: metrics.map(m => ({
        ...m,
        trend: typeof m.trend === 'string' ? JSON.parse(m.trend) : m.trend,
      })),
    };
  }

  async updateDashboard(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const dashboardId = req.params.id;
      
      if (!userId) {
        console.error('User ID not found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      console.log('Updating dashboard:', dashboardId, 'for user:', userId);
      const { name, description, team, category } = req.body;

      // Verify ownership and organization membership
      const [dashboardCheck] = await this.db('dashboards')
        .where('id', dashboardId)
        .andWhere('created_by', userId)
        .count<QueryResult[]>('id as count');

      if (parseInt(dashboardCheck.count, 10) === 0) {
        return res.status(404).json({ message: 'Dashboard not found' });
      }

      const organizationId = await this.db('dashboards')
        .where('id', dashboardId)
        .first('organization_id');

      // Verify user is a member of the organization
      const [membershipCheck] = await this.db('organization_members')
        .where('organization_id', organizationId.organization_id)
        .andWhere('user_id', userId)
        .count<QueryResult[]>('id as count');

      if (parseInt(membershipCheck.count, 10) === 0) {
        console.warn('Unauthorized dashboard update attempt:', { 
          userId, 
          dashboardId, 
          organizationId: organizationId.organization_id 
        });
        return res.status(403).json({ message: 'Not authorized to update this dashboard' });
      }

      // Update the dashboard
      const result = await this.db('dashboards')
        .where('id', dashboardId)
        .update({
          name,
          description,
          team,
          category,
          updated_at: this.db.fn.now()
        })
        .returning('*');

      // Fetch the complete dashboard with widgets and metrics
      const [dashboardResult] = await this.db('dashboards')
        .leftJoin('dashboard_widgets', 'dashboards.id', 'dashboard_widgets.dashboard_id')
        .leftJoin('metrics', 'dashboards.id', 'metrics.dashboard_id')
        .where('dashboards.id', dashboardId)
        .select(
          'dashboards.*',
          this.db.raw('json_agg(dashboard_widgets.*) as widgets'),
          this.db.raw('json_agg(metrics.*) as metrics')
        );

      console.log('Dashboard updated successfully:', dashboardId);

      // Parse trend JSON for each metric if it exists
      const metrics = (dashboardResult.metrics || []).map((m: any) => ({
        ...m,
        trend: typeof m.trend === 'string' ? JSON.parse(m.trend) : m.trend
      }));

      res.json({
        ...dashboardResult,
        widgets: dashboardResult.widgets || [],
        metrics
      });
    } catch (error) {
      console.error('Error updating dashboard:', error);
      console.error('Error details:', {
        user: req.user,
        params: req.params,
        body: req.body,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ message: 'Failed to update dashboard', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async deleteDashboard(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        console.error('User ID not found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dashboardId = req.params.id;
      console.log('Deleting dashboard:', dashboardId, 'for user:', userId);

      // Verify ownership
      const [ownershipCheck] = await this.db('dashboards')
        .where('id', dashboardId)
        .andWhere('created_by', userId)
        .count<QueryResult[]>('id as count');

      if (parseInt(ownershipCheck.count, 10) === 0) {
        console.warn('Unauthorized dashboard deletion attempt:', { userId, dashboardId });
        return res.status(403).json({ message: 'Not authorized to delete this dashboard' });
      }

      // Delete the dashboard (widgets will be deleted automatically due to CASCADE)
      await this.db('dashboards')
        .where('id', dashboardId)
        .andWhere('created_by', userId)
        .del();

      console.log('Dashboard deleted successfully:', dashboardId);

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      console.error('Error details:', {
        user: req.user,
        params: req.params,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ message: 'Failed to delete dashboard', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async updateDashboardWidgets(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        console.error('User ID not found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dashboardId = req.params.id;
      console.log('Updating widgets for dashboard:', dashboardId, 'for user:', userId);
      const { widgets } = req.body;

      // Verify ownership
      const [ownershipCheck] = await this.db('dashboards')
        .where('id', dashboardId)
        .andWhere('created_by', userId)
        .count<QueryResult[]>('id as count');

      if (parseInt(ownershipCheck.count, 10) === 0) {
        console.warn('Unauthorized widget update attempt:', { userId, dashboardId });
        return res.status(403).json({ message: 'Not authorized to update this dashboard' });
      }

      const client = await this.db.transaction();
      try {
        await client('dashboard_widgets')
          .where('dashboard_id', dashboardId)
          .del();

        console.log('Deleted existing widgets for dashboard:', dashboardId);

        // Insert new widgets
        for (const widget of widgets) {
          // Convert string size values to JSON objects
          let sizeValue = widget.size;
          if (typeof widget.size === 'string') {
            // Map string sizes to appropriate dimensions
            switch(widget.size) {
              case 'small':
                sizeValue = { w: 4, h: 3 };
                break;
              case 'medium':
                sizeValue = { w: 6, h: 4 };
                break;
              case 'large':
                sizeValue = { w: 12, h: 6 };
                break;
              default:
                // If it's already a JSON string, keep it as is
                try {
                  JSON.parse(widget.size);
                  sizeValue = widget.size;
                } catch (e) {
                  // If parsing fails, use default medium size
                  sizeValue = { w: 6, h: 4 };
                }
            }
          }

          // Extract the widget type from the client data or use a default
          const widgetType = widget.widget_type || widget.type || 'default';
          console.log('Widget type:', widgetType);

          // Make sure widget_type is included in the insert
          await client.raw(`
            INSERT INTO dashboard_widgets 
            (dashboard_id, widget_type, title, size, settings, position) 
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            dashboardId, 
            widgetType, 
            widget.title, 
            sizeValue, 
            JSON.stringify(widget.settings), 
            widget.position || 0
          ]);
        }

        console.log(`Added ${widgets.length} new widgets to dashboard:`, dashboardId);

        await client.commit();

        // Fetch the updated dashboard data
        const dashboard = await this.db('dashboards')
          .where('id', dashboardId)
          .first();

        if (!dashboard) {
          throw new Error('Dashboard not found after update');
        }

        // Fetch widgets
        const updatedWidgets = await this.db('dashboard_widgets')
          .where('dashboard_id', dashboardId)
          .select('*')
          .orderBy('position');

        // Fetch metrics
        const metrics = await this.db('metrics')
          .where('dashboard_id', dashboardId)
          .select('*');

        // Parse settings JSON for each widget
        const parsedWidgets = updatedWidgets.map(w => ({
          ...w,
          settings: typeof w.settings === 'string' ? JSON.parse(w.settings) : w.settings
        }));

        // Parse trend JSON for each metric
        const parsedMetrics = metrics.map(m => ({
          ...m,
          trend: typeof m.trend === 'string' ? JSON.parse(m.trend) : m.trend
        }));

        res.json({
          ...dashboard,
          widgets: parsedWidgets,
          metrics: parsedMetrics
        });
      } catch (error) {
        await client.rollback();
        console.error('Transaction error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating dashboard widgets:', error);
      console.error('Error details:', {
        user: req.user,
        params: req.params,
        body: req.body,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ message: 'Failed to update dashboard widgets', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async updateDashboardMetrics(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        console.error('User ID not found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const dashboardId = req.params.id;
      console.log('Updating metrics for dashboard:', dashboardId, 'for user:', userId);
      const { metrics } = req.body;

      // Verify ownership
      const [ownershipCheck] = await this.db('dashboards')
        .where('id', dashboardId)
        .andWhere('created_by', userId)
        .count<QueryResult[]>('id as count');

      if (parseInt(ownershipCheck.count, 10) === 0) {
        console.warn('Unauthorized metrics update attempt:', { userId, dashboardId });
        return res.status(403).json({ message: 'Not authorized to update this dashboard' });
      }

      const client = await this.db.transaction();
      try {
        // Delete existing metrics
        await client('metrics')
          .where('dashboard_id', dashboardId)
          .del();

        console.log('Deleted existing metrics for dashboard:', dashboardId);

        // Insert new metrics
        if (metrics && metrics.length > 0) {
          for (const metric of metrics) {
            await client('metrics')
              .insert({
                dashboard_id: dashboardId,
                title: metric.title,
                value: metric.value,
                type: metric.type,
                timeframe: metric.timeframe,
                trend: metric.trend ? (typeof metric.trend === 'string' ? metric.trend : JSON.stringify(metric.trend)) : null
              });
          }
        }

        console.log('Added', metrics?.length || 0, 'new metrics to dashboard:', dashboardId);

        await client.commit();

        // Fetch the updated dashboard data
        const dashboard = await this.db('dashboards')
          .where('id', dashboardId)
          .first();

        if (!dashboard) {
          throw new Error('Dashboard not found after update');
        }

        // Fetch widgets
        const widgets = await this.db('dashboard_widgets')
          .where('dashboard_id', dashboardId)
          .select('*');

        // Fetch metrics
        const updatedMetrics = await this.db('metrics')
          .where('dashboard_id', dashboardId)
          .select('*');

        // Parse trend JSON for each metric
        const parsedMetrics = updatedMetrics.map(m => ({
          ...m,
          trend: typeof m.trend === 'string' ? JSON.parse(m.trend) : m.trend
        }));

        res.json({
          ...dashboard,
          widgets: widgets || [],
          metrics: parsedMetrics
        });
      } catch (error) {
        await client.rollback();
        console.error('Transaction error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating dashboard metrics:', error);
      res.status(500).json({ message: 'Failed to update dashboard metrics' });
    }
  }
} 