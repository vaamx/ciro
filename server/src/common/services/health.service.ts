import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EnhancedLoggerService } from './logger.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
  details?: any;
}

@Injectable()
export class HealthService {
  private startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: EnhancedLoggerService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database connectivity check
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);
    if (dbCheck.status === 'fail') overallStatus = 'unhealthy';
    else if (dbCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    // Memory usage check
    const memoryCheck = this.checkMemory();
    checks.push(memoryCheck);
    if (memoryCheck.status === 'fail') overallStatus = 'unhealthy';
    else if (memoryCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    // Disk space check (simulated)
    const diskCheck = this.checkDiskSpace();
    checks.push(diskCheck);
    if (diskCheck.status === 'fail') overallStatus = 'unhealthy';
    else if (diskCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    // System uptime check
    const uptimeCheck = this.checkUptime();
    checks.push(uptimeCheck);

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };

    // Log health status if not healthy
    if (overallStatus !== 'healthy') {
      this.logger.warn(`System health check failed`, {
        status: overallStatus,
        failedChecks: checks.filter(c => c.status === 'fail').map(c => c.name),
        warnChecks: checks.filter(c => c.status === 'warn').map(c => c.name),
      });
    }

    return health;
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple query to test database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      const duration = Date.now() - startTime;
      
      return {
        name: 'database',
        status: duration > 1000 ? 'warn' : 'pass',
        duration,
        message: duration > 1000 ? 'Database response is slow' : 'Database connection is healthy',
        details: {
          responseTime: duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Database health check failed', error.stack, {
        duration,
        error: error.message,
      });
      
      return {
        name: 'database',
        status: 'fail',
        duration,
        message: 'Database connection failed',
        details: {
          error: error.message,
        },
      };
    }
  }

  private checkMemory(): HealthCheck {
    const startTime = Date.now();
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const usedMemory = memoryUsage.heapUsed;
    const usagePercentage = (usedMemory / totalMemory) * 100;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Memory usage is normal';
    
    if (usagePercentage > 90) {
      status = 'fail';
      message = 'Memory usage is critically high';
    } else if (usagePercentage > 75) {
      status = 'warn';
      message = 'Memory usage is high';
    }
    
    return {
      name: 'memory',
      status,
      duration: Date.now() - startTime,
      message,
      details: {
        usagePercentage: Math.round(usagePercentage),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
    };
  }

  private checkDiskSpace(): HealthCheck {
    const startTime = Date.now();
    
    // Simulated disk space check - in a real implementation,
    // you would use a library like 'node-disk-info' or execute system commands
    const simulatedUsagePercentage = Math.random() * 100;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Disk space is sufficient';
    
    if (simulatedUsagePercentage > 95) {
      status = 'fail';
      message = 'Disk space is critically low';
    } else if (simulatedUsagePercentage > 85) {
      status = 'warn';
      message = 'Disk space is getting low';
    }
    
    return {
      name: 'disk_space',
      status,
      duration: Date.now() - startTime,
      message,
      details: {
        usagePercentage: Math.round(simulatedUsagePercentage),
        freeSpace: Math.round((100 - simulatedUsagePercentage) * 100), // GB (simulated)
        totalSpace: 1000, // GB (simulated)
      },
    };
  }

  private checkUptime(): HealthCheck {
    const startTime = Date.now();
    const uptime = this.getUptime();
    
    // Consider anything less than 1 minute as potentially problematic
    const status = uptime < 60 ? 'warn' : 'pass';
    const message = uptime < 60 ? 'Service recently restarted' : 'Service uptime is good';
    
    return {
      name: 'uptime',
      status,
      duration: Date.now() - startTime,
      message,
      details: {
        uptime,
        startedAt: new Date(this.startTime).toISOString(),
      },
    };
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  async getDetailedSystemInfo() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      pid: process.pid,
      ppid: process.ppid,
    };
  }
} 