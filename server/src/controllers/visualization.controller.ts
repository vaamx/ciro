import { Request, Response } from 'express-serve-static-core';
import { AuthRequest } from '../middleware/auth';
import { VisualizationService } from '../services/visualization.service';
import { DataSourceService } from '../services/data-source.service';
import { QdrantService } from '../services/qdrant.service';
import { OpenAIService } from '../services/openai.service';
import * as winston from 'winston';
import { SnowflakeService } from '../services/snowflake.service';
import { BadRequestError } from '../utils/errors';

/**
 * Controller for handling visualization-related requests
 */
export class VisualizationController {
  private visualizationService: VisualizationService;
  private dataSourceService: DataSourceService;
  private qdrantService: QdrantService;
  private openaiService: OpenAIService;
  private snowflakeService: SnowflakeService;
  private logger: winston.Logger;
  
  // Default colors for visualizations
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

  constructor() {
    this.visualizationService = VisualizationService.getInstance();
    this.dataSourceService = DataSourceService.getInstance();
    this.qdrantService = QdrantService.getInstance();
    this.openaiService = OpenAIService.getInstance();
    this.snowflakeService = SnowflakeService.getInstance();

    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [VisualizationController]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Generate a visualization based on a data source
   */
  async generateVisualization(req: AuthRequest, res: Response) {
    try {
      const { dataSourceId } = req.params;
      
      // Add more detailed debugging information
      this.logger.info(`===== VISUALIZATION GENERATION REQUEST =====`);
      this.logger.info(`DataSourceId: ${dataSourceId}`);
      this.logger.info(`User: ${req.user?.id}`);
      this.logger.info(`Params: ${JSON.stringify(req.params)}`);
      
      if (!dataSourceId) {
        throw new BadRequestError('Data source ID is required');
      }

      // Get the data source
      const dataSource = await this.dataSourceService.getById(dataSourceId);
      
      if (!dataSource) {
        this.logger.warn(`Data source with ID ${dataSourceId} not found`);
        
        // Return fallback visualization instead of error
        const fallbackData = this.getFallbackVisualization(dataSourceId);
        this.logger.info(`Returning fallback visualization for non-existent data source: ${dataSourceId}`);
        return res.json(fallbackData);
      }

      this.logger.info(`Found data source: ${dataSource.name} (${dataSource.type}) with metadata: ${JSON.stringify(dataSource.metadata || {})}`);

      // For all data sources, try to use Qdrant first if possible
      let visualizationData;
      
      try {
        // Determine the collection name
        let collectionName = '';
        
        // Try to get collection name from metadata first
        if (dataSource.metadata && dataSource.metadata.collectionName) {
          collectionName = dataSource.metadata.collectionName;
        } else {
          // Fall back to standard format
          collectionName = `datasource_${dataSource.id}`;
        }
        
        this.logger.info(`Attempting to generate visualization from Qdrant collection: ${collectionName}`);
        
        // Check if collection exists
        const qdrantCollections = await this.qdrantService.listCollections();
        
        if (qdrantCollections.includes(collectionName)) {
          // Use Qdrant data
          this.logger.info(`Qdrant collection ${collectionName} found, generating visualization`);
          visualizationData = await this.generateQdrantVisualization({
            ...dataSource,
            collectionName  // Add collection name for easier access
          });
        } else if (dataSource.type === 'snowflake') {
          // Fall back to Snowflake if Qdrant collection doesn't exist
          this.logger.info(`Qdrant collection not found, falling back to Snowflake for data source ${dataSource.id}`);
          visualizationData = await this.generateSnowflakeVisualization(dataSource);
        } else {
          // If not Qdrant or Snowflake, use fallback
          this.logger.warn(`No visualization source available for data source ${dataSource.id}`);
          visualizationData = this.getFallbackVisualization(dataSourceId);
        }
      } catch (dataError) {
        this.logger.error(`Error processing data source: ${dataError instanceof Error ? dataError.message : 'Unknown error'}`);
        visualizationData = this.getFallbackVisualization(dataSourceId);
      }

      // Ensure we have valid visualization data
      if (!visualizationData || !visualizationData.data || visualizationData.data.length === 0) {
        this.logger.warn(`No valid visualization data generated, using fallback`);
        visualizationData = this.getFallbackVisualization(dataSourceId);
      }

      // Log success
      this.logger.info(`Successfully generated visualization: ${visualizationData.title}`);
      
      // Return the visualization data
      res.json(visualizationData);
    } catch (error) {
      this.logger.error(`Error generating visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Always return something useful to the client
      try {
        // Return fallback visualization even on error
        const fallbackData = this.getFallbackVisualization(req.params.dataSourceId);
        this.logger.info(`Returning fallback visualization due to error`);
        res.json(fallbackData);
      } catch (fallbackError) {
        // If even the fallback fails, return a proper error
        res.status(500).json({ error: 'Failed to generate visualization' });
      }
    }
  }

  /**
   * Generate a fallback visualization when real data isn't available
   */
  private getFallbackVisualization(dataSourceId: string) {
    return {
      dataSourceId,
      title: `Data Analysis for Source ${dataSourceId} (Mock)`,
      description: 'This is mock data. The actual data source could not be found or processed.',
      isMockData: true,
      chartType: 'enhanced-bar-chart',
      config: {
        xAxis: { title: 'Month' },
        yAxis: { title: 'Value (in millions)' },
        colors: ['#4C78DB', '#F58518', '#54A24B']
      },
      data: [
        { month: "Jan", value: 65, prevValue: 20 },
        { month: "Feb", value: 93, prevValue: 20 },
        { month: "Mar", value: 76, prevValue: 22 },
        { month: "Apr", value: 44, prevValue: 30 },
        { month: "May", value: 4, prevValue: 28 },
        { month: "Jun", value: 16, prevValue: 25 },
        { month: "Jul", value: 93, prevValue: 30 },
        { month: "Aug", value: 98, prevValue: 28 },
        { month: "Sep", value: 50, prevValue: 29 }
      ],
      query: null,
      transformations: []
    };
  }

  /**
   * Generate a visualization from Qdrant data source
   */
  private async generateQdrantVisualization(dataSource: any) {
    // Use collection name provided or construct it
    const collectionName = dataSource.collectionName || `datasource_${dataSource.id}`;
    
    try {
      this.logger.info(`Generating visualization for Qdrant collection: ${collectionName}`);
      
      // Check if the collection exists first
      const collections = await this.qdrantService.listCollections();
      if (!collections.includes(collectionName)) {
        this.logger.warn(`Qdrant collection not found: ${collectionName}`);
        throw new BadRequestError(`Collection ${collectionName} not found`);
      }
      
      // Get sample data from Qdrant collection
      this.logger.info(`Fetching points from collection: ${collectionName}`);
      const points = await this.qdrantService.getAllPoints(collectionName, 100);
      this.logger.info(`Retrieved ${points?.length || 0} points from collection`);

      if (!points || points.length === 0) {
        this.logger.warn(`No data found in Qdrant collection: ${collectionName}`);
        throw new BadRequestError('No data found in the Qdrant collection');
      }

      // Extract all data from points
      const extractedData = points.map(point => {
        // Extract text/content field
        let textContent = '';
        if (point.payload) {
          if (typeof point.payload.text === 'string') {
            textContent = point.payload.text;
          } else if (typeof point.payload.content === 'string') {
            textContent = point.payload.content;
          } else if (point.payload.page_content) {
            textContent = point.payload.page_content;
          }
        }
        
        // Extract all metadata
        const metadata = { ...(point.payload?.metadata || {}) };
        
        // Extract any numerical fields for potential visualization
        const numericalFields: Record<string, number> = {};
        if (point.payload) {
          Object.entries(point.payload).forEach(([key, value]) => {
            if (typeof value === 'number' && key !== 'id') {
              numericalFields[key] = value;
            }
          });
        }
        
        // Return combined data
        return {
          id: point.id,
          textContent,
          metadata,
          ...numericalFields,
          ...point.payload // Include all payload data
        };
      });
      
      this.logger.info(`Processed ${extractedData.length} data points from Qdrant`);
      
      // Analyze metadata fields to detect potential visualization dimensions
      const metadataFieldCounts = this.analyzeFields(extractedData);
      this.logger.info(`Detected fields for visualization: ${JSON.stringify(metadataFieldCounts)}`);
      
      // Determine best fields for visualization based on data distribution
      const visualizationFields = this.selectVisualizationFields(metadataFieldCounts, extractedData);
      this.logger.info(`Selected fields for visualization: ${JSON.stringify(visualizationFields)}`);
      
      // Determine the best visualization type
      let visualizationType = 'enhanced-bar-chart'; // Default
      let title = `${dataSource.name || 'Data'} Analysis`;
      let description = 'Analysis of key metrics from vector database';
      
      // Try to use OpenAI for intelligent visualization suggestion if there's enough data
      if (extractedData.length >= 5) {
        try {
          // Limit data to 10 items for the prompt to avoid token limits
          const sampleData = extractedData.slice(0, 10);
          const analysisPrompt = this.buildDataAnalysisPrompt(dataSource, sampleData);
          this.logger.info('Sending analysis prompt to OpenAI for visualization recommendation');
          const analysis = await this.analyzeDataWithOpenAI(analysisPrompt);
          
          visualizationType = analysis.visualizationType || visualizationType;
          title = analysis.title || title;
          description = analysis.description || description;
          
          this.logger.info(`OpenAI recommended visualization type: ${visualizationType}`);
        } catch (aiError) {
          this.logger.warn(`Error getting visualization recommendation from OpenAI: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
          // Continue with defaults
        }
      }
      
      // Transform the data based on selected fields
      const transformedData = this.transformDataForVisualization(
        extractedData, 
        visualizationType,
        visualizationFields
      );
      
      // Generate visualization config
      const config = this.createVisualizationConfig(visualizationType, transformedData);
      
      // Return the visualization data
      const result = {
        dataSourceId: dataSource.id,
        title,
        description,
        chartType: visualizationType,
        config,
        data: transformedData,
        sourceFields: visualizationFields,
        query: null,
        transformations: []
      };
      
      this.logger.info(`Generated visualization: ${title}`);
      return result;
    } catch (error) {
      this.logger.error(`Error generating Qdrant visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Analyze fields in the data to find potential visualization dimensions
   */
  private analyzeFields(data: any[]): Record<string, { count: number, type: string }> {
    const fieldCounts: Record<string, { count: number, type: string }> = {};
    
    // Count occurrences of each field and determine type
    data.forEach(item => {
      Object.entries(item).forEach(([key, value]) => {
        if (!fieldCounts[key]) {
          fieldCounts[key] = { count: 0, type: typeof value };
        }
        
        if (value !== null && value !== undefined) {
          fieldCounts[key].count++;
        }
      });
    });
    
    return fieldCounts;
  }
  
  /**
   * Select the best fields for visualization based on data distribution
   */
  private selectVisualizationFields(
    fields: Record<string, { count: number, type: string }>,
    data: any[]
  ): { category?: string, value?: string, series?: string[] } {
    // Filter out fields with low counts or non-visualization friendly types
    const potentialFields = Object.entries(fields).filter(([key, info]) => {
      // Skip internal fields
      if (key === 'id' || key === 'textContent' || key === 'metadata' || key === '_vector') {
        return false;
      }
      
      // Must be present in at least 80% of records
      const threshold = data.length * 0.8;
      return info.count >= threshold;
    });
    
    // Sort fields by count (descending)
    potentialFields.sort((a, b) => b[1].count - a[1].count);
    
    // Find best category field (string) and value field (number)
    let categoryField: string | undefined;
    let valueField: string | undefined;
    let seriesFields: string[] = [];
    
    for (const [key, info] of potentialFields) {
      if (info.type === 'string' && !categoryField) {
        // Check if this string field has reasonable cardinality for categories
        const uniqueValues = new Set(data.map(item => item[key])).size;
        if (uniqueValues >= 2 && uniqueValues <= 20) {
          categoryField = key;
        }
      } else if (info.type === 'number' && !valueField) {
        valueField = key;
      } else if (info.type === 'number') {
        // Collect additional numeric fields for multi-series charts
        seriesFields.push(key);
      }
    }
    
    // If we didn't find a good category field, try to create one from metadata
    if (!categoryField && data[0]?.metadata) {
      // Try common metadata fields that might work as categories
      const potentialCategoryFields = ['type', 'category', 'source', 'document_type', 'tag'];
      for (const field of potentialCategoryFields) {
        if (data[0].metadata[field]) {
          categoryField = `metadata.${field}`;
          break;
        }
      }
    }
    
    // If we still don't have a category field, see if we can derive one
    if (!categoryField) {
      // Try to extract month or date from text content as last resort
      categoryField = 'derived.category';
    }
    
    return {
      category: categoryField,
      value: valueField,
      series: seriesFields.slice(0, 5) // Limit to 5 series for readability
    };
  }
  
  /**
   * Transform extracted data into visualization-ready format
   */
  private transformDataForVisualization(
    data: any[],
    visualizationType: string,
    fields: { category?: string, value?: string, series?: string[] }
  ): any[] {
    // If we don't have proper fields, return mock data
    if (!fields.category && !fields.value) {
      return this.generateMockDataForVisualization(visualizationType);
    }
    
    // Extract values based on fields
    return data.map(item => {
      const result: Record<string, any> = {};
      
      // Get category value
      if (fields.category) {
        if (fields.category.startsWith('metadata.')) {
          // Extract from metadata
          const metadataField = fields.category.split('.')[1];
          result.category = item.metadata?.[metadataField] || 'Unknown';
        } else if (fields.category === 'derived.category') {
          // Try to derive category from text
          result.category = this.deriveCategoryFromText(item.textContent);
        } else {
          // Direct field
          result.category = item[fields.category] || 'Unknown';
        }
      }
      
      // Get value
      if (fields.value) {
        result.value = item[fields.value] || 0;
      }
      
      // Get series values
      if (fields.series && fields.series.length > 0) {
        result.series = fields.series.map(field => ({
          name: field,
          value: item[field] || 0
        }));
      }
      
      return result;
    });
  }
  
  /**
   * Create visualization configuration based on data and type
   */
  private createVisualizationConfig(
    visualizationType: string,
    data: any[]
  ): Record<string, any> {
    // Basic config
    let config: Record<string, any> = {
      colors: this.defaultColors
    };
    
    // Visualization-specific configurations
    switch (visualizationType) {
      case 'enhanced-bar-chart':
        config = {
          ...config,
          xAxis: { title: 'Category' },
          yAxis: { title: 'Value' }
        };
        break;
      case 'enhanced-line-chart':
        config = {
          ...config,
          xAxis: { title: 'Time Period' },
          yAxis: { title: 'Value' }
        };
        break;
      case 'pie-chart':
        config = {
          ...config,
          legend: { position: 'right' }
        };
        break;
    }
    
    return config;
  }
  
  /**
   * Try to derive a category from text content
   */
  private deriveCategoryFromText(text: string): string {
    if (!text) return 'Unknown';
    
    // Try to extract dates
    const dateRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/i;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) return dateMatch[0];
    
    // Try to extract categories
    const categoryWords = ['category', 'type', 'class', 'group', 'section'];
    for (const word of categoryWords) {
      const regex = new RegExp(`${word}[:\\s]+(\\w+)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) return match[1];
    }
    
    // Default: take first 20 chars
    return text.substring(0, 20) + '...';
  }
  
