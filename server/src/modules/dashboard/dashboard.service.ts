import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { 
  CreateDashboardDto, 
  UpdateDashboardDto, 
  WidgetDto, 
  MetricDto, 
  DashboardResponseDto 
} from './dto/dashboard.dto';
import { User } from '../../core/database/prisma-types';

// Define interfaces for the models we need
interface DashboardModel {
  id: number;
  name: string;
  description?: string;
  team?: string;
  category?: string;
  createdBy?: number;
  organizationId: number;
  createdAt: Date;
  updatedAt: Date;
  widgets: DashboardWidgetModel[];
  metrics: MetricModel[];
}

interface DashboardWidgetModel {
  id: number;
  dashboardId: number;
  widgetType: string;
  title?: string;
  size?: string;
  settings?: any;
  position?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface MetricModel {
  id: number;
  dashboardId: number;
  title: string;
  value?: string;
  type?: string;
  timeframe?: string;
  trend?: any;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all dashboards for an organization
   */
  async getDashboards(user: User, organizationId: number): Promise<DashboardResponseDto[]> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      // Verify user is a member of the organization
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard access attempt:', { userId: user.id, organizationId });
        throw new ForbiddenException('Not authorized to access dashboards in this organization');
      }

      // Get all dashboards with their widgets and metrics
      const dashboards = await (this.prisma as any).dashboard.findMany({
        where: { organizationId },
        include: {
          widgets: true,
          metrics: true
        }
      });

