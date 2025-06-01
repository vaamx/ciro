import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { 
  CreateDashboardDto, 
  UpdateDashboardDto, 
  WidgetDto, 
  MetricDto, 
  DashboardResponseDto 
} from './dto/dashboard.dto';
import { users } from '../../core/database/prisma-types';

// Define interfaces for the models we need
interface DashboardModel {
  id: number;
  name: string;
  description?: string;
  team?: string;
  category?: string;
  created_by?: number;
  organization_id: number;
  created_at: Date;
  updated_at: Date;
  widgets: DashboardWidgetModel[];
  metrics: MetricModel[];
}

interface DashboardWidgetModel {
  id: number;
  dashboard_id: number;
  widget_type: string;
  title?: string;
  size?: string;
  settings?: any;
  position?: any;
  created_at: Date;
  updated_at: Date;
}

interface MetricModel {
  id: number;
  dashboard_id: number;
  title: string;
  value?: string;
  type?: string;
  timeframe?: string;
  trend?: any;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all dashboards for an organization
   */
  async getDashboards(user: users, organizationId: number): Promise<DashboardResponseDto[]> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      // Verify user is a member of the organization
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: organizationId,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard access attempt:', { userId: user.id, organizationId });
        throw new ForbiddenException('Not authorized to access dashboards in this organization');
      }

      // Get all dashboards with their widgets and metrics
      const dashboards = await this.prisma.dashboards.findMany({
        where: { organization_id: organizationId },
        include: {
          dashboard_widgets: true,
          metrics: true
        }
      });

      // Process and return the results
      return dashboards.map((dashboard) => ({
        id: dashboard.id.toString(),
        name: dashboard.name,
        description: dashboard.description || undefined,
        team: dashboard.team || undefined,
        category: dashboard.category || undefined,
        created_by: dashboard.created_by.toString(),
        organization_id: dashboard.organization_id,
        created_at: dashboard.created_at,
        updated_at: dashboard.updated_at,
        widgets: dashboard.dashboard_widgets.map((widget) => ({
          id: widget.id.toString(),
          widget_type: widget.widget_type as any,
          title: widget.title,
          size: widget.size as any,
          position: widget.position as any,
          settings: widget.settings as any || {}
        })),
        metrics: dashboard.metrics.map((metric) => ({
          id: metric.id.toString(),
          title: metric.title,
          value: parseFloat(metric.value || '0'),
          type: metric.type as any,
          timeframe: metric.timeframe as any,
          trend: metric.trend as any || undefined
        }))
      }));
    } catch (error) {
      this.logger.error(`Error fetching dashboards for organization ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get a dashboard by ID with its widgets and metrics
   */
  async getDashboardById(user: users, dashboardId: string | number): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const id = typeof dashboardId === 'string' ? parseInt(dashboardId, 10) : dashboardId;
      
      const dashboard = await this.prisma.dashboards.findUnique({
        where: { id },
        include: {
          dashboard_widgets: true,
          metrics: true
        }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: dashboard.organization_id,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard access attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to access this dashboard');
      }

      return {
        id: dashboard.id.toString(),
        name: dashboard.name,
        description: dashboard.description || undefined,
        team: dashboard.team || undefined,
        category: dashboard.category || undefined,
        created_by: dashboard.created_by.toString(),
        organization_id: dashboard.organization_id,
        created_at: dashboard.created_at,
        updated_at: dashboard.updated_at,
        widgets: dashboard.dashboard_widgets.map((widget) => ({
          id: widget.id.toString(),
          widget_type: widget.widget_type as any,
          title: widget.title,
          size: widget.size as any,
          position: widget.position as any,
          settings: widget.settings as any || {}
        })),
        metrics: dashboard.metrics.map((metric) => ({
          id: metric.id.toString(),
          title: metric.title,
          value: parseFloat(metric.value || '0'),
          type: metric.type as any,
          timeframe: metric.timeframe as any,
          trend: metric.trend as any || undefined
        }))
      };
    } catch (error) {
      this.logger.error(`Error fetching dashboard ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create a new dashboard
   */
  async createDashboard(user: users, createDashboardDto: CreateDashboardDto): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const { name, description, team, category, organization_id } = createDashboardDto;

      // Default to the user's organization if not provided
      let orgId = organization_id;
      if (!orgId) {
        // Get the user's default organization
        const userOrg = await this.prisma.organization_members.findFirst({
          where: { user_id: user.id },
          select: { organizations: { select: { id: true } } }
        });
        
        if (userOrg) {
          orgId = userOrg.organizations.id;
        } else {
          throw new BadRequestException('Organization ID is required');
        }
      }

      // Verify user is a member of the organization
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: orgId,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard creation attempt:', { userId: user.id, orgId });
        throw new ForbiddenException('Not authorized to create dashboards in this organization');
      }

      // Create the dashboard
      const dashboard = await this.prisma.dashboards.create({
        data: {
          name,
          description: description || null,
          team: team || null,
          category: category || null,
          created_by: user.id,
          organization_id: orgId,
          updated_at: new Date()
        },
        include: {
          dashboard_widgets: true,
          metrics: true
        }
      });

      return {
        id: dashboard.id.toString(),
        name: dashboard.name,
        description: dashboard.description || undefined,
        team: dashboard.team || undefined,
        category: dashboard.category || undefined,
        created_by: dashboard.created_by.toString(),
        organization_id: dashboard.organization_id,
        created_at: dashboard.created_at,
        updated_at: dashboard.updated_at,
        widgets: dashboard.dashboard_widgets.map((widget) => ({
          id: widget.id.toString(),
          widget_type: widget.widget_type as any,
          title: widget.title,
          size: widget.size as any,
          position: widget.position as any,
          settings: widget.settings as any || {}
        })),
        metrics: dashboard.metrics.map((metric) => ({
          id: metric.id.toString(),
          title: metric.title,
          value: parseFloat(metric.value || '0'),
          type: metric.type as any,
          timeframe: metric.timeframe as any,
          trend: metric.trend as any || undefined
        }))
      };
    } catch (error) {
      this.logger.error(`Error creating dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update an existing dashboard
   */
  async updateDashboard(user: users, dashboardId: string | number, updateDashboardDto: UpdateDashboardDto): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const id = typeof dashboardId === 'string' ? parseInt(dashboardId, 10) : dashboardId;
      
      const dashboard = await this.prisma.dashboards.findUnique({
        where: { id }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: dashboard.organization_id,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard update attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to update this dashboard');
      }

      // Update the dashboard
      const updatedDashboard = await this.prisma.dashboards.update({
        where: { id },
        data: {
          ...updateDashboardDto,
          updated_at: new Date()
        },
        include: {
          dashboard_widgets: true,
          metrics: true
        }
      });

      return {
        id: updatedDashboard.id.toString(),
        name: updatedDashboard.name,
        description: updatedDashboard.description || undefined,
        team: updatedDashboard.team || undefined,
        category: updatedDashboard.category || undefined,
        created_by: updatedDashboard.created_by.toString(),
        organization_id: updatedDashboard.organization_id,
        created_at: updatedDashboard.created_at,
        updated_at: updatedDashboard.updated_at,
        widgets: updatedDashboard.dashboard_widgets.map((widget) => ({
          id: widget.id.toString(),
          widget_type: widget.widget_type as any,
          title: widget.title,
          size: widget.size as any,
          position: widget.position as any,
          settings: widget.settings as any || {}
        })),
        metrics: updatedDashboard.metrics.map((metric) => ({
          id: metric.id.toString(),
          title: metric.title,
          value: parseFloat(metric.value || '0'),
          type: metric.type as any,
          timeframe: metric.timeframe as any,
          trend: metric.trend as any || undefined
        }))
      };
    } catch (error) {
      this.logger.error(`Error updating dashboard ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Delete a dashboard
   */
  async deleteDashboard(user: users, dashboardId: string | number): Promise<void> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const id = typeof dashboardId === 'string' ? parseInt(dashboardId, 10) : dashboardId;
      
      const dashboard = await this.prisma.dashboards.findUnique({
        where: { id }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: dashboard.organization_id,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard deletion attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to delete this dashboard');
      }

      // Delete associated widgets and metrics first
      await this.prisma.dashboard_widgets.deleteMany({
        where: { dashboard_id: dashboard.id }
      });

      await this.prisma.metrics.deleteMany({
        where: { dashboard_id: dashboard.id }
      });

      // Delete the dashboard
      await this.prisma.dashboards.delete({
        where: { id }
      });

      this.logger.log(`Dashboard ${dashboardId} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting dashboard ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update dashboard widgets
   */
  async updateDashboardWidgets(user: users, dashboardId: string | number, widgets: WidgetDto[]): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const id = typeof dashboardId === 'string' ? parseInt(dashboardId, 10) : dashboardId;
      
      const dashboard = await this.prisma.dashboards.findUnique({
        where: { id }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: dashboard.organization_id,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard widget update attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to update widgets for this dashboard');
      }

      // Delete existing widgets
      await this.prisma.dashboard_widgets.deleteMany({
        where: { dashboard_id: dashboard.id }
      });

      // Create new widgets
      if (widgets.length > 0) {
        await this.prisma.dashboard_widgets.createMany({
          data: widgets.map((widget) => ({
            dashboard_id: dashboard.id,
            widget_type: widget.widget_type,
            title: widget.title,
            size: widget.size,
            position: widget.position,
            settings: widget.settings,
            updated_at: new Date()
          }))
        });
      }

      // Get updated dashboard with widgets and metrics
      const updatedDashboard = await this.prisma.dashboards.findUnique({
        where: { id },
        include: {
          dashboard_widgets: true,
          metrics: true
        }
      });

      return {
        id: updatedDashboard!.id.toString(),
        name: updatedDashboard!.name,
        description: updatedDashboard!.description || undefined,
        team: updatedDashboard!.team || undefined,
        category: updatedDashboard!.category || undefined,
        created_by: updatedDashboard!.created_by.toString(),
        organization_id: updatedDashboard!.organization_id,
        created_at: updatedDashboard!.created_at,
        updated_at: updatedDashboard!.updated_at,
        widgets: updatedDashboard!.dashboard_widgets.map((widget) => ({
          id: widget.id.toString(),
          widget_type: widget.widget_type as any,
          title: widget.title,
          size: widget.size as any,
          position: widget.position as any,
          settings: widget.settings as any || {}
        })),
        metrics: updatedDashboard!.metrics.map((metric) => ({
          id: metric.id.toString(),
          title: metric.title,
          value: parseFloat(metric.value || '0'),
          type: metric.type as any,
          timeframe: metric.timeframe as any,
          trend: metric.trend as any || undefined
        }))
      };
    } catch (error) {
      this.logger.error(`Error updating dashboard widgets ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update dashboard metrics
   */
  async updateDashboardMetrics(user: users, dashboardId: string | number, metrics: MetricDto[]): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const id = typeof dashboardId === 'string' ? parseInt(dashboardId, 10) : dashboardId;
      
      const dashboard = await this.prisma.dashboards.findUnique({
        where: { id }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organization_members.count({
        where: { 
          organization_id: dashboard.organization_id,
          user_id: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard metrics update attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to update metrics for this dashboard');
      }

      // Delete existing metrics
      await this.prisma.metrics.deleteMany({
        where: { dashboard_id: dashboard.id }
      });

      // Create new metrics
      if (metrics.length > 0) {
        await this.prisma.metrics.createMany({
          data: metrics.map((metric) => ({
            dashboard_id: dashboard.id,
            title: metric.title,
            value: metric.value.toString(),
            type: metric.type,
            timeframe: metric.timeframe,
            trend: metric.trend || null,
            updated_at: new Date()
          }))
        });
      }

      // Get updated dashboard with widgets and metrics
      const updatedDashboard = await this.prisma.dashboards.findUnique({
        where: { id },
        include: {
          dashboard_widgets: true,
          metrics: true
        }
      });

      return {
        id: updatedDashboard!.id.toString(),
        name: updatedDashboard!.name,
        description: updatedDashboard!.description || undefined,
        team: updatedDashboard!.team || undefined,
        category: updatedDashboard!.category || undefined,
        created_by: updatedDashboard!.created_by.toString(),
        organization_id: updatedDashboard!.organization_id,
        created_at: updatedDashboard!.created_at,
        updated_at: updatedDashboard!.updated_at,
        widgets: updatedDashboard!.dashboard_widgets.map((widget) => ({
          id: widget.id.toString(),
          widget_type: widget.widget_type as any,
          title: widget.title,
          size: widget.size as any,
          position: widget.position as any,
          settings: widget.settings as any || {}
        })),
        metrics: updatedDashboard!.metrics.map((metric) => ({
          id: metric.id.toString(),
          title: metric.title,
          value: parseFloat(metric.value || '0'),
          type: metric.type as any,
          timeframe: metric.timeframe as any,
          trend: metric.trend as any || undefined
        }))
      };
    } catch (error) {
      this.logger.error(`Error updating dashboard metrics ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 