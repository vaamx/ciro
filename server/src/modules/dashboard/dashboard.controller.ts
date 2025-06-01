import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Query,
    Request,
    ParseIntPipe,
    ValidationPipe
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { 
    CreateDashboardDto, 
    UpdateDashboardDto, 
    WidgetDto, 
    MetricDto, 
    DashboardResponseDto 
} from './dto/dashboard.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '../../core/auth/get-user.decorator';
import { GetDashboardDto } from './dto/get-dashboard.dto';
import { DashboardResponseDto as UserDashboardResponseDto } from './dto/dashboard-response.dto';

// Define the request user interface
interface RequestWithUser extends Request {
  user: any; // You can replace 'any' with your actual User type
}

@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboards')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @ApiOperation({ summary: 'Get all dashboards for an organization' })
    @ApiQuery({ name: 'organizationId', required: true, type: Number, description: 'Organization ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'List of dashboards', type: [DashboardResponseDto] })
    @Get()
    async getDashboards(
        @Request() req: RequestWithUser,
        @Query('organizationId') orgIdCamel?: string,
        @Query('organization_id') orgIdSnake?: string,
    ): Promise<DashboardResponseDto[]> {
        // Support both camelCase and snake_case parameter names for compatibility
        const organizationIdStr = orgIdCamel || orgIdSnake;
        
        if (!organizationIdStr) {
            throw new BadRequestException('Organization ID is required');
        }
        
        const organizationId = parseInt(organizationIdStr, 10);
        if (isNaN(organizationId)) {
            throw new BadRequestException('Organization ID must be a valid number');
        }
        
        return this.dashboardService.getDashboards(req.user, organizationId);
    }

    @ApiOperation({ summary: 'Get a dashboard by ID' })
    @ApiParam({ name: 'id', required: true, description: 'Dashboard ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'The dashboard', type: DashboardResponseDto })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Dashboard not found' })
    @Get(':id')
    async getDashboard(
        @Request() req: RequestWithUser,
        @Param('id', ParseIntPipe) id: number,
    ): Promise<DashboardResponseDto> {
        return this.dashboardService.getDashboardById(req.user, id);
    }

    @ApiOperation({ summary: 'Create a new dashboard' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'The created dashboard', type: DashboardResponseDto })
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createDashboard(
        @Request() req: RequestWithUser,
        @Body(new ValidationPipe({ transform: true })) createDashboardDto: CreateDashboardDto,
    ): Promise<DashboardResponseDto> {
        return this.dashboardService.createDashboard(req.user, createDashboardDto);
    }

    @ApiOperation({ summary: 'Update a dashboard' })
    @ApiParam({ name: 'id', required: true, description: 'Dashboard ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'The updated dashboard', type: DashboardResponseDto })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Dashboard not found' })
    @Put(':id')
    async updateDashboard(
        @Request() req: RequestWithUser,
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe({ transform: true })) updateDashboardDto: UpdateDashboardDto,
    ): Promise<DashboardResponseDto> {
        return this.dashboardService.updateDashboard(req.user, id, updateDashboardDto);
    }

    @ApiOperation({ summary: 'Delete a dashboard' })
    @ApiParam({ name: 'id', required: true, description: 'Dashboard ID' })
    @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Dashboard deleted successfully' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Dashboard not found' })
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteDashboard(
        @Request() req: RequestWithUser,
        @Param('id', ParseIntPipe) id: number,
    ): Promise<void> {
        await this.dashboardService.deleteDashboard(req.user, id);
    }

    @ApiOperation({ summary: 'Update dashboard widgets' })
    @ApiParam({ name: 'id', required: true, description: 'Dashboard ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'The updated dashboard', type: DashboardResponseDto })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Dashboard not found' })
    @Put(':id/widgets')
    async updateWidgets(
        @Request() req: RequestWithUser,
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe({ transform: true })) widgets: WidgetDto[],
    ): Promise<DashboardResponseDto> {
        return this.dashboardService.updateDashboardWidgets(req.user, id, widgets);
    }

    @ApiOperation({ summary: 'Update dashboard metrics' })
    @ApiParam({ name: 'id', required: true, description: 'Dashboard ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'The updated dashboard', type: DashboardResponseDto })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Dashboard not found' })
    @Put(':id/metrics')
    async updateMetrics(
        @Request() req: RequestWithUser,
        @Param('id', ParseIntPipe) id: number,
        @Body(new ValidationPipe({ transform: true })) metrics: MetricDto[],
    ): Promise<DashboardResponseDto> {
        return this.dashboardService.updateDashboardMetrics(req.user, id, metrics);
    }

    @ApiOperation({ summary: 'Get user dashboard with stats and recent chat sessions' })
    @ApiResponse({ status: HttpStatus.OK, description: 'User dashboard data', type: UserDashboardResponseDto })
    @Get('user/stats')
    async getUserDashboard(
        @GetUser('id') userId: string,
        @Query() query: GetDashboardDto,
    ): Promise<UserDashboardResponseDto> {
        // This would typically call a service to gather the dashboard data
        // For now, returning mock data as a placeholder
        
        const chatStats = {
            total: 42,
            active: 15,
            completed: 27,
        };
        
        const messageStats = {
            total: 320,
            userMessages: 160,
            aiMessages: 160,
        };
        
        const recentChats = [
            {
                id: '1',
                title: 'Project Planning',
                lastMessage: 'Let me help you outline the next steps.',
                createdAt: new Date(Date.now() - 3600000), // 1 hour ago
                updatedAt: new Date(),
            },
            {
                id: '2',
                title: 'Code Review',
                lastMessage: 'The changes look good, but we should add tests.',
                createdAt: new Date(Date.now() - 86400000), // 1 day ago
                updatedAt: new Date(Date.now() - 43200000), // 12 hours ago
            }
        ];
        
        return {
            chatStats,
            messageStats,
            recentChats,
            totalResults: chatStats.total,
            page: query.page || 1,
            limit: query.limit || 10,
        };
    }
} 