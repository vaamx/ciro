import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateSystemUserDto, UpdateSystemUserDto, UserSearchDto } from './dto/admin-user-management.dto';
import { RequireAuthAndPermissions } from '../../core/auth';
import { PERMISSIONS } from '../../core/auth/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@RequireAuthAndPermissions(PERMISSIONS.SYSTEM_ADMIN) // Only system admins can access
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // System Dashboard and Statistics
  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive system dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'System statistics retrieved successfully' })
  getSystemStats() {
    return this.adminService.getSystemStats();
  }

  @Get('organizations')
  @ApiOperation({ summary: 'Get organization summaries' })
  @ApiResponse({ status: 200, description: 'Organization summaries retrieved successfully' })
  getOrganizationSummaries() {
    return this.adminService.getOrganizationSummaries();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent system activity' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentActivity(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.adminService.getRecentActivity(limit);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get system alerts' })
  @ApiResponse({ status: 200, description: 'System alerts retrieved successfully' })
  getSystemAlerts() {
    return this.adminService.getSystemAlerts();
  }

  // User Management
  @Get('users')
  @ApiOperation({ summary: 'Search and list system users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiQuery({ name: 'query', required: false, type: String, description: 'Search by name or email' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'organizationId', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isSystemAdmin', required: false, type: Boolean })
  searchUsers(
    @Query('query') query?: string,
    @Query('role') role?: Role,
    @Query('organizationId', new ParseIntPipe({ optional: true })) organizationId?: number,
    @Query('isActive') isActive?: boolean,
    @Query('isSystemAdmin') isSystemAdmin?: boolean,
  ) {
    const searchDto: UserSearchDto = {
      query,
      role,
      organizationId,
      isActive,
      isSystemAdmin,
    };
    return this.adminService.searchUsers(searchDto);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new system user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'User with email already exists' })
  createSystemUser(@Body(ValidationPipe) createUserDto: CreateSystemUserDto) {
    return this.adminService.createSystemUser(createUserDto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserById(@Param('id', ParseIntPipe) id: number) {
    // This would call a getUserById method on the service
    // For now, we'll use the search method with a filter
    return this.adminService.searchUsers({ query: id.toString() });
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a system user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  updateSystemUser(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateUserDto: UpdateSystemUserDto,
  ) {
    return this.adminService.updateSystemUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a system user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deleteSystemUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteSystemUser(id);
  }

  // System Health Endpoints
  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'System health retrieved successfully' })
  getSystemHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get system performance metrics' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved successfully' })
  getSystemMetrics() {
    return {
      cpuUsage: Math.random() * 100, // Placeholder
      memoryUsage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
      uptime: process.uptime(),
      activeConnections: 10, // Placeholder
      requestsPerMinute: 100, // Placeholder
      errorRate: 0.5, // Placeholder
      timestamp: new Date().toISOString(),
    };
  }
} 