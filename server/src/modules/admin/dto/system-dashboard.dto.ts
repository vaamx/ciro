export class SystemStatsDto {
  // System overview
  totalOrganizations: number;
  totalClients: number;
  totalCustomers: number;
  totalUsers: number;
  
  // Recent activity
  recentRegistrations: number; // Last 30 days
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;
  
  // Usage statistics
  totalMeterReadings: number;
  readingsThisMonth: number;
  totalInvoices: number;
  invoicesThisMonth: number;
  totalRevenue: number;
  revenueThisMonth: number;
  
  // System health
  uptime: string;
  memoryUsage: number; // percentage
  cpuUsage: number; // percentage
  databaseConnections: number;
  
  // Performance metrics
  averageResponseTime: number; // milliseconds
  requestsPerMinute: number;
  errorRate: number; // percentage
  
  // Storage metrics
  totalFileUploads: number;
  storageUsed: number; // bytes
  storageLimit: number; // bytes
}

export class OrganizationSummaryDto {
  id: number;
  name: string;
  status: string;
  clientCount: number;
  customerCount: number;
  userCount: number;
  monthlyRevenue: number;
  lastActivity: string;
  createdAt: string;
}

export class SystemActivityDto {
  timestamp: string;
  organizationName: string;
  activityType: string;
  description: string;
  userId?: number;
  userName?: string;
  metadata?: any;
}

export class SystemDashboardDto {
  stats: SystemStatsDto;
  organizations: OrganizationSummaryDto[];
  recentActivity: SystemActivityDto[];
  alerts: SystemAlertDto[];
}

export class SystemAlertDto {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  organizationId?: number;
  organizationName?: string;
} 