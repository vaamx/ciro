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
    Logger,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { users } from '../../core/database/prisma-types';
// Import DTOs
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
// Import Prisma type
import { automations } from '@prisma/client';

@Controller('automations') // Changed from 'api/automations'
@UseGuards(JwtAuthGuard) // Apply auth guard to all routes in this controller
export class AutomationController {
    private readonly logger = new Logger(AutomationController.name);

    constructor(private readonly automationService: AutomationService) {}

    @Get()
    async getAutomations(
        @GetUser() user: users,
        @Query('organization_id') orgId?: string
    ): Promise<automations[]> {
        // Use organization_id from query params or fallback to 1
        const organizationId = orgId ? parseInt(orgId, 10) : 1;
        
        this.logger.log(`User ${user.id} getting automations for org ${organizationId}`);
        return this.automationService.findAll(organizationId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createAutomation(
        @GetUser() user: users,
        @Body() createDto: CreateAutomationDto,
    ): Promise<automations> {
        // TODO: Correctly retrieve organizationId. It might come from the DTO or user context.
        const organizationId = 1; // Placeholder
        this.logger.log(`User ${user.id} creating automation for org ${organizationId}`);
        return this.automationService.create(createDto, organizationId);
    }

    @Put(':id')
    async updateAutomation(
        @GetUser() user: users,
        @Param('id') id: string,
        @Body() updateDto: UpdateAutomationDto,
    ): Promise<automations> {
        // TODO: Correctly retrieve organizationId. It might come from the DTO or user context.
        const organizationId = 1; // Placeholder
        this.logger.log(`User ${user.id} updating automation ${id} for org ${organizationId}`);
        return this.automationService.update(id, updateDto, organizationId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteAutomation(
        @GetUser() user: users,
        @Param('id') id: string,
    ): Promise<void> {
        // TODO: Correctly retrieve organizationId. This might involve checking ownership of the automation ID.
        const organizationId = 1; // Placeholder
        this.logger.log(`User ${user.id} deleting automation ${id} for org ${organizationId}`);
        await this.automationService.delete(id, organizationId);
    }

    @Put(':id/status')
    async toggleStatus(
        @GetUser() user: users,
        @Param('id') id: string,
        @Body() toggleDto: ToggleStatusDto,
    ): Promise<automations> {
        // TODO: Correctly retrieve organizationId. This might involve checking ownership of the automation ID.
        const organizationId = 1; // Placeholder
        this.logger.log(`User ${user.id} toggling status for automation ${id} for org ${organizationId}`);
        return this.automationService.toggleStatus(id, toggleDto, organizationId);
    }

    @Post(':id/run')
    @HttpCode(HttpStatus.ACCEPTED)
    async runNow(
        @GetUser() user: users,
        @Param('id') id: string,
    ): Promise<{ success: boolean; message?: string }> {
        // TODO: Correctly retrieve organizationId. This might involve checking ownership of the automation ID.
        const organizationId = 1; // Placeholder
        this.logger.log(`User ${user.id} running automation ${id} for org ${organizationId}`);
        return this.automationService.runNow(id, organizationId);
    }
} 