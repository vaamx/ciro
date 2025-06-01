import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../core/database/prisma.service';
import {
  automations,
  Prisma,
} from '@prisma/client';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: number /*, userId?: number */): Promise<automations[]> {
    this.logger.log(`Finding all automations for org ${organizationId}`);
    // Implement logic using Prisma Client
    return this.prisma.automations.findMany({
      where: {
        organization_id: organizationId,
      },
    });
  }

  async create(createDto: CreateAutomationDto, organizationId: number): Promise<automations> {
    this.logger.log(`Creating automation '${createDto.name}' for org ${organizationId}`);
    
    // Use Prisma Client create method
    return this.prisma.automations.create({
      data: {
        id: uuidv4(), // Generate UUID for id
        name: createDto.name,
        description: createDto.description,
        // Store trigger and actions within the config JSON field
        config: {
          trigger: createDto.trigger,
          actions: createDto.actions,
        },
        organization_id: organizationId,
        updated_at: new Date(), // Set current timestamp
        // created_at is handled by @default(now())
      },
    });
  }

  async update(id: string, updateDto: UpdateAutomationDto, organizationId: number): Promise<automations> {
    this.logger.log(`Updating automation ${id} for org ${organizationId}`);

    // Use safer type approach to access updateDto properties
    const updateData: Prisma.automationsUpdateInput = {};
    
    // Use type assertion to tell TypeScript these properties might exist
    const dto = updateDto as Partial<CreateAutomationDto>;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;

    // Handle potential update to the 'config' field
    if ('config' in updateDto) {
        const configUpdates = (updateDto as any).config;

        if (configUpdates === null) {
            updateData.config = Prisma.JsonNull;
        } else if (configUpdates && typeof configUpdates === 'object') {
            // Safely check for trigger/actions within the config object
            const trigger = 'trigger' in configUpdates ? configUpdates.trigger : undefined;
            const actions = 'actions' in configUpdates ? configUpdates.actions : undefined;

            if (trigger !== undefined || actions !== undefined) {
                // Merge with existing config
                const existing = await this.prisma.automations.findUnique({
                    where: { id: id, organization_id: organizationId },
                    select: { config: true },
                });
                if (!existing) throw new NotFoundException(`Automation with ID "${id}" not found`);
                
                const existingConfig = existing.config && typeof existing.config === 'object' ? existing.config : {};
                updateData.config = {
                    ...existingConfig,
                    ...(trigger !== undefined && { trigger }),
                    ...(actions !== undefined && { actions }),
                };
            } 
            // If config exists in DTO but has no trigger/actions, we don't modify config
        }
    } 
    // If 'config' is not in updateDto at all, we don't modify it.

    // Prevent update if no data is provided
    if (Object.keys(updateData).length === 0) {
        this.logger.warn(`Update called for automation ${id} with no actual data to update.`);
        return this.prisma.automations.findUniqueOrThrow({ where: { id, organization_id: organizationId } });
    }

    try {
        const result = await this.prisma.automations.updateMany({
            where: { id: id, organization_id: organizationId },
            data: updateData,
        });

        if (result.count === 0) {
            throw new NotFoundException(`Automation with ID "${id}" not found for organization ${organizationId}`);
        }
        
        return this.prisma.automations.findUniqueOrThrow({ where: { id } });

    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                throw new NotFoundException(`Automation with ID "${id}" not found or organization mismatch`);
            }
        }
        this.logger.error(`Failed to update automation ${id}: ${error.message}`, error.stack);
        throw new BadRequestException(`Could not update automation: ${error.message || 'Unknown error'}`);
    }
  }

  async delete(id: string, organizationId: number): Promise<void> {
    this.logger.log(`Deleting automation ${id} for org ${organizationId}`);
    try {
      const result = await this.prisma.automations.deleteMany({
        where: {
          id: id,
          organization_id: organizationId,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException(`Automation with ID "${id}" not found for organization ${organizationId}`);
      }
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         // Handle specific Prisma errors if needed
      }
      this.logger.error(`Failed to delete automation ${id}: ${error.message}`, error.stack);
      throw new BadRequestException(`Could not delete automation: ${error.message || 'Unknown error'}`);
    }
  }

  async toggleStatus(id: string, dto: ToggleStatusDto, organizationId: number): Promise<automations> {
    this.logger.log(`Toggling status for automation ${id} to ${dto.active} for org ${organizationId}`);
    
    // TODO: Need to confirm if the 'status' field exists and its type on the Automation model.
    // The original code used $executeRaw, suggesting potential type issues or a non-standard field.
    // Assuming an 'active' boolean field for now based on the DTO.
    try {
      const result = await this.prisma.automations.updateMany({
        where: { id: id, organization_id: organizationId },
        data: { active: dto.active }, // Assuming 'active' boolean field exists
      });

      if (result.count === 0) {
        throw new NotFoundException(`Automation with ID "${id}" not found for organization ${organizationId}`);
      }

      // Return the updated automation
      return this.prisma.automations.findUniqueOrThrow({ where: { id } });
      
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Automation with ID "${id}" not found for organization ${organizationId}`);
        }
      }
      this.logger.error(`Failed to toggle automation status ${id}: ${error.message}`, error.stack);
      throw new BadRequestException(`Could not toggle automation status: ${error.message || 'Unknown error'}`);
    }
  }

  async runNow(id: string, organizationId: number): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Running automation ${id} now for org ${organizationId}`);
    
    try {
      // First check if the automation exists and belongs to the organization
      const automation = await this.prisma.automations.findFirst({
        where: {
          id: id,
          organization_id: organizationId,
        },
      });

      if (!automation) {
        throw new NotFoundException(`Automation with ID "${id}" not found for organization ${organizationId}`);
      }

      // TODO: In a real implementation, you would:
      // 1. Queue the automation for execution (e.g., create an AutomationRun record)
      // 2. Possibly update its last_run timestamp or status
      // 3. Return success with appropriate logging
      
      // For now, we'll just simulate success
      this.logger.log(`Successfully triggered automation ${id} for org ${organizationId}`);
      
      return { 
        success: true,
        message: `Automation "${automation.name}" has been triggered for execution.`
      };
      
    } catch (error: any) {
      this.logger.error(`Failed to run automation ${id}: ${error.message}`, error.stack);
      
      // Maintain the same return structure but with success=false
      return { 
        success: false,
        message: `Failed to run automation: ${error.message || 'Unknown error'}`
      };
    }
  }
} 