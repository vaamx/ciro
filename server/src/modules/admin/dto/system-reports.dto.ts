import { IsDateString, IsOptional, IsEnum, IsInt, IsPositive } from 'class-validator';

export class ReportRequestDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  organizationId?: number;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  groupBy?: 'daily' | 'weekly' | 'monthly';
}

export class UsageReportDto {
  period: string;
  organizationId?: number;
  organizationName?: string;
  
  // User activity
  activeUsers: number;
  newRegistrations: number;
  totalLogins: number;
  
  // Business metrics
  totalCustomers: number;
  newCustomers: number;
  totalMeterReadings: number;
  newMeterReadings: number;
  totalInvoices: number;
  newInvoices: number;
  totalRevenue: number;
  newRevenue: number;
  
  // System usage
  apiCalls: number;
  fileUploads: number;
  storageUsed: number;
  
  // Performance
  averageResponseTime: number;
  errorCount: number;
  uptimePercentage: number;
}

export class RevenueReportDto {
  period: string;
  organizationId?: number;
  organizationName?: string;
  
  // Revenue breakdown
  totalRevenue: number;
  energyCharges: number;
  demandCharges: number;
  taxes: number;
  adjustments: number;
  
  // Invoice statistics
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  
  // Payment metrics
  averagePaymentTime: number; // days
  collectionRate: number; // percentage
  
  // Top customers by revenue
  topCustomers: Array<{
    customerId: number;
    customerName: string;
    revenue: number;
    invoiceCount: number;
  }>;
}

export class SystemPerformanceReportDto {
  period: string;
  
  // Response time metrics
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Throughput
  totalRequests: number;
  requestsPerSecond: number;
  
  // Error rates
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  
  // Database performance
  databaseQueryTime: number;
  slowQueries: number;
  
  // System resources
  averageCpuUsage: number;
  averageMemoryUsage: number;
  peakCpuUsage: number;
  peakMemoryUsage: number;
  
  // Uptime
  uptime: number; // seconds
  uptimePercentage: number;
  downtimeEvents: Array<{
    start: string;
    end: string;
    duration: number;
    reason?: string;
  }>;
}

export class AuditReportDto {
  period: string;
  organizationId?: number;
  organizationName?: string;
  
  // Activity summary
  totalActivities: number;
  userActivities: number;
  systemActivities: number;
  adminActivities: number;
  
  // Activity breakdown by type
  activitiesByType: Record<string, number>;
  
  // Security events
  loginAttempts: number;
  failedLogins: number;
  passwordResets: number;
  accountLockouts: number;
  
  // Data changes
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  
  // Most active users
  topUsers: Array<{
    userId: number;
    userName: string;
    activityCount: number;
    lastActivity: string;
  }>;
  
  // Recent critical activities
  criticalActivities: Array<{
    timestamp: string;
    userId: number;
    userName: string;
    activity: string;
    description: string;
    ipAddress?: string;
  }>;
}

export class ComprehensiveReportDto {
  reportId: string;
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  organizationFilter?: {
    organizationId: number;
    organizationName: string;
  };
  
  usageReport: UsageReportDto;
  revenueReport: RevenueReportDto;
  performanceReport: SystemPerformanceReportDto;
  auditReport: AuditReportDto;
} 