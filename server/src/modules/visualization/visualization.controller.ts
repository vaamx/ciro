import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
  ParseIntPipe, // Or ParseUUIDPipe depending on ID type
  NotFoundException,
  InternalServerErrorException,
  Query,
  Req,
} from '@nestjs/common';
import { VisualizationService } from './visualization.service';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator'; // Assuming this exists
import { User } from '../../core/database/prisma-types'; // Assuming this exists
import { VisualizationResponseDto } from './dto/visualization.response.dto';
import { VisualizationRequestDto } from './dto/visualization.request.dto';
import { Request } from 'express';

@Controller('api/visualizations') // Define the base route
@UseGuards(JwtAuthGuard) // Protect routes
export class VisualizationController {
  // Inject Logger and Service
  constructor(
    private readonly visualizationService: VisualizationService,
    private readonly logger: Logger,
  ) {}

  @Get(':dataSourceId')
  async generateVisualization(
    @Param('dataSourceId') dataSourceId: string, // Use appropriate pipe if ID is numeric/UUID
    @GetUser() user: User, // Get authenticated user
    @Query() query: VisualizationRequestDto, // Use DTO for query params
    @Req() req: Request // Inject request to potentially get org ID later
  ): Promise<VisualizationResponseDto> {
    this.logger.log(
      `Generating visualization for dataSourceId: ${dataSourceId} by user: ${user.id}`,
      VisualizationController.name,
    );
    this.logger.debug(`Query parameters: ${JSON.stringify(query)}`);
    
    // TODO: Get organizationId reliably, perhaps from user object or JWT?
    // Assuming organizationId is needed by the service later for permissions.
    const organizationId = 1; // Placeholder
    this.logger.warn(`Using placeholder organizationId: ${organizationId}`);

    try {
      const visualizationData =
        await this.visualizationService.generateVisualization(
          dataSourceId,
          user.id, // Pass user ID if needed by service
          query, // Pass the validated DTO
        );
      if (!visualizationData) {
         this.logger.warn(`No visualization data found for dataSourceId: ${dataSourceId}`, VisualizationController.name);
         // Decide if controller should return 404 or if service handles fallback internally
         throw new NotFoundException(`Visualization data not found for data source ${dataSourceId}`);
      }
      return visualizationData;
    } catch (error) {
       this.logger.error(
         `Failed to generate visualization for dataSourceId: ${dataSourceId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
         error instanceof Error ? error.stack : undefined,
         VisualizationController.name,
       );
       // Re-throw specific NestJS exceptions or wrap unknown errors
       if (error instanceof NotFoundException) {
         throw error;
       }
       // Add other specific error checks if needed (e.g., BadRequestException)
       throw new InternalServerErrorException('Failed to generate visualization');
    }
  }

  @Post(':dataSourceId')
  async generateCustomVisualization(
    @Param('dataSourceId') dataSourceId: string,
    @GetUser() user: User,
    @Body() options: VisualizationRequestDto,
  ): Promise<VisualizationResponseDto> {
    this.logger.log(
      `Generating custom visualization for dataSourceId: ${dataSourceId} by user: ${user.id}`,
      VisualizationController.name,
    );
    try {
      const visualizationData =
        await this.visualizationService.generateVisualization(
          dataSourceId,
          user.id,
          options, // Pass the options to the service
        );
      if (!visualizationData) {
         this.logger.warn(`No visualization data found for dataSourceId: ${dataSourceId}`, VisualizationController.name);
         throw new NotFoundException(`Visualization data not found for data source ${dataSourceId}`);
      }
      return visualizationData;
    } catch (error) {
       this.logger.error(
         `Failed to generate custom visualization for dataSourceId: ${dataSourceId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
         error instanceof Error ? error.stack : undefined,
         VisualizationController.name,
       );
       if (error instanceof NotFoundException) {
         throw error;
       }
       throw new InternalServerErrorException('Failed to generate custom visualization');
    }
  }

  // Example endpoint for specific visualization type (could be combined with above)
  /**
   * GET /api/visualizations/:dataSourceId/qdrant
   * Deprecated or Example: Generate specific Qdrant visualization.
   */
  @Get(':dataSourceId/qdrant')
  async getQdrantVisualization(
    @Param('dataSourceId') dataSourceId: string,
    @GetUser() user: User
  ) {
    this.logger.log(`Received Qdrant visualization request for dataSourceId: ${dataSourceId} by user: ${user.id}`);
    // Assuming default options for this specific endpoint
    const query: VisualizationRequestDto = {}; // Empty options

    // TODO: Get organizationId reliably
    const organizationId = 1; // Placeholder
    this.logger.warn(`Using placeholder organizationId: ${organizationId}`);

    // Pass user.id (number) directly to the service
    return this.visualizationService.generateVisualization(
      dataSourceId,
      user.id,
      query
    );
  }
} 