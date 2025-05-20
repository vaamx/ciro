import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Res,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryRequestDto } from './dto/query-request.dto';
import { StreamRequestDto } from './dto/stream-request.dto';
import { QueryResponseDto, QueryProcessingPath } from './dto/query-response.dto';
import { QueryRouterService } from '@services/code-execution/query-router.service';
import { CodeExecutionService } from '@services/code-execution/code-execution.service';
import { RagIntegrationService } from '@services/rag/integration.service';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';

interface DataSourceInfo {
  id: string | number;
  name: string;
  data_type?: string;
  type?: string;
  collection_name?: string;
  metadata?: any;
  file_path?: string;
  file_type?: string;
  original_filename?: string;
}

@Controller('api/dual-path')
export class DualPathController {
  private readonly logger = new Logger(DualPathController.name);

  constructor(
    @Inject('DualPathQueryRouterService')
    @Optional() private readonly queryRouterService: QueryRouterService,
    
    @Inject('DualPathCodeExecutionService')
    @Optional() private readonly codeExecutionService: CodeExecutionService,
    
    @Inject('DualPathRagIntegrationService')
    @Optional() private readonly ragIntegrationService: RagIntegrationService,
    
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('DualPathController initializing...');
    
    if (!queryRouterService) {
      this.logger.warn('QueryRouterService is not available in DualPathController');
    } else {
      this.logger.log('QueryRouterService successfully injected');
    }
    
    if (!codeExecutionService) {
      this.logger.warn('CodeExecutionService is not available in DualPathController');
    } else {
      this.logger.log('CodeExecutionService successfully injected');
    }
    
    if (!ragIntegrationService) {
      this.logger.warn('RagIntegrationService is not available in DualPathController');
    } else {
      this.logger.log('RagIntegrationService successfully injected');
    }
    
    if (!prisma) {
      this.logger.error('PrismaService is not available in DualPathController - critical dependency missing');
      throw new Error('PrismaService is required but not available');
    } else {
      this.logger.log('PrismaService successfully injected');
    }
    
    this.logger.log('DualPathController initialization complete');
  }

