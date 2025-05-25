import { Injectable, Logger, NotFoundException, InternalServerErrorException, BadRequestException, Optional } from '@nestjs/common';
// Import necessary services - names are assumptions, adjust as needed
import { DataSourceManagementService } from '../../services/datasources/management/datasource-management.service'; // Corrected path and name
// Import specific Qdrant services provided by ServicesModule
import { QdrantClientService } from '../../services/vector/qdrant-client.service';
import { QdrantCollectionService } from '../../services/vector/collection-manager.service';
import { SnowflakeService } from '../../services/datasources/connectors/snowflake/snowflake.service'; // Corrected path
import { OpenAIService, ChatMessage } from '../../services/ai/openai.service'; // Correct path from ServicesModule, assuming file is infra/ai/openai/openai.service.ts
import { VisualizationResponseDto } from './dto/visualization.response.dto';
import { VisualizationRequestDto } from './dto/visualization.request.dto';
// Import necessary types/entities if needed (e.g., DataSource entity)
import { DataSource, FileStatus, DataSourceType } from '../../core/database/prisma-types'; // Updated to include FileStatus and DataSourceType
// Import Qdrant types - use types directly if available, else use any as fallback
// import type { PointStruct as QdrantPointStruct } from '@qdrant/js-client-rest'; // Removed potentially incorrect import
type PointStruct = any; // Using any as fallback for Qdrant points
import { QdrantIngestionService } from '../../services/vector/ingestion.service';
import { createServiceLogger } from '../../common/utils/logger-factory';

