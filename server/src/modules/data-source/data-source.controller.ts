import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
    ParseIntPipe,
    InternalServerErrorException,
    Logger,
    UnauthorizedException
} from '@nestjs/common';
import { DataSourceManagementService } from '../../services/datasources/management';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { users, DataSource, DataSourceWithRelations } from '../../core/database/prisma-types';
import { DataSourceTypeEnum, DataSourceProcessingStatus } from '../../types';
// Import DTO
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto'; // Import Update DTO for later use
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrphanedDataCleanupService } from '../../services/datasources/management/orphaned-data-cleanup.service';

@Controller('data-sources')
@UseGuards(JwtAuthGuard)
export class DataSourceController {
    private readonly logger = new Logger(DataSourceController.name);

    constructor(
        private readonly dataSourceService: DataSourceManagementService,
        private readonly orphanedCleanupService: OrphanedDataCleanupService
    ) {}

    @Get()
    async findAll(
        @GetUser() user: users,
        @Query('organization_id') orgId?: string
    ): Promise<DataSourceWithRelations[]> {
        // Use the provided organization ID from query or fallback to 1 as before
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        try {
            this.logger.log(`Fetching data sources for organization ${organizationId} and user ${user.id}`);
            return await this.dataSourceService.findAllByOrgForUser(organizationId, user.id);
        } catch (error) {
            this.logger.error(`Error fetching data sources: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string, 
        @GetUser() user: users,
        @Query('organization_id') orgId?: string
    ): Promise<DataSourceWithRelations> {
        // Use the provided organization ID from query or fallback to 1
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        try {
            this.logger.log(`Finding data source ${id} for organization ${organizationId} and user ${user.id}`);
            const dataSource = await this.dataSourceService.findByIdForUser(parseInt(id, 10), user.id, organizationId);
            if (!dataSource) {
                throw new NotFoundException(`Data source with ID ${id} not found`);
            }
            return dataSource;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error fetching data source ${id}: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() createDataSourceDto: CreateDataSourceDto, 
        @GetUser() user: users,
        @Query('organization_id') orgId?: string
    ): Promise<DataSource> {
        // Use the provided organization ID from query or fallback to 1
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        try {
            this.logger.log(`Creating data source for organization ${organizationId} and user ${user.id}`);
            return await this.dataSourceService.create(createDataSourceDto, user.id, organizationId);
        } catch (error) {
            this.logger.error(`Error creating data source: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() updateDataSourceDto: UpdateDataSourceDto,
        @GetUser() user: users,
        @Query('organization_id') orgId?: string
    ): Promise<DataSource> {
        // Use the provided organization ID from query or fallback to 1
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        try {
            this.logger.log(`Updating data source ${id} for organization ${organizationId} and user ${user.id}`);
            const dataSource = await this.dataSourceService.update(
                parseInt(id, 10),
                updateDataSourceDto,
                user.id,
                organizationId 
            );
            if (!dataSource) {
                throw new NotFoundException(`Data source with ID ${id} not found`);
            }
            return dataSource;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error updating data source ${id}: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @Param('id') id: string, 
        @GetUser() user: users,
        @Query('organization_id') orgId?: string
    ): Promise<void> {
        // Use the provided organization ID from query or fallback to 1
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        try {
            this.logger.log(`Deleting data source ${id} for organization ${organizationId} and user ${user.id}`);
            await this.dataSourceService.delete(parseInt(id, 10), user.id, organizationId);
        } catch (error) {
            this.logger.error(`Error deleting data source ${id}: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    // Add endpoint for processing
    @Post(':id/process')
    @HttpCode(HttpStatus.ACCEPTED) // Use 202 Accepted for async operations
    async processDataSource(
        @GetUser() user: users,
        @Param('id', ParseIntPipe) id: number,
        @Body() options: any = {}, // Allow passing options, e.g., { forceReprocess: true }
        @Query('organization_id') orgId?: string
    ): Promise<{ status: string; message: string }> {
        // Use the provided organization ID from query or fallback to 1
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        this.logger.log(`User ${user.id} requesting processing for data source ${id} for org ${organizationId}`);

        // TODO: Consider if specific DTO is needed for options
        const processingOptions = {
            useSemanticChunking: options.useSemanticChunking ?? undefined, // Pass specific options if provided
            // Add other relevant options here, e.g., forceReprocess
        };

        try {
            // Call the refactored service method
            const result = await this.dataSourceService.processDocument(
                id,
                user.id,
                organizationId, // Pass placeholder ID
                processingOptions
            );
            // Service method throws NotFoundException if not found/authorized
            // Service method throws BadRequestException if already processing/processed (if uncommented)
            return result; // Return { status: 'processing_started', message: '...' }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            // Pass placeholder ID to logger
            this.logger.error(`Error requesting processing for data source ${id} for user ${user.id}, org ${organizationId}: ${errorMessage}`, errorStack);

            // Re-throw specific known exceptions
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            // Throw generic internal server error for others
            throw new InternalServerErrorException('Failed to request data source processing.');
        }
    }

    @Delete('cleanup/orphaned')
    @ApiOperation({ summary: 'Clean up orphaned data sources and collections' })
    @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
    async cleanupOrphanedData(@GetUser() user: users): Promise<any> {
        // Only allow admins to run cleanup
        if (user.role !== 'ADMIN') {
            throw new UnauthorizedException('Only administrators can perform cleanup operations');
        }

        try {
            const report = await this.orphanedCleanupService.performManualCleanup();
            return {
                success: true,
                message: 'Orphaned data cleanup completed',
                report
            };
        } catch (error) {
            this.logger.error('Error during manual cleanup:', error);
            throw new InternalServerErrorException('Failed to perform cleanup');
        }
    }

    @Get('health/system')
    @ApiOperation({ summary: 'Get system health status for data sources' })
    @ApiResponse({ status: 200, description: 'System health status retrieved' })
    async getSystemHealth(@GetUser() user: users): Promise<any> {
        try {
            const healthStatus = await this.orphanedCleanupService.getSystemHealthStatus();
            
            return {
                success: true,
                timestamp: new Date().toISOString(),
                health: {
                    status: healthStatus.orphanedData.orphanedDataSources.length === 0 && 
                            healthStatus.orphanedData.orphanedCollections.length === 0 && 
                            healthStatus.orphanedData.inconsistentStates.length === 0 
                            ? 'healthy' : 'issues_detected',
                    totalDataSources: healthStatus.totalDataSources,
                    totalCollections: healthStatus.totalCollections,
                    healthyDataSources: healthStatus.healthyDataSources,
                    issues: {
                        orphanedDataSources: healthStatus.orphanedData.orphanedDataSources.length,
                        orphanedCollections: healthStatus.orphanedData.orphanedCollections.length,
                        inconsistentStates: healthStatus.orphanedData.inconsistentStates.length,
                    },
                    details: user.role === 'ADMIN' ? healthStatus.orphanedData : undefined
                }
            };
        } catch (error) {
            this.logger.error('Error getting system health:', error);
            throw new InternalServerErrorException('Failed to get system health status');
        }
    }
} 