  @Post('query')
  async processQuery(@Body() queryRequestDto: QueryRequestDto): Promise<QueryResponseDto> {
    const { query, dataSourceIds = [], options = {} } = queryRequestDto;
    
    this.logger.log('Received dual-path query');
    
    try {
      // Check if essential services are available
      const serviceUnavailabilityMessage = this.checkRequiredServices();
      if (serviceUnavailabilityMessage) {
        return this.createServiceUnavailableResponse(serviceUnavailabilityMessage);
      }

      // Safely get data source information with fallback for missing PrismaService
      let dataSourceDetails: DataSourceInfo[] = [];
      try {
        dataSourceDetails = await this.getDataSourceInfo(dataSourceIds);
      } catch (dataSourceError) {
        this.logger.warn(`Error fetching data source details: ${dataSourceError instanceof Error ? dataSourceError.message : String(dataSourceError)}`);
        // Continue with empty data source details rather than failing completely
      }

      // Determine the appropriate processing path - with fallback
      let routingResult = { path: QueryProcessingPath.RAG, confidence: 0 };
      try {
        if (this.queryRouterService) {
          routingResult = await this.queryRouterService.routeQuery(query);
          this.logger.log(`Query routed to ${routingResult.path} with confidence ${routingResult.confidence}`);
        } else {
          this.logger.warn('QueryRouterService unavailable - defaulting to RAG path');
        }
      } catch (routingError) {
        this.logger.warn(`Error in query routing: ${routingError instanceof Error ? routingError.message : String(routingError)}`);
        // Fallback to RAG as default path
      }
      
      let result: any;
      const startTime = Date.now();
      
      // Process based on determined path with robust error handling for each path
      try {
        switch (routingResult.path) {
          case QueryProcessingPath.RAG:
            // Handle RAG path
            if (!this.ragIntegrationService) {
              this.logger.warn('RAG integration service unavailable');
              result = {
                content: 'The RAG processing service is still initializing. Please try again in a moment.',
                sources: []
              };
              break;
            }
            
            result = await this.ragIntegrationService.processQuery(
              query, 
              dataSourceDetails.map(ds => ds.collection_name || ds.id).filter(Boolean) as string[],
              options
            );
            break;
            
          case QueryProcessingPath.CODE_EXECUTION:
            // Handle code execution path
            if (!this.codeExecutionService) {
              this.logger.warn('Code execution service unavailable');
              result = {
                content: 'The code execution service is still initializing. Please try again in a moment.',
                sources: []
              };
              break;
            }
            
            result = await this.codeExecutionService.executePipeline(
              query, 
              dataSourceIds,
              {
                ...options,
                // Pass file information to code execution service
                dataSourceDetails
              }
            );
            break;
            
          case QueryProcessingPath.HYBRID:
            // Handle hybrid path - execute both approaches and combine results
            if (!this.ragIntegrationService && !this.codeExecutionService) {
              this.logger.warn('Both RAG and code execution services unavailable');
              result = {
                content: 'The services required for hybrid processing are still initializing. Please try again in a moment.',
                sources: []
              };
              break;
            }
            
            // If one service is available but not the other, use the available one
            if (!this.ragIntegrationService) {
              this.logger.warn('RAG service unavailable for hybrid processing, using only code execution');
              result = await this.codeExecutionService.executePipeline(
                query, 
                dataSourceIds,
                {
                  ...options,
                  dataSourceDetails
                }
              );
              break;
            }
            
            if (!this.codeExecutionService) {
              this.logger.warn('Code execution service unavailable for hybrid processing, using only RAG');
              result = await this.ragIntegrationService.processQuery(
                query, 
                dataSourceDetails.map(ds => ds.collection_name || ds.id).filter(Boolean) as string[],
                options
              );
              break;
            }
            
            // Both services are available, proceed with hybrid approach
            const [ragResult, codeResult] = await Promise.all([
              this.ragIntegrationService.processQuery(
                query, 
                dataSourceDetails.map(ds => ds.collection_name || ds.id).filter(Boolean) as string[],
                options
              ),
              this.codeExecutionService.executePipeline(
                query, 
                dataSourceIds,
                {
                  ...options,
                  // Pass file information to code execution service
                  dataSourceDetails
                }
              )
            ]);
            
            result = {
              ragResult,
              codeExecutionResult: codeResult
            };
            break;
            
          default:
            // Default fallback
            result = {
              content: 'Unable to process query with the specified routing path',
              sources: []
            };
            break;
        }
      } catch (processingError) {
        this.logger.error(`Error in query processing: ${processingError instanceof Error ? processingError.message : String(processingError)}`);
        // Provide a graceful fallback response
        result = {
          content: `We encountered an issue processing your query: ${processingError instanceof Error ? processingError.message : 'Unknown error'}. Please try again or simplify your query.`,
          sources: []
        };
      }
      
      // Add process metrics
      const processingTime = Date.now() - startTime;
      
      // Return the result with routing information
      return {
        routing: {
          ...routingResult,
          processingTime
        },
        result
      };
      
    } catch (error) {
      this.logger.error(`Error processing dual-path query: ${error instanceof Error ? error.message : String(error)}`);
      
      // Throw appropriate NestJS exceptions based on error type
      if (error instanceof HttpException) {
        throw error; // Re-throw if it's already a HttpException
      }
      
      throw new InternalServerErrorException(
        'Error processing query',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  @Post('stream')
  async streamResponse(
    @Body() streamRequestDto: StreamRequestDto,
    @Res() res: Response
  ): Promise<void> {
    try {
      // Set up SSE headers regardless of service availability
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Initial progress message
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Starting processing...' })}\n\n`);
      
      // Check required services
      const serviceUnavailabilityMessage = this.checkRequiredServices();
      if (serviceUnavailabilityMessage) {
        // Send error message for unavailable services but keep connection alive for UI feedback
        setTimeout(() => {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: serviceUnavailabilityMessage
          })}\n\n`);
          res.end();
        }, 1000);
        return;
      }

      const { query, dataSourceIds = [], options = {} } = streamRequestDto;
      
      if (!query) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: 'Query is required'
        })}\n\n`);
        res.end();
        return;
      }
      
      // For now, we'll keep the simple implementation while we develop the streaming capability
      // In a future implementation, this should use actual service streaming capabilities
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing query...' })}\n\n`);
      }, 500);
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Retrieving data...' })}\n\n`);
      }, 1000);
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Generating response...' })}\n\n`);
      }, 1500);
      
      // Send chunks of the response
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'content', message: 'Based on the analysis of your data:\n\n' })}\n\n`);
      }, 2000);
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'content', message: '1. Average value: 8.2\n' })}\n\n`);
      }, 2500);
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'content', message: '2. Maximum value: 19\n' })}\n\n`);
      }, 3000);
      
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'content', message: '3. Minimum value: 2\n' })}\n\n`);
      }, 3500);
      
      // Send completion and end stream
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
      }, 4000);
      
    } catch (error) {
      this.logger.error(`Error in stream response: ${error instanceof Error ? error.message : String(error)}`);
      
      try {
        // Try to send error response if headers haven't been sent
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
        }
        
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'An unknown error occurred'
        })}\n\n`);
        res.end();
      } catch (responseError) {
        this.logger.error(`Failed to send error response: ${responseError instanceof Error ? responseError.message : String(responseError)}`);
        // If all else fails, try a basic end
        try { res.end(); } catch (e) { /* Ignore */ }
      }
    }
  }

  /**
   * Helper method to check if required services are available
   * @returns A message if services are unavailable, or null if all services are available
   */
  private checkRequiredServices(): string | null {
    const missingServices = [];
    
    if (!this.queryRouterService) missingServices.push('Query Router');
    if (!this.codeExecutionService) missingServices.push('Code Execution');
    if (!this.ragIntegrationService) missingServices.push('RAG Integration');
    
    if (missingServices.length > 0) {
      return `The following required services are not fully initialized yet: ${missingServices.join(', ')}. Please try again in a moment.`;
    }
    
    return null;
  }
  
  /**
   * Create a standard response when services are unavailable
   */
  private createServiceUnavailableResponse(message: string): QueryResponseDto {
    return {
      routing: {
        path: QueryProcessingPath.RAG,
        confidence: 0,
        processingTime: 0
      },
      result: {
        content: message,
        sources: []
      }
    };
  }

  private async getDataSourceInfo(dataSourceIds: string[]): Promise<DataSourceInfo[]> {
    if (!this.prisma) {
      this.logger.warn('PrismaService unavailable - returning empty data source info');
      return dataSourceIds.map(id => ({ id, name: `Source ${id}` }));
    }
    
    if (!dataSourceIds || dataSourceIds.length === 0) {
      return [];
    }
    
    try {
      // Convert string IDs to numbers for database query
      const ids = dataSourceIds.map(id => {
        const numId = Number(id);
        return isNaN(numId) ? id : numId;
      });
      
      const numericIds = ids.filter(id => typeof id === 'number') as number[];
      const stringIds = ids.filter(id => typeof id === 'string') as string[];
      
      if (numericIds.length === 0 && stringIds.length === 0) {
        return [];
      }
      
      // Build where clause for both numeric and string IDs
      const whereClause: Prisma.DataSourceWhereInput = {
        OR: []
      };
      
      if (numericIds.length > 0) {
        whereClause.OR!.push({ id: { in: numericIds } });
      }
      
      if (stringIds.length > 0) {
        // Handle string IDs (e.g., collection names) if needed
        // This is a placeholder - adjust according to your schema
        // whereClause.OR!.push({ collection_name: { in: stringIds } });
      }
      
      // Only keep OR if we have conditions
      if (whereClause.OR!.length === 0) {
        delete whereClause.OR;
      }
      
      // Query database for data sources
      const dataSources = await this.prisma.dataSource.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          type: true,
          config: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          creatorId: true,
          workspaceId: true,
        }
      });
      
      // Map database results to DataSourceInfo interface
      return dataSources.map(ds => {
        // Parse config if it's a JSON string
        let config = {};
        if (typeof ds.config === 'string') {
          try {
            config = JSON.parse(ds.config);
          } catch (e) {
            this.logger.warn(`Failed to parse config for data source ${ds.id}`);
          }
        } else if (ds.config && typeof ds.config === 'object') {
          config = ds.config;
        }
        
        return {
          id: ds.id,
          name: ds.name || `Source ${ds.id}`,
          type: ds.type || 'unknown',
          collection_name: `datasource_${ds.id}`,
          metadata: {
            ...config,
            createdAt: ds.createdAt,
            updatedAt: ds.updatedAt,
            status: ds.status
          }
        };
      });
    } catch (error) {
      this.logger.error(`Error fetching data source info: ${error instanceof Error ? error.message : String(error)}`);
      // Return basic info based on IDs to avoid complete failure
      return dataSourceIds.map(id => ({ id, name: `Source ${id}` }));
    }
  }
} 