// Add interface for Snowflake metadata
interface SnowflakeMetadata {
  database?: string;
  schema?: string;
  table?: string;
  tableCount?: number;
  indexing_status?: {
    current_table?: string;
  };
  error?: string;
}

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);

  // Default colors for visualizations (copied from legacy)
  private defaultColors = [
    '#4C78DB', // blue
    '#F58518', // orange
    '#54A24B', // green
    '#E45756', // red
    '#72B7B2', // teal
    '#9D755D', // brown
    '#EECA3B', // yellow
    '#B279A2', // purple
    '#FF9DA6', // pink
    '#BAB0AC'  // gray
  ];

  // Inject specific dependencies based on ServicesModule and findings
  constructor(
    @Optional() private readonly dataSourceManagementService: DataSourceManagementService,
    @Optional() private readonly qdrantClientService: QdrantClientService,
    @Optional() private readonly qdrantCollectionService: QdrantCollectionService,
    @Optional() private readonly snowflakeService: SnowflakeService,
    @Optional() private readonly openaiService: OpenAIService,
    @Optional() private readonly qdrantIngestionService: QdrantIngestionService,
  ) {
    if (!this.dataSourceManagementService) {
      this.logger.warn('DataSourceManagementService is not available. Some visualization features will be limited.');
    }
    
    if (!this.snowflakeService) {
      this.logger.warn('SnowflakeService is not available. Snowflake data source visualizations will be limited.');
    }

    if (!this.qdrantClientService) {
      this.logger.warn('QdrantClientService is not available. Qdrant-based visualizations will be limited.');
    }

    if (!this.qdrantCollectionService) {
      this.logger.warn('QdrantCollectionService is not available. Collection-based operations will be limited.');
    }

    if (!this.openaiService) {
      this.logger.warn('OpenAIService is not available. AI-powered visualizations will be limited.');
    }

    if (!this.qdrantIngestionService) {
      this.logger.warn('QdrantIngestionService is not available. Qdrant ingestion operations will be limited.');
    }
  }

  async generateVisualization(dataSourceId: string, userId: number, options?: VisualizationRequestDto): Promise<VisualizationResponseDto> {
    this.logger.log(`Service processing visualization for dataSourceId: ${dataSourceId}`, VisualizationService.name);

    try {
      // Check if DataSourceManagementService is available
      if (!this.dataSourceManagementService) {
        this.logger.warn(`DataSourceManagementService not available - returning fallback for ${dataSourceId}`);
        return this.getFallbackVisualization(dataSourceId);
      }
      
      // Replace getById with findByIdForUser and add organizationId
      const idAsNumber = parseInt(dataSourceId, 10);
      if (isNaN(idAsNumber)) {
        throw new BadRequestException('Invalid Data Source ID format');
      }
      
      // Use findByIdForUser instead of getById, with default organizationId=1 (temporary solution)
      const dataSource = await this.dataSourceManagementService.findByIdForUser(idAsNumber, userId, 1) as unknown as DataSource;
      
      if (!dataSource) {
        this.logger.warn(`DataSource ${dataSourceId} not found. Returning fallback.`, VisualizationService.name);
        return this.getFallbackVisualization(dataSourceId);
      }

      this.logger.log(`Found data source: ${dataSource.name} (${dataSource.type})`, VisualizationService.name);

      // Determine collection name with proper type checking
      let collectionName = `datasource_${dataSource.id}`;
      
      // Check if collection exists using the injected service
      if (!this.qdrantCollectionService) {
        this.logger.warn(`QdrantCollectionService not available - cannot check collection: ${collectionName}`);
        // Skip to snowflake check if possible
        if (dataSource.type === DataSourceType.SNOWFLAKE) {
          return await this.generateSnowflakeVisualization(dataSource, options);
        }
        return this.getFallbackVisualization(dataSourceId);
      }

      const collections = await this.qdrantCollectionService.listCollections();
      const collectionExists = collections.includes(collectionName);

      if (collectionExists) {
        this.logger.log(`Generating from Qdrant collection: ${collectionName}`, VisualizationService.name);
        // Call the now migrated Qdrant generation method
        return await this.generateQdrantVisualization(dataSource, collectionName);
      } else if (dataSource.type === DataSourceType.SNOWFLAKE) { 
        this.logger.log(`Generating from Snowflake for data source ${dataSource.id}`, VisualizationService.name);
        // Pass options to Snowflake visualization method
        return await this.generateSnowflakeVisualization(dataSource, options);
      } else {
        this.logger.warn(`No primary visualization source for ${dataSourceId}. Returning fallback.`, VisualizationService.name);
        return this.getFallbackVisualization(dataSourceId);
      }

    } catch (error) {
      // Added check for BadRequestException from parseInt
      if (error instanceof BadRequestException) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error in visualization service for ${dataSourceId}: ${errorMessage}`, errorStack, VisualizationService.name);
      // Return fallback on error as per legacy logic (and current implementation)
      try {
        return this.getFallbackVisualization(dataSourceId);
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error';
        const fallbackErrorStack = fallbackError instanceof Error ? fallbackError.stack : undefined;
        this.logger.error(`Fallback generation also failed: ${fallbackErrorMessage}`, fallbackErrorStack, VisualizationService.name);
        throw new InternalServerErrorException('Failed to generate visualization or fallback');
      }
    }
  }

  // --- Fallback Method (Already Migrated) ---
  private getFallbackVisualization(dataSourceId: string): VisualizationResponseDto {
    this.logger.log(`Refactored: Generating fallback visualization for ${dataSourceId}`, VisualizationService.name);
    // Logic migrated from legacy controller
    return {
      dataSourceId,
      title: `Data Analysis for Source ${dataSourceId} (Mock)`,
      description: 'This is mock data. The actual data source could not be found or processed.',
      isMockData: true,
      chartType: 'enhanced-bar-chart',
      config: {
        xAxis: { title: 'Month' },
        yAxis: { title: 'Value (in millions)' },
        colors: this.defaultColors.slice(0, 3) // Use service's default colors
      },
      data: [
        { month: "Jan", value: 65, prevValue: 20 }, { month: "Feb", value: 93, prevValue: 20 },
        { month: "Mar", value: 76, prevValue: 22 }, { month: "Apr", value: 44, prevValue: 30 },
        { month: "May", value: 4, prevValue: 28 }, { month: "Jun", value: 16, prevValue: 25 },
        { month: "Jul", value: 93, prevValue: 30 }, { month: "Aug", value: 98, prevValue: 28 },
        { month: "Sep", value: 50, prevValue: 29 }
      ],
    };
  }


  // --- Qdrant Visualization Logic (Migrated for Task 6.2) ---

  private async generateQdrantVisualization(dataSource: DataSource, collectionName: string): Promise<VisualizationResponseDto> {
    this.logger.log(`Generating visualization for Qdrant collection: ${collectionName}`, VisualizationService.name);
    
    // Check if QdrantClientService is available
    if (!this.qdrantClientService || !this.qdrantCollectionService) {
      this.logger.warn(`Qdrant services not available - returning fallback for collection: ${collectionName}`);
      return this.getFallbackVisualization(String(dataSource.id));
    }
    
    try {
      this.logger.log(`Fetching points from collection: ${collectionName}`);
      // Use migrated helper which uses injected service
      const points: PointStruct[] = await this.getAllPoints(collectionName, 100);
      this.logger.log(`Retrieved ${points?.length || 0} points from collection`);

      if (!points || points.length === 0) {
        this.logger.warn(`No data found in Qdrant collection: ${collectionName}`);
        throw new NotFoundException(`No data found in the Qdrant collection ${collectionName}`); // Use NestJS exception
      }

      // Extract data (logic copied)
      const extractedData = points.map(point => {
        let textContent = '';
        if (point.payload) {
            textContent = String(point.payload.text || point.payload.content || point.payload.page_content || '');
        }
        const metadata = { ...(point.payload?.metadata || {}) };
        const numericalFields: Record<string, number> = {};
        if (point.payload) {
            Object.entries(point.payload).forEach(([key, value]) => {
                if (typeof value === 'number' && key !== 'id') { numericalFields[key] = value; }
            });
        }
        // Ensure id type matches PointStruct definition (string | number)
        const id: string | number = typeof point.id === 'string' || typeof point.id === 'number' ? point.id : String(point.id);
        return { id, textContent, metadata, ...numericalFields, ...point.payload };
      });
      this.logger.log(`Processed ${extractedData.length} data points from Qdrant`);

      // Analyze fields (uses migrated helper)
      const metadataFieldCounts = this.analyzeFields(extractedData);
      this.logger.log(`Detected fields for visualization: ${JSON.stringify(metadataFieldCounts)}`);

      // Select fields (uses migrated helper)
      const visualizationFields = this.selectVisualizationFields(metadataFieldCounts, extractedData);
      this.logger.log(`Selected fields for visualization: ${JSON.stringify(visualizationFields)}`);

      // Determine type (uses migrated helper)
      let visualizationType = 'enhanced-bar-chart';
      let title = `${dataSource.name || 'Data'} Analysis`;
      let description = 'Analysis of key metrics from vector database';

      // Use OpenAI if available (uses migrated helper)
      if (extractedData.length >= 5) {
        try {
          const sampleData = extractedData.slice(0, 10);
          const analysisPrompt = this.buildDataAnalysisPrompt(dataSource, sampleData);
          this.logger.log('Sending analysis prompt to OpenAI');
          // Use migrated helper which uses injected service
          const analysis = await this.analyzeDataWithOpenAI(analysisPrompt);
          visualizationType = analysis.visualizationType || visualizationType;
          title = analysis.title || title;
          description = analysis.description || description;
          this.logger.log(`OpenAI recommended visualization type: ${visualizationType}`);
        } catch (aiError) {
          const aiErrorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI error';
          this.logger.warn(`Error getting visualization recommendation from OpenAI: ${aiErrorMessage}`);
        }
      }

      // Transform data (uses migrated helper)
      const transformedData = this.transformDataForVisualization(extractedData, visualizationType, visualizationFields);

      // Create config (uses migrated helper)
      const config = this.createVisualizationConfig(visualizationType, transformedData);

      // Return DTO
      const result: VisualizationResponseDto = {
        dataSourceId: String(dataSource.id),
        title, description, isMockData: false,
        chartType: visualizationType, config, data: transformedData,
      };
      this.logger.log(`Generated Qdrant visualization: ${title}`);
      return result;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        this.logger.warn(`Caught known exception during Qdrant generation: ${error.message}`);
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during Qdrant generation';
      this.logger.error(`Error generating Qdrant visualization: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException(`Failed to generate visualization from Qdrant: ${errorMessage}`);
    }
  }


  // --- Qdrant Helper Methods (Migrated) ---

  /** Get all points from a collection (Migrated & Refactored) */
  private async getAllPoints(collectionName: string, limit: number = 100): Promise<PointStruct[]> {
    if (!this.qdrantClientService) {
      this.logger.warn('QdrantClientService not available - cannot fetch points');
      return [];
    }
    
    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.error('Failed to get Qdrant client');
        return [];
      }
      
      const result = await client.scroll(collectionName, {
        limit,
        with_payload: true,
        with_vector: false // Usually vectors aren't needed for visualization
      });
      return result.points || []; // Return points array or empty array
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting points from collection ${collectionName}: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      // Throw specific exception
      throw new InternalServerErrorException(`Failed to retrieve data from Qdrant collection ${collectionName}: ${errorMessage}`);
    }
  }

  /** Analyze fields in the data (Migrated) */
  private analyzeFields(data: any[]): Record<string, { count: number, type: string }> {
    const fieldCounts: Record<string, { count: number, type: string }> = {};
    data.forEach(item => {
      Object.entries(item).forEach(([key, value]) => {
        if (!fieldCounts[key]) { fieldCounts[key] = { count: 0, type: typeof value }; }
        if (value !== null && value !== undefined) { fieldCounts[key].count++; }
      });
    });
    return fieldCounts;
  }

  /** Select the best fields for visualization (Migrated) */
  private selectVisualizationFields(
    fields: Record<string, { count: number, type: string }>,
    data: any[]
  ): { category?: string, value?: string, series?: string[] } {
    const potentialFields = Object.entries(fields).filter(([key, info]) => {
      if (key === 'id' || key === 'textContent' || key === 'metadata' || key === '_vector') return false;
      const threshold = data.length * 0.8;
      return info.count >= threshold;
    });
    potentialFields.sort((a, b) => b[1].count - a[1].count);

    let categoryField: string | undefined;
    let valueField: string | undefined;
    let seriesFields: string[] = [];

    for (const [key, info] of potentialFields) {
      if (info.type === 'string' && !categoryField) {
        const uniqueValues = new Set(data.map(item => item[key])).size;
        if (uniqueValues >= 2 && uniqueValues <= 20) categoryField = key;
      } else if (info.type === 'number' && !valueField) {
        valueField = key;
      } else if (info.type === 'number') {
        seriesFields.push(key);
      }
    }

    if (!categoryField && data[0]?.metadata) {
      const potentialCategoryFields = ['type', 'category', 'source', 'document_type', 'tag'];
      for (const field of potentialCategoryFields) {
        if (data[0].metadata[field]) { categoryField = `metadata.${field}`; break; }
      }
    }

    if (!categoryField) categoryField = 'derived.category';

    return { category: categoryField, value: valueField, series: seriesFields.slice(0, 5) };
  }

  /** Transform extracted data into visualization-ready format (Migrated & Fixed) */
  private transformDataForVisualization(
    data: any[],
    visualizationType: string,
    fields: { category?: string, value?: string, series?: string[] }
  ): any[] {
    if (!fields.category && !fields.value) {
      return this.generateMockDataForVisualization(visualizationType);
    }
    return data.map(item => {
      const result: Record<string, any> = {};
      if (fields.category) {
        if (fields.category.startsWith('metadata.')) {
          const metadataField = fields.category.split('.')[1];
          result.category = item.metadata?.[metadataField] || 'Unknown';
        } else if (fields.category === 'derived.category') {
          result.category = this.deriveCategoryFromText(item.textContent);
        } else {
          result.category = item[fields.category] || 'Unknown';
        }
      }
      if (fields.value) result.value = item[fields.value] || 0;
      if (fields.series && fields.series.length > 0) {
        result.series = fields.series.map(field => ({ name: field, value: item[field] || 0 }));
      }
      return result;
    });
  }

   /** Create visualization configuration (Migrated) */
  private createVisualizationConfig(visualizationType: string, data: any[]): Record<string, any> {
    let config: Record<string, any> = { colors: this.defaultColors };
    switch (visualizationType) {
      case 'enhanced-bar-chart':
      case 'enhanced-line-chart': // Assuming line chart uses similar axes for now
        config = { ...config, xAxis: { title: 'Category' }, yAxis: { title: 'Value' } }; // Add specific axis titles later if needed
        break;
      case 'pie-chart':
        config = { ...config, legend: { position: 'right' } };
        break;
      // Add cases for scatter-plot, table, network-graph, geo-map if needed
    }
    return config;
  }

  /** Try to derive a category from text content (Migrated) */
  private deriveCategoryFromText(text: string): string {
    if (!text) return 'Unknown';
    const dateRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/i;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) return dateMatch[0];
    const categoryWords = ['category', 'type', 'class', 'group', 'section'];
    for (const word of categoryWords) {
      const regex = new RegExp(`${word}[:\\s]+(\\w+)`, 'i');
      const match = text.match(regex);
      if (match?.[1]) return match[1];
    }
    return text.substring(0, 20) + '...';
  }

  /** Generate mock data for visualization (Migrated) */
  private generateMockDataForVisualization(visualizationType: string): any[] {
    switch (visualizationType) {
      case 'enhanced-bar-chart':
        return [
          { category: "Jan", value: 65, prevValue: 20 }, { category: "Feb", value: 93, prevValue: 20 },
          { category: "Mar", value: 76, prevValue: 22 }, { category: "Apr", value: 44, prevValue: 30 },
          { category: "May", value: 4, prevValue: 28 }, { category: "Jun", value: 16, prevValue: 25 },
          { category: "Jul", value: 93, prevValue: 30 }, { category: "Aug", value: 98, prevValue: 28 },
          { category: "Sep", value: 50, prevValue: 29 }
        ];
      case 'enhanced-line-chart':
        return [
          { category: "Jan", value: 65, prevValue: 20 }, { category: "Feb", value: 59, prevValue: 25 },
          { category: "Mar", value: 80, prevValue: 30 }, { category: "Apr", value: 81, prevValue: 35 },
          { category: "May", value: 56, prevValue: 40 }, { category: "Jun", value: 55, prevValue: 45 },
          { category: "Jul", value: 40, prevValue: 50 }
        ];
      case 'pie-chart':
        return [
          { category: "Category A", value: 35 }, { category: "Category B", value: 25 },
          { category: "Category C", value: 20 }, { category: "Category D", value: 15 },
          { category: "Category E", value: 5 }
        ];
      default: // Default to bar chart mock data
        return [
          { category: "Jan", value: 65, prevValue: 20 }, { category: "Feb", value: 93, prevValue: 20 },
          { category: "Mar", value: 76, prevValue: 22 }, { category: "Apr", value: 44, prevValue: 30 },
          { category: "May", value: 4, prevValue: 28 }
        ];
    }
  }


  // --- OpenAI Helper Methods (Migrated) ---

   /** Build a prompt for analyzing data with OpenAI (Migrated) */
  private buildDataAnalysisPrompt(dataSource: DataSource, data: any[]): string {
    const sampleData = data.slice(0, 10);
    return `Analyze this data from ${dataSource.name} (${dataSource.type}) and suggest the best visualization:\n\nSample data (${data.length} records total, showing first 10):\n${JSON.stringify(sampleData, null, 2)}\n\nBased on the data, please provide:\n1. The most appropriate visualization type (bar, line, pie, scatter, etc.)\n2. A descriptive title for the visualization\n3. A brief description of insights from the data\n4. Any transformations needed for the data\n\nFormat your response as a JSON object with these keys:\n- visualizationType: String (one of: enhanced-bar-chart, enhanced-line-chart, pie-chart, scatter-plot, table, network-graph, geo-map)\n- title: String\n- description: String\n- transformations: Array of transformation objects\n\nOnly return the JSON object, no other text.`;
  }

  /** Analyze data using OpenAI (Fixed types and response handling) */
  private async analyzeDataWithOpenAI(prompt: string): Promise<{ visualizationType: string, title: string, description: string, transformations: any[] }> {
     const defaultResponse = { visualizationType: 'enhanced-bar-chart', title: 'Data Visualization', description: 'Generated visualization based on data source', transformations: [] };
     
     if (!this.openaiService) {
       this.logger.warn('OpenAIService not available - returning default response for data analysis');
       return defaultResponse;
     }
     
     try {
       const messages: ChatMessage[] = [
          { id: 'system-prompt', role: 'system', content: 'You are a data visualization expert. Analyze the data and recommend the best visualization type, providing your response as a clean JSON object.', timestamp: Date.now(), status: 'complete' },
          { id: 'user-prompt', role: 'user', content: prompt, timestamp: Date.now(), status: 'complete' }
       ];
       const response = await this.openaiService.generateChatCompletion(messages, { stream: false });
       if (!response.ok) {
          const errorBody = await response.text();
          this.logger.error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`);
          throw new InternalServerErrorException(`OpenAI API error: ${response.status} ${response.statusText}`);
       }
       // Use type assertion for responseData
       const responseData = await response.json();
       const content = (responseData as any)?.content?.trim();
       if (!content) {
           this.logger.warn('OpenAI response content was empty or missing.');
           return defaultResponse;
       }
       let jsonStartIndex = content.indexOf('{');
       let jsonEndIndex = content.lastIndexOf('}');
       if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
           const jsonStr = content.substring(jsonStartIndex, jsonEndIndex + 1);
           try {
               const parsedJson = JSON.parse(jsonStr);
               return {
                   visualizationType: parsedJson.visualizationType || defaultResponse.visualizationType,
                   title: parsedJson.title || defaultResponse.title,
                   description: parsedJson.description || defaultResponse.description,
                   transformations: parsedJson.transformations || defaultResponse.transformations,
               };
           } catch (parseError) {
               this.logger.warn(`Failed to parse OpenAI JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}. Response content: ${content}`);
               return defaultResponse;
           }
       } else {
           this.logger.warn(`Could not find JSON object in OpenAI response content: ${content}`);
           return defaultResponse;
       }
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       this.logger.error(`Error analyzing data with OpenAI: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
       return defaultResponse;
     }
  }


  // --- Snowflake Visualization Logic (Migrated for Task 6.3) ---

  private async generateSnowflakeVisualization(dataSource: DataSource, options?: VisualizationRequestDto): Promise<VisualizationResponseDto> {
    this.logger.log(`Generating Snowflake visualization for data source ${dataSource.id}`);
    
    // Check if Snowflake service is available
    if (!this.snowflakeService) {
      this.logger.warn('SnowflakeService not available - returning fallback visualization for Snowflake');
      
      return {
        dataSourceId: String(dataSource.id),
        title: `Snowflake Connection (Starting Up)`,
        description: 'The Snowflake service is starting up. Please try again in a moment.',
        isMockData: true,
        chartType: 'enhanced-bar-chart',
        config: {
          xAxis: { title: 'Category' },
          yAxis: { title: 'Value' },
          colors: this.defaultColors.slice(0, 3)
        },
        data: [
          { category: "Startup", value: 75 },
          { category: "Progress", value: 25 }
        ]
      };
    }
    
    // Return a default fallback for now (until Snowflake service is fully implemented)
    return this.getSnowflakeFallbackVisualization(String(dataSource.id), { 
      error: 'Snowflake visualization is being implemented' 
    });
  }
  
  // Helper to translate operators into SQL
  private translateOperator(operator: string): string {
    switch (operator.toLowerCase()) {
      case 'eq': return '=';
      case 'neq': return '!=';
      case 'gt': return '>';
      case 'gte': return '>=';
      case 'lt': return '<';
      case 'lte': return '<=';
      case 'like': return 'LIKE';
      case 'in': return 'IN';
      default: return '=';
    }
  }
  
  // Helper to determine the best chart type based on data
  private determineChartType(requestedType: string, data: any): string {
    // If no data, return table as default
    if (!data || !Array.isArray(data) || data.length === 0) {
      return 'table';
    }
    
    // If requested type is provided and valid, use it
    if (requestedType && ['table', 'enhanced-bar-chart', 'enhanced-line-chart', 'pie-chart', 'scatter-plot'].includes(requestedType)) {
      return requestedType;
    }
    
    // Otherwise analyze data to determine best chart type
    const sampleRow = data[0];
    const columnCount = Object.keys(sampleRow).length;
    
    // For two columns with numeric second column, suggest bar chart
    if (columnCount === 2) {
      const secondColumn = Object.keys(sampleRow)[1];
      if (typeof sampleRow[secondColumn] === 'number') {
        return 'enhanced-bar-chart';
      }
    }
    
    // Default to table for complex data
    return 'table';
  }
  
  // Helper to generate chart configuration based on type and data
  private generateChartConfig(chartType: string, data: any, options?: any): Record<string, any> {
    // Default empty config
    const config: Record<string, any> = {};
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return config;
    }
    
    // Get column names from first row
    const columns = Object.keys(data[0]);
    
    switch (chartType) {
      case 'enhanced-bar-chart':
        config.xAxis = { title: columns[0] };
        config.yAxis = { title: columns[1] || 'Value' };
        config.colors = options?.colors || this.defaultColors.slice(0, 3);
        break;
        
      case 'enhanced-line-chart':
        config.xAxis = { title: columns[0] };
        config.yAxis = { title: columns[1] || 'Value' };
        config.colors = options?.colors || this.defaultColors.slice(0, 3);
        break;
        
      case 'pie-chart':
        config.label = columns[0];
        config.value = columns[1] || 'value';
        config.colors = options?.colors || this.defaultColors;
        break;
        
      case 'scatter-plot':
        config.xAxis = { title: columns[0] };
        config.yAxis = { title: columns[1] || 'Value' };
        break;
        
      default: // table and other formats
        config.showLegend = options?.showLegend || false;
        break;
    }
    
    return config;
  }

  /** Generate a fallback visualization for Snowflake data sources (Migrated) */
  private getSnowflakeFallbackVisualization(
    dataSourceId: string,
    metadata: SnowflakeMetadata & { error?: string }
  ): VisualizationResponseDto {
    this.logger.log(`Generating fallback visualization for Snowflake datasource: ${dataSourceId}`);
    
    // Create safe metadata variables for display
    const database = metadata?.database || 'Not configured';
    const schema = metadata?.schema || 'Not configured';
    const table = metadata?.table || 'Not selected';
    
    // Default error message if none provided
    const errorMessage = metadata?.error || 'Configuration issue or error encountered';
    
    // Generate a helpful title and description
    const title = metadata?.error 
      ? `Snowflake Connection Error` 
      : `Snowflake Configuration Needed`;
    
    const description = metadata?.error
      ? `Error accessing Snowflake data: ${errorMessage}`
      : `Please complete your Snowflake configuration to view data`;
    
    // Construct card message with available information
    const cardMessage = [
      `**Current Configuration:**`,
      `- Database: ${database}`,
      `- Schema: ${schema}`,
      `- Table: ${table}`,
      '',
      metadata?.error 
        ? `**Error Message:** ${errorMessage}` 
        : `**Action Required:** Please configure your data source fully to view visualization.`
    ].join('\n');
    
    // Return the visualization response with info card
    return {
      dataSourceId,
      title,
      description,
      isMockData: true,
      chartType: 'info-card',
      config: {
        message: cardMessage,
        actionType: 'configure-datasource',
        actionText: 'Configure Data Source'
      },
      data: []
    };
  }
}