  /**
   * Generate mock data for visualization when real data can't be used
   */
  private generateMockDataForVisualization(visualizationType: string): any[] {
    // Return different mock data based on chart type
    switch (visualizationType) {
      case 'enhanced-bar-chart':
        return [
          { category: "Jan", value: 65, prevValue: 20 },
          { category: "Feb", value: 93, prevValue: 20 },
          { category: "Mar", value: 76, prevValue: 22 },
          { category: "Apr", value: 44, prevValue: 30 },
          { category: "May", value: 4, prevValue: 28 },
          { category: "Jun", value: 16, prevValue: 25 },
          { category: "Jul", value: 93, prevValue: 30 },
          { category: "Aug", value: 98, prevValue: 28 },
          { category: "Sep", value: 50, prevValue: 29 }
        ];
      case 'enhanced-line-chart':
        return [
          { category: "Jan", value: 65, prevValue: 20 },
          { category: "Feb", value: 59, prevValue: 25 },
          { category: "Mar", value: 80, prevValue: 30 },
          { category: "Apr", value: 81, prevValue: 35 },
          { category: "May", value: 56, prevValue: 40 },
          { category: "Jun", value: 55, prevValue: 45 },
          { category: "Jul", value: 40, prevValue: 50 }
        ];
      case 'pie-chart':
        return [
          { category: "Category A", value: 35 },
          { category: "Category B", value: 25 },
          { category: "Category C", value: 20 },
          { category: "Category D", value: 15 },
          { category: "Category E", value: 5 }
        ];
      default:
        return [
          { category: "Jan", value: 65, prevValue: 20 },
          { category: "Feb", value: 93, prevValue: 20 },
          { category: "Mar", value: 76, prevValue: 22 },
          { category: "Apr", value: 44, prevValue: 30 },
          { category: "May", value: 4, prevValue: 28 }
        ];
    }
  }

