import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    // Req, // Using GetUser decorator instead
    UseGuards,
    HttpCode,
    HttpStatus,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
    ParseIntPipe,
} from '@nestjs/common';
import { WorkspaceService, Workspace } from '../../services/workspace/workspace.service'; // Update path
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
// TODO: Confirm correct User type/entity path after refactoring User/Auth potentially
import { User } from '../../core/database/prisma-types'; // Placeholder path
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Controller('api/workspaces') // Base path from Express router
@UseGuards(JwtAuthGuard) // Apply auth guard to all routes
export class WorkspaceController {
    private readonly logger = new Logger(WorkspaceController.name);

    // Inject WorkspaceService (assuming it's properly provided elsewhere)
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    async getWorkspaces(
        @GetUser() user: User,
        @Query('organization_id', new ParseIntPipe({ optional: true })) organizationId?: number, // Use optional ParseIntPipe
    ): Promise<Workspace[]> {
         if (!user?.id) {
             this.logger.error('User ID missing in getWorkspaces request.');
             throw new ForbiddenException('Authentication required');
         }
         this.logger.log(`User ${user.id} getting workspaces for org ${organizationId ?? 'all assigned'}`);
         try {
            // Service method handles filtering by orgId if provided
            // Convert user.id (number) to string for service call
             return await this.workspaceService.getWorkspacesByUser(user.id.toString(), organizationId);
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error fetching workspaces for user ${user.id}: ${message}`, error instanceof Error ? error.stack : undefined);
            throw new InternalServerErrorException('Failed to fetch workspaces');
         }
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createWorkspace(
        @GetUser() user: User,
        @Body() createDto: CreateWorkspaceDto,
    ): Promise<Workspace> {
        if (!user?.id) {
            this.logger.error('User ID missing in createWorkspace request.');
            throw new ForbiddenException('Authentication required');
        }
        this.logger.log(`User ${user.id} creating workspace '${createDto.name}'`);
        try {
            // Prepare data for service, mapping DTO fields
            // The WorkspaceService interface requires `title` not `name`
            const workspaceData: Workspace = {
                title: createDto.name,
                description: createDto.description,
                // Convert user.id (number) to string for service
                user_id: user.id.toString(), 
                organization_id: createDto.organization_id,
                // tags can be added if CreateWorkspaceDto includes them
            };
            // The service returns the created workspace
            const workspace = await this.workspaceService.createWorkspace(workspaceData);

            // Authorization check: Ensure workspace belongs to the user
            // The database stores user_id as integer, but may be compared as string
            const workspaceUserId = workspace.user_id.toString();
            const currentUserId = user.id.toString();
            if (workspaceUserId !== currentUserId) { 
                 this.logger.warn(`User ${user.id} attempted to access unauthorized workspace ${workspace.id}`);
                throw new ForbiddenException('Access denied to this workspace');
            }
            return workspace;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error creating workspace for user ${user.id}: ${message}`, error instanceof Error ? error.stack : undefined);
            throw new InternalServerErrorException('Failed to create workspace');
        }
    }

    @Get(':id')
    async getWorkspaceById(
        @GetUser() user: User,
        @Param('id') workspaceId: string,
    ): Promise<Workspace> {
        if (!user?.id) {
             this.logger.error('User ID missing in getWorkspaceById request.');
            throw new ForbiddenException('Authentication required');
        }
        this.logger.log(`User ${user.id} getting workspace ${workspaceId}`);
        try {
            const workspace = await this.workspaceService.getWorkspaceById(workspaceId);
            if (!workspace) {
                throw new NotFoundException(`Workspace with ID "${workspaceId}" not found`);
            }
            // Authorization check: Ensure workspace belongs to the user
            // The database stores user_id as integer, but may be compared as string
            const workspaceUserId = workspace.user_id.toString();
            const currentUserId = user.id.toString();
            if (workspaceUserId !== currentUserId) { 
                this.logger.warn(`User ${user.id} attempted to access unauthorized workspace ${workspaceId}`);
                throw new ForbiddenException('Access denied to this workspace');
            }
            return workspace;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error fetching workspace ${workspaceId} for user ${user.id}: ${message}`, error instanceof Error ? error.stack : undefined);
             if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                 throw error; // Re-throw known, handled exceptions
             }
             throw new InternalServerErrorException('Failed to fetch workspace');
        }
    }

    @Put(':id')
    async updateWorkspace(
        @GetUser() user: User,
        @Param('id') workspaceId: string,
        @Body() updateDto: UpdateWorkspaceDto,
    ): Promise<Workspace> {
        if (!user?.id) {
             this.logger.error('User ID missing in updateWorkspace request.');
            throw new ForbiddenException('Authentication required');
        }
        this.logger.log(`User ${user.id} updating workspace ${workspaceId}`);
        try {
             // Perform authorization check first
             const existingWorkspace = await this.workspaceService.getWorkspaceById(workspaceId);
             if (!existingWorkspace) {
                 throw new NotFoundException(`Workspace with ID "${workspaceId}" not found`);
             }
             // The database stores user_id as integer, but may be compared as string
             const workspaceUserId = existingWorkspace.user_id.toString();
             const currentUserId = user.id.toString();
             if (workspaceUserId !== currentUserId) { 
                  this.logger.warn(`User ${user.id} attempted to update unauthorized workspace ${workspaceId}`);
                 throw new ForbiddenException('Access denied to update this workspace');
             }

            // Prepare data for the service update method
            // The WorkspaceService update method takes Partial<Workspace>
            const workspaceUpdateData: Partial<Workspace> = {};
             if (updateDto.name !== undefined) workspaceUpdateData.title = updateDto.name; // Map DTO name to service title
             if (updateDto.description !== undefined) workspaceUpdateData.description = updateDto.description;
             // tags update could be added if UpdateWorkspaceDto includes them

            // Only call update if there's something to update
            if (Object.keys(workspaceUpdateData).length === 0) {
                this.logger.log(`No fields to update for workspace ${workspaceId}. Returning existing.`);
                return existingWorkspace; // Return existing data if no changes
            }

            const updatedWorkspace = await this.workspaceService.updateWorkspace(workspaceId, workspaceUpdateData);

            if (!updatedWorkspace) {
                 // If update returns null/undefined despite prior checks, something went wrong server-side
                 this.logger.error(`Workspace update for ${workspaceId} returned null unexpectedly.`);
                 throw new InternalServerErrorException('Workspace update failed unexpectedly.');
            }
            return updatedWorkspace;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
             this.logger.error(`Error updating workspace ${workspaceId} for user ${user.id}: ${message}`, error instanceof Error ? error.stack : undefined);
              if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                 throw error; // Re-throw known, handled exceptions
             }
            throw new InternalServerErrorException('Failed to update workspace');
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteWorkspace(
        @GetUser() user: User,
        @Param('id') workspaceId: string,
    ): Promise<void> {
         if (!user?.id) {
              this.logger.error('User ID missing in deleteWorkspace request.');
             throw new ForbiddenException('Authentication required');
         }
         this.logger.log(`User ${user.id} deleting workspace ${workspaceId}`);
         try {
              // Perform authorization check first
             const existingWorkspace = await this.workspaceService.getWorkspaceById(workspaceId);
             if (!existingWorkspace) {
                 // If the goal is idempotency, we might just return 204 even if not found.
                 // However, throwing 404 is clearer if the resource must exist.
                 throw new NotFoundException(`Workspace with ID "${workspaceId}" not found`);
             }
             // The database stores user_id as integer, but may be compared as string
             const workspaceUserId = existingWorkspace.user_id.toString();
             const currentUserId = user.id.toString();
             if (workspaceUserId !== currentUserId) { 
                  this.logger.warn(`User ${user.id} attempted to delete unauthorized workspace ${workspaceId}`);
                 throw new ForbiddenException('Access denied to delete this workspace');
             }

             const deleted = await this.workspaceService.deleteWorkspace(workspaceId);
             if (!deleted) {
                 // Service returned false indicating delete failed despite authorization
                 throw new InternalServerErrorException('Failed to delete workspace');
             }
             // Success, return void (NestJS handles 204 status)
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error deleting workspace ${workspaceId} for user ${user.id}: ${message}`, error instanceof Error ? error.stack : undefined);
              if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                 throw error; // Re-throw known, handled exceptions
             }
            throw new InternalServerErrorException('Failed to delete workspace');
         }
    }

    // TODO: Add methods for workspace charts if refactoring those routes too
    // e.g., GET /:id/charts, POST /:id/charts, PUT /:id/charts/:chartId, DELETE /:id/charts/:chartId
} 