      // Process and return the results
      return dashboards.map((dashboard: DashboardModel) => {
        return {
          ...dashboard,
          widgets: dashboard.widgets.map((widget: DashboardWidgetModel) => ({
            ...widget,
            settings: widget.settings || {}
          })),
          metrics: dashboard.metrics.map((metric: MetricModel) => ({
            ...metric,
            trend: metric.trend || null
          }))
        };
      });
    } catch (error) {
      this.logger.error(`Error fetching dashboards for organization ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get a dashboard by ID with its widgets and metrics
   */
  async getDashboardById(user: User, dashboardId: string | number): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const id = typeof dashboardId === 'string' ? parseInt(dashboardId, 10) : dashboardId;
      
      const dashboard = await (this.prisma as any).dashboard.findUnique({
        where: { id },
        include: {
          widgets: true,
          metrics: true
        }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId: dashboard.organizationId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard access attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to access this dashboard');
      }

      return {
        ...dashboard,
        widgets: dashboard.widgets.map((w: DashboardWidgetModel) => ({
          ...w,
          settings: w.settings || {}
        })),
        metrics: dashboard.metrics.map((m: MetricModel) => ({
          ...m,
          trend: m.trend || null
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
  async createDashboard(user: User, createDashboardDto: CreateDashboardDto): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      const { name, description, team, category, organization_id } = createDashboardDto;

      // Default to the user's organization if not provided
      let orgId = organization_id;
      if (!orgId) {
        // Get the user's default organization
        const userOrg = await this.prisma.organizationMember.findFirst({
          where: { userId: user.id },
          select: { organization: { select: { id: true } } }
        });
        
        if (userOrg) {
          orgId = userOrg.organization.id;
        } else {
          throw new BadRequestException('Organization ID is required');
        }
      }

      // Verify user is a member of the organization
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId: orgId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard creation attempt:', { userId: user.id, orgId });
        throw new ForbiddenException('Not authorized to create dashboards in this organization');
      }

      // Create the dashboard
      const newDashboard = await (this.prisma as any).dashboard.create({
        data: {
          name,
          description: description || '',
          team: team || '',
          category: category || '',
          creator: { connect: { id: user.id } },
          organization: { connect: { id: orgId } }
        },
        include: {
          widgets: true,
          metrics: true
        }
      });

      return {
        ...newDashboard,
        widgets: newDashboard.widgets.map((w: DashboardWidgetModel) => ({
          ...w,
          settings: w.settings || {}
        })),
        metrics: newDashboard.metrics.map((m: MetricModel) => ({
          ...m,
          trend: m.trend || null
        }))
      };
    } catch (error) {
      this.logger.error(`Error creating dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update a dashboard
   */
  async updateDashboard(user: User, dashboardId: string | number, updateDashboardDto: UpdateDashboardDto): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      // Get current dashboard
      const dashboard = await (this.prisma as any).dashboard.findUnique({
        where: { id: dashboardId },
        include: {
          widgets: true,
          metrics: true
        }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId: dashboard.organizationId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard update attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to update this dashboard');
      }

      // Update the dashboard
      const updateData: any = {};

      // Only include fields that were provided
      if (updateDashboardDto.name !== undefined) updateData.name = updateDashboardDto.name;
      if (updateDashboardDto.description !== undefined) updateData.description = updateDashboardDto.description;
      if (updateDashboardDto.team !== undefined) updateData.team = updateDashboardDto.team;
      if (updateDashboardDto.category !== undefined) updateData.category = updateDashboardDto.category;

      const updatedDashboard = await (this.prisma as any).dashboard.update({
        where: { id: dashboardId },
        data: updateData,
        include: {
          widgets: true,
          metrics: true
        }
      });

      return {
        ...updatedDashboard,
        widgets: updatedDashboard.widgets.map((w: DashboardWidgetModel) => ({
          ...w,
          settings: w.settings || {}
        })),
        metrics: updatedDashboard.metrics.map((m: MetricModel) => ({
          ...m,
          trend: m.trend || null
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
  async deleteDashboard(user: User, dashboardId: string | number): Promise<void> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      // Get current dashboard
      const dashboard = await (this.prisma as any).dashboard.findUnique({
        where: { id: dashboardId },
        include: {
          widgets: true,
          metrics: true
        }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId: dashboard.organizationId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard deletion attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to delete this dashboard');
      }

      // Delete the dashboard (cascades to widgets and metrics due to foreign key constraints)
      await (this.prisma as any).dashboard.delete({
        where: { id: dashboardId }
      });
    } catch (error) {
      this.logger.error(`Error deleting dashboard ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update dashboard widgets
   */
  async updateDashboardWidgets(user: User, dashboardId: string | number, widgets: WidgetDto[]): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      // Get current dashboard
      const dashboard = await (this.prisma as any).dashboard.findUnique({
        where: { id: dashboardId },
        include: {
          widgets: true,
          metrics: true
        }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId: dashboard.organizationId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard widgets update attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to update this dashboard');
      }

      // Start a transaction to update widgets
      await this.prisma.$transaction(async (tx: any) => {
        // Delete existing widgets
        await tx.dashboardWidget.deleteMany({
          where: { dashboardId }
        });

        // Insert new widgets if any
        if (widgets && widgets.length > 0) {
          for (const widget of widgets) {
            await tx.dashboardWidget.create({
              data: {
                dashboardId,
                widgetType: widget.widget_type,
                title: widget.title,
                size: widget.size,
                settings: widget.settings,
                position: widget.position,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
        }

        // Update dashboard last modified time
        await tx.dashboard.update({
          where: { id: dashboardId },
          data: { updatedAt: new Date() }
        });
      });

      // Get dashboard with updated widgets
      return await this.getDashboardById(user, dashboardId);
    } catch (error) {
      this.logger.error(`Error updating widgets for dashboard ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update dashboard metrics
   */
  async updateDashboardMetrics(user: User, dashboardId: string | number, metrics: MetricDto[]): Promise<DashboardResponseDto> {
    try {
      if (!user?.id) {
        throw new ForbiddenException('Authentication required');
      }

      // Get current dashboard
      const dashboard = await (this.prisma as any).dashboard.findUnique({
        where: { id: dashboardId },
        include: {
          widgets: true,
          metrics: true
        }
      });

      if (!dashboard) {
        throw new NotFoundException(`Dashboard with ID ${dashboardId} not found`);
      }

      // Verify user is a member of the organization that owns the dashboard
      const membershipCount = await this.prisma.organizationMember.count({
        where: { 
          organizationId: dashboard.organizationId,
          userId: user.id 
        }
      });

      if (membershipCount === 0) {
        this.logger.warn('Unauthorized dashboard metrics update attempt:', { userId: user.id, dashboardId });
        throw new ForbiddenException('Not authorized to update this dashboard');
      }

      // Start a transaction to update metrics
      await this.prisma.$transaction(async (tx: any) => {
        // Delete existing metrics
        await tx.metric.deleteMany({
          where: { dashboardId }
        });

        // Insert new metrics if any
        if (metrics && metrics.length > 0) {
          for (const metric of metrics) {
            await tx.metric.create({
              data: {
                dashboardId,
                title: metric.title,
                value: metric.value,
                type: metric.type,
                timeframe: metric.timeframe,
                trend: metric.trend,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
        }

        // Update dashboard last modified time
        await tx.dashboard.update({
          where: { id: dashboardId },
          data: { updatedAt: new Date() }
        });
      });

      // Get dashboard with updated metrics
      return await this.getDashboardById(user, dashboardId);
    } catch (error) {
      this.logger.error(`Error updating metrics for dashboard ${dashboardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 