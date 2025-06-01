import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { users } from '../../core/database/prisma-types';
import { SearchService } from './search.service';
import { SearchResponseDto } from './dto/search-response.dto';
import { SearchQueryParamsDto } from './dto/search-query-params.dto';
import { SearchRequestDto } from './dto/search-request.dto';
import { AnalyticalSearchDto } from './dto/analytical-search.dto';
import { AnalyticalSearchResponseDto } from './dto/analytical-search-response.dto';
import { Request, Response } from '../../types';
import { BadRequestError, NotFoundError } from '../../common/utils/errors';
import { logger } from '../../common/utils/logger';

@Controller('api/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  private readonly logger;

  constructor(
    private readonly searchService: SearchService,
  ) {
    this.logger = logger.child({ service: 'SearchController' });
  }

  @Get()
  async searchSimilarDocuments(
    @Query() queryParams: SearchQueryParamsDto,
    @GetUser() user: users
  ): Promise<SearchResponseDto> {
    const { query, fileIds, limit } = queryParams;
    
    this.logger.info(
      `Search request received - query: "${query}", fileIds: ${fileIds}, limit: ${limit}, userId: ${user.id}`
    );
    
    if (!query || !query.trim()) {
      this.logger.warn(`Search rejected - empty query from user ${user.id}`);
      throw new BadRequestException('Query is required');
    }
    
    try {
      const searchResults = await this.searchService.searchSimilarDocuments(
        query,
        user.id.toString(),
        fileIds,
        limit
      );
      
      this.logger.info(
        `Search completed - query: "${query}", results: ${searchResults.total}`
      );
      
      return searchResults;
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(
        `Search error - query: "${query}", error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw new InternalServerErrorException(
        'Failed to perform search operation'
      );
    }
  }

  @Post()
  async searchSimilarDocumentsPost(
    @Body() searchRequestDto: SearchRequestDto,
    @GetUser() user: users
  ): Promise<SearchResponseDto> {
    const { query, fileIds, limit, userId } = searchRequestDto;
    
    this.logger.info(
      `Search POST request received - query: "${query}", fileIds: ${fileIds}, limit: ${limit}, userId: ${userId || user.id}`
    );
    
    // Use the service to perform the search
    try {
      const searchResults = await this.searchService.searchSimilarDocuments(
        query,
        (userId || user.id).toString(),
        fileIds,
        limit?.toString()
      );
      
      this.logger.info(
        `Search POST completed - query: "${query}", results: ${searchResults.total}`
      );
      
      return searchResults;
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(
        `Search POST error - query: "${query}", error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw new InternalServerErrorException(
        'Failed to perform search operation'
      );
    }
  }

  @Get('user-files')
  async getUserFiles(@GetUser() user: users) {
    this.logger.info(`Retrieving files for user ${user.id}`);
    
    try {
      const files = await this.searchService.getUserFiles(user.id.toString());
      
      this.logger.info(`Retrieved ${files.total} files for user ${user.id}`);
      
      return files;
    } catch (error) {
      this.logger.error(
        `Error retrieving files for user ${user.id} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      throw new InternalServerErrorException('Failed to retrieve user files');
    }
  }

  /**
   * Endpoint for performing analytical searches
   */
  @Post('analytical')
  async analyticalSearch(
    @Body() analyticalSearchDto: AnalyticalSearchDto,
    @GetUser() user: users
  ): Promise<AnalyticalSearchResponseDto> {
    try {
      // Validate required fields
      if (!analyticalSearchDto.query) {
        throw new BadRequestException('Analytical query is required');
      }
      
      this.logger.info(
        `Analytical search request - query: "${analyticalSearchDto.query}", userId: ${user.id}`
      );
      
      // Check if this is truly an analytical query
      if (!this.isAnalyticalQuery(analyticalSearchDto.query)) {
        throw new BadRequestException('The provided query is not an analytical query. Use /search endpoint instead.');
      }
      
      // Call the search service for analytical search
      const searchResults = await this.searchService.searchSimilarDocuments(
        analyticalSearchDto.query,
        user.id.toString(),
        analyticalSearchDto.fileIds,
        analyticalSearchDto.limit
      );
      
      this.logger.info(
        `Analytical search completed - query: "${analyticalSearchDto.query}", results processed for entity extraction`
      );
      
      // Extract entity information from search results
      const entityMentions = this.extractEntitiesWithContext(
        searchResults.results,
        analyticalSearchDto.entityTypes,
        analyticalSearchDto.includeContext
      );
      
      // Calculate totals
      const totalEntities = Object.keys(entityMentions).length;
      const totalMentions = Object.values(entityMentions).reduce((sum, entity) => sum + entity.count, 0);
      
      this.logger.info(
        `Analytical search entity extraction - entities: ${totalEntities}, mentions: ${totalMentions}`
      );
      
      // Return analytical response
      return new AnalyticalSearchResponseDto({
        query: analyticalSearchDto.query,
        entities: entityMentions,
        totalEntities,
        totalMentions,
        searchedFiles: analyticalSearchDto.fileIds ? analyticalSearchDto.fileIds.split(',') : []
      });
    } catch (error) {
      this.logger.error(
        `Error in analytical search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      
      if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof Error) {
        throw new InternalServerErrorException(
          'An error occurred while processing the analytical search: ' + error.message
        );
      } else {
        throw new InternalServerErrorException(
          'An error occurred while processing the analytical search'
        );
      }
    }
  }

  /**
   * Extract entities with context from search results
   * @private
   */
  private extractEntitiesWithContext(
    results: any[],
    entityTypes?: string[],
    includeContext: boolean = false
  ): Record<string, { text: string, count: number, context?: string[], files?: string[] }> {
    const entityMentions: Record<string, { text: string, count: number, context?: string[], files?: string[] }> = {};
    
    for (const result of results) {
      const content = result.content || '';
      const fileId = result.fileId;
      
      // Extract entities from the content
      const entities = this.extractEntitiesFromContent(content, entityTypes);
      
      // Count occurrences of each entity
      for (const entity of entities) {
        if (!entityMentions[entity]) {
          entityMentions[entity] = {
            text: entity,
            count: 0,
            context: includeContext ? [] : undefined,
            files: []
          };
        }
        
        entityMentions[entity].count++;
        
        // Add file ID if not already in the list
        if (fileId && !entityMentions[entity].files?.includes(fileId)) {
          entityMentions[entity].files?.push(fileId);
        }
        
        // Add context if requested
        if (includeContext) {
          const context = this.extractContext(content, entity);
          if (context && entityMentions[entity].context) {
            entityMentions[entity].context.push(context);
          }
        }
      }
    }
    
    return entityMentions;
  }
  
  /**
   * Extract a snippet of context around an entity mention
   * @private
   */
  private extractContext(content: string, entity: string): string | null {
    if (!content || !entity) return null;
    
    const maxContextLength = 100; // Characters on each side of the entity
    const escapedEntity = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
    
    // Find the entity in the content
    const regex = new RegExp(`(.{0,${maxContextLength}})${escapedEntity}(.{0,${maxContextLength}})`, 'i');
    const match = content.match(regex);
    
    if (match && match.length >= 3) {
      // Construct context with the entity in the middle
      const before = match[1];
      const after = match[2];
      return `...${before}${entity}${after}...`;
    }
    
    return null;
  }

  /**
   * Determine if a query is an analytical query
   * @private
   */
  private isAnalyticalQuery(query: string): boolean {
    // Check if the query is asking for an analysis or count
    const analyticalPatterns = [
      /\bcount\b/i,
      /\banalyz(e|is)\b/i,
      /\bhow many\b/i,
      /\bsummariz(e|ing)\b/i,
      /\btrend(s)?\b/i,
      /\bcompare\b/i,
      /\bcomparison\b/i,
      /\bcorrelation\b/i,
      /\bstatistic(s|al)?\b/i,
      /\bfrequency\b/i,
      /\boccurrence(s)?\b/i,
      /\bmention(s|ed)?\b/i,
      /\bquantify\b/i,
    ];
    
    // Check for VC fund count pattern
    const vcFundPattern = /\b(vc|venture capital|investor)(s)?\b.*\b(firm|fund|compan)(y|ies|s)?\b/i;
    
    return analyticalPatterns.some(pattern => pattern.test(query)) || vcFundPattern.test(query);
  }

  /**
   * Extract entities from content
   * @private
   */
  private extractEntitiesFromContent(content: string, entityTypes?: string[]): string[] {
    // This is a simplified implementation that would be replaced with a real NER system
    // For now, we'll just extract capitalized phrases as potential entities
    const entities: string[] = [];
    
    // Basic regex for capitalized phrases that might be entities
    const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    
    // Find all matches
    let match;
    while ((match = entityPattern.exec(content)) !== null) {
      entities.push(match[1]);
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }
} 