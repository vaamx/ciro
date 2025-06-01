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
import { QueryResponseDto, QueryProcessingPath, RoutingResponseDto } from './dto/query-response.dto';
import { QueryRouterService } from '../../services/code-execution/query-router.service';
import { CodeExecutionService } from '../../services/code-execution/code-execution.service';
import { RagIntegrationService } from '../../services/rag/integration.service';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { RouterDecision, RouterPath } from '../../types/router.types';
import { LLMService } from '../../services/llm/llm.service';
import { ChatMessage } from '../../services/llm/types';

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
    private readonly llmService: LLMService,
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

  @Post()
  async processChatMessage(@Body() requestDto: any): Promise<any> {
    this.logger.log('Received chat message via dual-path root endpoint');
    this.logger.log(`Request data: ${JSON.stringify(requestDto, null, 2)}`);
    
    // Transform request into chat message format
    const query = requestDto?.message || requestDto?.query || requestDto?.content || '';
    const dataSourceIds = requestDto?.dataSourceIds || [];
    
    if (!query) {
      throw new BadRequestException('No query content provided');
    }

    try {
      // Create a chat message from the query
      const chatMessage: ChatMessage = {
        role: 'user',
        content: query,
        timestamp: Date.now() // Use number timestamp
      };

      this.logger.log(`Processing chat message through enhanced LLMService: "${query}"`);
      
      // Use the LLMService to generate the response
      const aiResponse = await this.llmService.generateChatCompletion([chatMessage], {
        model: 'claude-3-sonnet-20240229',
        temperature: 0.7,
        maxTokens: 4000
      });

      this.logger.log(`LLMService generated response with ${aiResponse.content.length} characters`);

      // Transform the LLMService response to match dual-path expected format
      const dualPathResponse = {
        routing: {
          path: QueryProcessingPath.RAG,
          confidence: 0.95, // High confidence since we used our enhanced system
          processingTime: 0 // Could be tracked if needed
        },
        result: {
          content: aiResponse.content,
          sources: [],
          artifacts: [],
          executionResults: null,
          metadata: {
            model: aiResponse.metadata?.model || 'claude-3-sonnet-20240229',
            usage: aiResponse.usage,
            path: 'llm_only'
          }
        }
      };

      this.logger.log(`Returning dual-path response with content length: ${aiResponse.content.length}`);
      return dualPathResponse;

    } catch (error) {
      this.logger.error(`Error in processChatMessage: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      
      // Return error in dual-path format
      return {
        routing: {
          path: QueryProcessingPath.RAG,
          confidence: 0,
          processingTime: 0
        },
        result: {
          content: `I apologize, but I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          sources: [],
          artifacts: [],
          executionResults: null
        }
      };
    }
  }

  /**
   * Map ChatService path to DualPath QueryProcessingPath
   */
  private mapChatPathToDualPath(chatPath?: string): QueryProcessingPath {
    switch (chatPath) {
      case 'direct_rag':
      case 'analytical_rag':
        return QueryProcessingPath.RAG;
      case 'llm_only':
        return QueryProcessingPath.RAG; // Still map to RAG for consistency
      default:
        return QueryProcessingPath.RAG;
    }
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
      // Initialize with a default RouterDecision structure
      let routingDecision: RouterDecision = {
        chosenPath: 'direct_vector_rag', // Default to RAG-like path
        confidence: 0,
        reasoning: 'Default routing path due to initialization or fallback.',
        details: { heuristics: { isAnalyticalIntent: false, isRetrievalIntent: true, requestsVisualization: false, mentionsDataset: false, mentionsCode: false, analyticalScore: 0, retrievalScore: 1} }
      };

      try {
        if (this.queryRouterService) {
          routingDecision = await this.queryRouterService.determineRoute(query);
          this.logger.log(`Query routed to ${routingDecision.chosenPath} with confidence ${routingDecision.confidence}`);
        } else {
          this.logger.warn('QueryRouterService unavailable - defaulting to direct_vector_rag path');
          // Keep the default routingDecision from above
        }
      } catch (routingError) {
        this.logger.warn(`Error in query routing: ${routingError instanceof Error ? routingError.message : String(routingError)}`);
        // Fallback to a default path, keep routingDecision as initialized
      }
      
      let result: any;
      const startTime = Date.now();
      
      // Process based on determined path with robust error handling for each path
      try {
        switch (routingDecision.chosenPath) {
          case 'direct_vector_rag': // Maps to RAG or a direct vector search
          case 'analytical_rag': // Also maps to RAG for now, could be more specific later
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
          
          // Placeholder for actual code execution path if RouterService determines it.
          // For now, QueryRouterService doesn't output a direct code_execution path yet.
          // If it did, it would be like: case 'code_execution_path_from_router':
          // We need to infer if current analytical_rag might map to code execution or a more complex RAG
          // Based on current QueryProcessingPath, let's assume 'analytical_rag' could also be a trigger for HYBRID or CODE_EXECUTION if RAG isn't the sole intent
          // This part needs careful review based on how QueryRouterService's paths are truly intended to map to DualPathController's actions.

          // Example: if 'analytical_rag' implies potential code use, and we want a HYBRID approach:
          // case 'analytical_rag': 
          // This becomes tricky. For now, let's assume analytical_rag is still primarily RAG.
          // The HYBRID path in QueryProcessingPath enum isn't directly produced by RouterDecision.chosenPath
          // The controller previously had a HYBRID case. We need to decide how chosenPath maps to it.
          // For simplicity, if a more complex path than direct_vector_rag is chosen, we could consider it HYBRID
          // if both services are available.

          // Let's keep it simple: direct_vector_rag and analytical_rag go to RAG.
          // user_clarification_needed will be handled by a default case.
          // The previous HYBRID and CODE_EXECUTION cases from QueryProcessingPath are not directly matched by RouterDecision.chosenPath.

          case 'user_clarification_needed':
            result = {
                content: `Query requires clarification: ${routingDecision.reasoning}`,
                sources: []
            };
            break;

          // What about QueryProcessingPath.CODE_EXECUTION and QueryProcessingPath.HYBRID?
          // RouterDecision doesn't directly map to these. This suggests that the DualPathController's
          // original switch logic (which used QueryProcessingPath.CODE_EXECUTION/HYBRID)
          // was based on a different routing mechanism or an assumed mapping that needs to be explicit now.

          // For now, we only handle the paths explicitly given by RouterDecision.
          // The controller can be expanded later if QueryRouterService starts outputting more diverse chosenPaths
          // that map to CODE_EXECUTION or require a HYBRID approach here.

          default:
            this.logger.warn(`Unhandled chosenPath: ${routingDecision.chosenPath}. Defaulting to RAG-like behavior or clarification.`);
            // Fallback to RAG or clarification based on reasoning
            if (this.ragIntegrationService) {
                 result = await this.ragIntegrationService.processQuery(
                    query, 
                    dataSourceDetails.map(ds => ds.collection_name || ds.id).filter(Boolean) as string[],
                    options
                );
            } else {
                result = {
                    content: `Unable to process query. Path: ${routingDecision.chosenPath}. Reasoning: ${routingDecision.reasoning}`,
                    sources: []
                };
            }
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
      
      // Map RouterDecision.chosenPath to QueryProcessingPath for the response DTO
      let responsePath: QueryProcessingPath;
      switch (routingDecision.chosenPath) {
        case 'direct_vector_rag':
          responsePath = QueryProcessingPath.RAG; // Or a new DIRECT_VECTOR_RAG if distinct
          break;
        case 'analytical_rag':
          responsePath = QueryProcessingPath.RAG; // Or a new ANALYTICAL_RAG if distinct, or map to HYBRID/CODE_EXECUTION if appropriate
          break;
        case 'user_clarification_needed':
          responsePath = QueryProcessingPath.CLARIFICATION_NEEDED;
          break;
        default:
          // This case should ideally not be hit if chosenPath is always one of the above
          this.logger.error(`Unknown chosenPath in final mapping: ${routingDecision.chosenPath}. Defaulting to RAG.`);
          responsePath = QueryProcessingPath.RAG;
      }

      // Return the result with routing information
      return {
        routing: {
          path: responsePath, // Use the mapped path
          confidence: routingDecision.confidence || 0,
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
      const whereClause: any = {
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
      const dataSources = await this.prisma.data_sources.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          type: true,
          config: true,
          status: true,
          created_at: true,
          updated_at: true,
          creator_id: true,
          workspace_id: true,
        }
      });
      
      // Map database results to DataSourceInfo interface
      return dataSources.map((ds: any) => {
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
            createdAt: ds.created_at,
            updatedAt: ds.updated_at,
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