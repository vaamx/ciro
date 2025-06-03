import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { 
  SystemDashboardDto, 
  SystemStatsDto, 
  OrganizationSummaryDto, 
  SystemActivityDto, 
  SystemAlertDto 
} from './dto/system-dashboard.dto';
import { 
  CreateSystemUserDto, 
  UpdateSystemUserDto, 
  UserSearchDto, 
  SystemUserResponseDto,
  BulkUserActionDto,
  BulkUserActionResultDto
} from './dto/admin-user-management.dto';
import { 
  ReportRequestDto,
  UsageReportDto,
  RevenueReportDto,
  SystemPerformanceReportDto,
  AuditReportDto,
  ComprehensiveReportDto
} from './dto/system-reports.dto';
import { Role, InvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // System Dashboard and Statistics
  async getDashboard(): Promise<SystemDashboardDto> {
    const [stats, organizations, recentActivity, alerts] = await Promise.all([
      this.getSystemStats(),
      this.getOrganizationSummaries(),
      this.getRecentActivity(),
      this.getSystemAlerts(),
    ]);

    return {
      stats,
      organizations,
      recentActivity,
      alerts,
    };
  }

  async getSystemStats(): Promise<SystemStatsDto> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      organizationCount,
      clientCount,
      customerCount,
      userCount,
      recentRegistrations,
      meterReadingCount,
      monthlyReadings,
      invoiceCount,
      monthlyInvoices,
      revenueData,
      monthlyRevenue,
      fileCount,
    ] = await Promise.all([
      this.prisma.organizations.count(),
      this.prisma.client.count(),
      this.prisma.customer.count(),
      this.prisma.users.count(),
      this.prisma.users.count({
        where: {
          created_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.meterReading.count(),
      this.prisma.meterReading.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.invoice.count(),
      this.prisma.invoice.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { status: InvoiceStatus.PAID },
      }),
      this.prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: InvoiceStatus.PAID,
          paidDate: { gte: startOfMonth },
        },
      }),
      this.prisma.files.count(),
    ]);

    const uptime = Date.now() - this.startTime;
    const uptimeString = this.formatUptime(uptime);

    return {
      totalOrganizations: organizationCount,
      totalClients: clientCount,
      totalCustomers: customerCount,
      totalUsers: userCount,
      recentRegistrations,
      activeUsersToday: 0, // Not tracked in current schema
      activeUsersThisWeek: 0, // Not tracked in current schema
      activeUsersThisMonth: 0, // Not tracked in current schema
      totalMeterReadings: meterReadingCount,
      readingsThisMonth: monthlyReadings,
      totalInvoices: invoiceCount,
      invoicesThisMonth: monthlyInvoices,
      totalRevenue: Number(revenueData._sum.totalAmount) || 0,
      revenueThisMonth: Number(monthlyRevenue._sum.totalAmount) || 0,
      uptime: uptimeString,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage(),
      databaseConnections: 10, // Placeholder
      averageResponseTime: 150, // Placeholder
      requestsPerMinute: 100, // Placeholder
      errorRate: 0.5, // Placeholder
      totalFileUploads: fileCount,
      storageUsed: 1024 * 1024 * 100, // Placeholder - 100MB
      storageLimit: 1024 * 1024 * 1024 * 10, // 10GB
    };
  }

  async getOrganizationSummaries(): Promise<OrganizationSummaryDto[]> {
    const organizations = await this.prisma.organizations.findMany({
      include: {
        clients: {
          include: {
            customers: true,
          },
        },
        organization_members: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 10,
    });

    const summaries = await Promise.all(
      organizations.map(async (org) => {
        const customerCount = org.clients.reduce((sum, client) => sum + client.customers.length, 0);
        
        // Calculate monthly revenue for this organization
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthlyRevenue = await this.prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: {
            client: { organizationId: org.id },
            status: InvoiceStatus.PAID,
            paidDate: { gte: startOfMonth },
          },
        });

        return {
          id: org.id,
          name: org.name,
          status: 'ACTIVE', // Not tracked in current schema
          clientCount: org.clients.length,
          customerCount,
          userCount: org.organization_members.length,
          monthlyRevenue: Number(monthlyRevenue._sum.totalAmount) || 0,
          lastActivity: org.updated_at.toISOString(),
          createdAt: org.created_at.toISOString(),
        };
      })
    );

    return summaries;
  }

  async getRecentActivity(limit = 50): Promise<SystemActivityDto[]> {
    // In a real implementation, this would query an audit log table
    // For now, we'll simulate with recent user registrations
    const recentUsers = await this.prisma.users.findMany({
      include: {
        organization_members: {
          include: {
            organizations: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return recentUsers.map(user => ({
      timestamp: user.created_at.toISOString(),
      organizationName: user.organization_members[0]?.organizations?.name || 'System',
      activityType: 'USER_REGISTRATION',
      description: `New user registered: ${user.name || user.email}`,
      userId: user.id,
      userName: user.name || user.email,
      metadata: {
        email: user.email,
        role: user.role,
      },
    }));
  }

  async getSystemAlerts(): Promise<SystemAlertDto[]> {
    const alerts: SystemAlertDto[] = [];

    // Check for overdue invoices
    const overdueCount = await this.prisma.invoice.count({
      where: {
        status: InvoiceStatus.OVERDUE,
      },
    });

    if (overdueCount > 0) {
      alerts.push({
        id: 'overdue-invoices',
        type: 'warning',
        title: 'Overdue Invoices',
        message: `${overdueCount} invoices are overdue and require attention`,
        timestamp: new Date().toISOString(),
        severity: 'medium',
        resolved: false,
      });
    }

    // Check storage usage (placeholder)
    const storageUsage = this.getStorageUsage();
    if (storageUsage > 80) {
      alerts.push({
        id: 'high-storage-usage',
        type: 'warning',
        title: 'High Storage Usage',
        message: `Storage usage is at ${storageUsage}% capacity`,
        timestamp: new Date().toISOString(),
        severity: 'medium',
        resolved: false,
      });
    }

    return alerts;
  }

  // User Management (Simplified)
  async searchUsers(searchDto: UserSearchDto): Promise<SystemUserResponseDto[]> {
    const where: any = {};

    if (searchDto.query) {
      where.OR = [
        { name: { contains: searchDto.query, mode: 'insensitive' } },
        { email: { contains: searchDto.query, mode: 'insensitive' } },
      ];
    }

    if (searchDto.role) {
      where.role = searchDto.role;
    }

    const users = await this.prisma.users.findMany({
      where,
      include: {
        organization_members: {
          include: {
            organizations: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100, // Limit results
    });

    return users.map(user => ({
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      role: user.role,
      isActive: true, // Not tracked in current schema
      isSystemAdmin: user.role === Role.ADMIN,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
      organization: user.organization_members[0]?.organizations,
      organizationMemberships: user.organization_members.map(membership => ({
        organizationId: membership.organization_id,
        organizationName: membership.organizations.name,
        role: user.role, // Organization-level role not tracked separately
        joinedAt: membership.joined_at.toISOString(),
      })),
      loginCount: 0, // Not tracked in current schema
    }));
  }

  async createSystemUser(createDto: CreateSystemUserDto): Promise<SystemUserResponseDto> {
    // Check if email already exists
    const existingUser = await this.prisma.users.findUnique({
      where: { email: createDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    const user = await this.prisma.users.create({
      data: {
        name: createDto.name,
        email: createDto.email,
        hashed_password: hashedPassword,
        role: createDto.role,
        updated_at: new Date(),
        ...(createDto.organizationId && {
          organization_members: {
            create: {
              organization_id: createDto.organizationId,
            },
          },
        }),
      },
      include: {
        organization_members: {
          include: {
            organizations: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      role: user.role,
      isActive: true,
      isSystemAdmin: createDto.isSystemAdmin || false,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
      organization: user.organization_members[0]?.organizations,
      organizationMemberships: user.organization_members.map(membership => ({
        organizationId: membership.organization_id,
        organizationName: membership.organizations.name,
        role: user.role,
        joinedAt: membership.joined_at.toISOString(),
      })),
      loginCount: 0,
    };
  }

  async updateSystemUser(id: number, updateDto: UpdateSystemUserDto): Promise<SystemUserResponseDto> {
    const existingUser = await this.prisma.users.findUnique({
      where: { id },
      include: {
        organization_members: {
          include: {
            organizations: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing email
    if (updateDto.email && updateDto.email !== existingUser.email) {
      const emailExists = await this.prisma.users.findUnique({
        where: { email: updateDto.email },
      });

      if (emailExists) {
        throw new ConflictException('Email already in use');
      }
    }

    const updatedUser = await this.prisma.users.update({
      where: { id },
      data: {
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.email && { email: updateDto.email }),
        ...(updateDto.role && { role: updateDto.role }),
        updated_at: new Date(),
      },
      include: {
        organization_members: {
          include: {
            organizations: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name || updatedUser.email,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: true,
      isSystemAdmin: updateDto.isSystemAdmin || false,
      createdAt: updatedUser.created_at.toISOString(),
      updatedAt: updatedUser.updated_at.toISOString(),
      organization: updatedUser.organization_members[0]?.organizations,
      organizationMemberships: updatedUser.organization_members.map(membership => ({
        organizationId: membership.organization_id,
        organizationName: membership.organizations.name,
        role: updatedUser.role,
        joinedAt: membership.joined_at.toISOString(),
      })),
      loginCount: 0,
    };
  }

  async deleteSystemUser(id: number): Promise<void> {
    const user = await this.prisma.users.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.users.delete({
      where: { id },
    });
  }

  // Utility methods
  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal + usage.external;
    const usedMemory = usage.heapUsed;
    return Math.round((usedMemory / totalMemory) * 100);
  }

  private getCpuUsage(): number {
    // Placeholder - would integrate with actual CPU monitoring
    return Math.random() * 100;
  }

  private getStorageUsage(): number {
    // Placeholder - would integrate with actual storage monitoring
    return Math.random() * 100;
  }
} 