  /**
   * Generate a visualization from Snowflake data source
   */
  private async generateSnowflakeVisualization(dataSource: any) {
    try {
      this.logger.info(`Generating visualization for Snowflake data source: ${dataSource.id}`);
      
      // Extract Snowflake connection info from data source metadata
      const metadata = dataSource.metadata || {};
      
      if (!metadata.database || !metadata.schema) {
        this.logger.warn(`Snowflake data source is missing required database or schema metadata`);
        return this.getSnowflakeFallbackVisualization(dataSource.id, metadata);
      }

      // If table is not specified but we have indexing_status, try to use the current_table
      if (!metadata.table && metadata.indexing_status && metadata.indexing_status.current_table) {
        const tablePath = metadata.indexing_status.current_table.split('.');
        if (tablePath.length === 3) {
          // Format is typically DATABASE.SCHEMA.TABLE
          metadata.table = tablePath[2];
          this.logger.info(`Using table from indexing status: ${metadata.table}`);
        }
      }
      
      // If still no table but we have tableCount, try to get a table from the schema
      if (!metadata.table && metadata.tableCount > 0) {
        try {
          this.logger.info(`No specific table provided, fetching tables in schema ${metadata.schema}`);
          const tablesResult = await this.snowflakeService.listTables(
            dataSource.id, 
            metadata.database, 
            metadata.schema
          );
          
          if (tablesResult && tablesResult.length > 0) {
            // Handle the result regardless of type
            const firstTable = tablesResult[0] as any;
            if (typeof firstTable === 'string') {
              metadata.table = firstTable;
            } else if (firstTable && typeof firstTable === 'object') {
              // Try to extract table name from various possible properties
              metadata.table = firstTable.name || firstTable.TABLE_NAME || firstTable.table_name || 
                               firstTable.tableName || Object.values(firstTable)[0];
            }
            
            this.logger.info(`Selected first available table: ${metadata.table}`);
          } else {
            this.logger.warn(`No tables found in schema ${metadata.schema}`);
            return this.getSnowflakeFallbackVisualization(dataSource.id, metadata);
          }
        } catch (tableError) {
          this.logger.error(`Error fetching tables: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`);
          return this.getSnowflakeFallbackVisualization(dataSource.id, metadata);
        }
      }
      
      // If we still don't have a table, we can't proceed
      if (!metadata.table) {
        this.logger.warn(`No table specified or found for Snowflake visualization`);
        // Return specialized Snowflake fallback instead of throwing error
        return this.getSnowflakeFallbackVisualization(dataSource.id, metadata);
      }

      // Generate SQL query for visualization
      const sqlQuery = `SELECT * FROM ${metadata.database}.${metadata.schema}.${metadata.table} LIMIT 100`;
      this.logger.info(`Executing Snowflake query: ${sqlQuery}`);
      
      // Execute the query to get the data
      let queryResults;
      try {
        queryResults = await this.snowflakeService.executeQuery(
          dataSource.id,
          sqlQuery
        );
      } catch (queryError) {
        this.logger.error(`Error executing Snowflake query: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`);
        return this.getSnowflakeFallbackVisualization(dataSource.id, {
          ...metadata,
          error: queryError instanceof Error ? queryError.message : 'Query execution failed'
        });
      }
      
      this.logger.info(`Received query results from Snowflake`);

      // Assuming the results structure, adapt as needed based on SnowflakeService
      const resultsData = queryResults.rows || [];
      this.logger.info(`Extracted ${resultsData.length} rows from query results`);

      if (!resultsData || resultsData.length === 0) {
        this.logger.warn(`No data returned from Snowflake query`);
        throw new BadRequestError('No data returned from Snowflake query');
      }

      // Analyze data to determine the best visualization
      const analysisPrompt = this.buildDataAnalysisPrompt(dataSource, resultsData);
      this.logger.info(`Sending analysis prompt to OpenAI`);
      const analysis = await this.analyzeDataWithOpenAI(analysisPrompt);
      this.logger.info(`Received analysis result: ${analysis.visualizationType}`);

      // Generate visualization configuration based on the analysis
      const visualizationType = analysis.visualizationType || 'enhanced-line-chart';
      const title = analysis.title || `${dataSource.name} Visualization`;
      const description = analysis.description || 'Generated visualization';

      // Create the visualization configuration
      this.logger.info(`Creating visualization with type: ${visualizationType}`);
      const config = this.visualizationService.createVisualization(
        visualizationType,
        resultsData,
        title,
        { description }
      );

      // Return the visualization data
      const result = {
        dataSourceId: dataSource.id,
        title,
        description,
        chartType: visualizationType,
        config,
        data: resultsData,
        query: sqlQuery,
        transformations: analysis.transformations || []
      };
      
      this.logger.info(`Generated visualization: ${title}`);
      return result;
    } catch (error) {
      this.logger.error(`Error generating Snowflake visualization: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Build a prompt for analyzing data with OpenAI
   */
  private buildDataAnalysisPrompt(dataSource: any, data: any[]) {
    // Take a sample of the data to avoid prompt size limits
    const sampleData = data.slice(0, 10);
    
    return `Analyze this data from ${dataSource.name} (${dataSource.type}) and suggest the best visualization:
      
Sample data (${data.length} records total, showing first 10):
${JSON.stringify(sampleData, null, 2)}

Based on the data, please provide:
1. The most appropriate visualization type (bar, line, pie, scatter, etc.)
2. A descriptive title for the visualization
3. A brief description of insights from the data
4. Any transformations needed for the data

Format your response as a JSON object with these keys:
- visualizationType: String (one of: enhanced-bar-chart, enhanced-line-chart, pie-chart, scatter-plot, table, network-graph, geo-map)
- title: String
- description: String
- transformations: Array of transformation objects

Only return the JSON object, no other text.`;
  }

  /**
   * Analyze data using OpenAI to determine the best visualization
   */
  private async analyzeDataWithOpenAI(prompt: string) {
    try {
      // Use generateChatCompletion instead of createChatCompletion
      const response = await this.openaiService.generateChatCompletion([
        { role: 'system', content: 'You are a data visualization expert. Analyze the data and recommend the best visualization type, providing your response as a clean JSON object.' },
        { role: 'user', content: prompt }
      ]);

      // Parse the response to extract JSON
      const content = response.choices[0]?.message?.content?.trim() || '{}';
      let jsonStartIndex = content.indexOf('{');
      let jsonEndIndex = content.lastIndexOf('}');
      
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        const jsonStr = content.substring(jsonStartIndex, jsonEndIndex + 1);
        return JSON.parse(jsonStr);
      }

      // If JSON parsing fails, return a default analysis
      this.logger.warn(`Failed to parse OpenAI response as JSON, using default analysis`);
      return {
        visualizationType: 'enhanced-bar-chart',
        title: 'Data Visualization',
        description: 'Generated visualization based on data source',
        transformations: []
      };
    } catch (error) {
      this.logger.error(`Error analyzing data with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return a default analysis if OpenAI fails
      return {
        visualizationType: 'enhanced-bar-chart',
        title: 'Data Visualization',
        description: 'Generated visualization based on data source',
        transformations: []
      };
    }
  }

  /**
   * Generate a fallback visualization for Snowflake data sources that explains what's needed
   */
  private getSnowflakeFallbackVisualization(dataSourceId: string, metadata: any) {
    return {
      dataSourceId,
      title: `Snowflake Configuration Required`,
      description: `This data source needs configuration. ${metadata.database ? `Database "${metadata.database}"` : 'No database'} and ${metadata.schema ? `schema "${metadata.schema}"` : 'no schema'} ${metadata.table ? `with table "${metadata.table}"` : 'but no table selected'}. Please select a table in the data source settings.`,
      isMockData: true,
      isConfigurationRequired: true,
      chartType: 'info-card',
      config: {
        icon: 'database',
        accent: 'blue',
        actionLabel: 'Configure Data Source'
      },
      data: [],
      query: null,
      transformations: []
    };
  }
} 