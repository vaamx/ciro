import { Injectable } from '@nestjs/common';
// @ts-nocheck - TODO: This file needs major refactoring to work with the updated service architecture

import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
import { StatisticalAnalysisService } from '../ai/statistical-analysis.service';
import { VisualizationService } from '../../modules/visualization/visualization.service';
import { ProcessingStage, ProcessingOptions, AnalyticalOperationType } from '../../types/document/processing';
import { DataSourceType, DataPreprocessingService } from '../datasources/processors/utils/data-preprocessing.service';
import { QueryAnalysisService } from '../analysis/query-analysis.service';
import { LlmAnalysisService } from '../ai/llm-analysis.service';
import { ResponseParsingService, StructuredAnalysisResponse, ChartType } from '../ai/response-parsing.service';
import { VisualizationPreparationService } from '../visualization/visualization-preparation.service';
import { v4 as uuidv4 } from 'uuid';

// Define ProgressCallback type locally again
export type ProgressCallback = (stage: ProcessingStage, progress: number, message?: string) => void;

/**
 * Server-side implementation of UniversalDataProcessor
 * Handles advanced data processing, analysis, and visualization
 */
@Injectable()
export class DataAnalysisOrchestratorService {
  private readonly logger = createServiceLogger('DataAnalysisOrchestrator');
  private progressCallback: ProgressCallback | null = null;
  
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly statisticalAnalysisService: StatisticalAnalysisService,
    private readonly visualizationService: VisualizationService,
    private readonly dataPreprocessingService: DataPreprocessingService,
    private readonly queryAnalysisService: QueryAnalysisService,
    private readonly llmAnalysisService: LlmAnalysisService,
    private readonly responseParsingService: ResponseParsingService,
    private readonly visualizationPreparationService: VisualizationPreparationService
  ) {
    this.logger.info('DataAnalysisOrchestrator initialized');
  }
  
  /**
   * Set a callback for progress updates
   * @param callback The progress callback function
   */
  public setProgressCallback(callback: ProgressCallback | null): void {
    this.progressCallback = callback;
  }
  
  /**
   * Update progress with the current stage
   * @param stage The current processing stage
   * @param progress The progress percentage (0-100)
   * @param message Optional message to provide more context
   */
  private updateProgress(stage: ProcessingStage, progress: number, message?: string): void {
    if (this.progressCallback) {
      this.progressCallback(stage, progress, message);
    }
  }
  
  /**
   * Process a data query using universal data processing logic
   * @param query The user's query
   * @param data The data to analyze
   * @param dataSourceType The type of data source
   * @returns A structured analysis response
   */
  public async processDataQuery(
    query: string,
    data: any,
    dataSourceId: string,
    userId: string,
    dataSourceType: DataSourceType = DataSourceType.UNKNOWN
  ): Promise<StructuredAnalysisResponse> {
    this.logger.info(`Processing query: "${query}" for data source type: ${dataSourceType}`);
    this.updateProgress(ProcessingStage.INITIALIZING, 0, 'Starting analysis');
    
    // Step 1: Detect data type if unknown
    if (dataSourceType === DataSourceType.UNKNOWN) {
      dataSourceType = this.dataPreprocessingService.detectDataType(data);
      this.logger.info(`Detected data type: ${dataSourceType}`);
    }
    
    // Step 2: Analyze query to determine operations
    this.updateProgress(ProcessingStage.ANALYZING_QUERY, 10, 'Analyzing query intent');
    const analyticalOperations = await this.queryAnalysisService.determineAnalyticalOperations(query);
    this.logger.info(`Determined operations: ${analyticalOperations.join(', ')}`);
    
    // Step 3: Preprocess the data
    this.updateProgress(ProcessingStage.PREPROCESSING_DATA, 25, 'Preprocessing data');
    const processedData = this.dataPreprocessingService.preprocessData(data, dataSourceType);
    
    // Step 4: Determine visualization type
    const visualizationType = await this.queryAnalysisService.determineVisualizationType(query, analyticalOperations);
    this.logger.info(`Suggested visualization: ${visualizationType}`);
    
    // Step 5: Enhance data with statistical analysis if appropriate
    this.updateProgress(ProcessingStage.ENHANCING_DATA, 40, 'Applying statistical analysis');
    const enhancedData = this.statisticalAnalysisService.enhanceDataWithStatistics(processedData, analyticalOperations);
    
    // Step 6: Generate the LLM response
    this.updateProgress(ProcessingStage.GENERATING_RESPONSE, 60, 'Generating analysis');
    const content = await this.llmAnalysisService.generateAnalysis({
      query,
      processedData: enhancedData,
      dataSourceType,
      analyticalOperations,
      chatOptions: { model: 'gpt-4o', temperature: 0.2 }
    });
    
    // Step 7: Parse the structured response
    this.updateProgress(ProcessingStage.PARSING_RESPONSE, 80, 'Parsing response');
    const structuredResponse = this.responseParsingService.parseLlmResponse(
      content,
      visualizationType,
      dataSourceId,
      userId
    );
    
    // Step 8: Create visualization if needed
    if (visualizationType !== ChartType.NONE) {
      this.updateProgress(ProcessingStage.PREPARING_VISUALIZATION, 90, 'Creating visualization');
      
      // Generate the visualization config
      structuredResponse.visualization = {
        type: visualizationType,
        config: await this.generateVisualization(dataSourceId, parseInt(userId, 10))
      };
    }
    
    // Complete
    this.updateProgress(ProcessingStage.COMPLETED, 100, 'Analysis complete');
    return structuredResponse;
  }
  
  private async generateVisualization(dataSourceId: string, userId: number): Promise<any> {
    try {
      return await this.visualizationService.generateVisualization(dataSourceId, userId);
    } catch (error) {
      this.logger.error('Error generating visualization:', error);
      return null;
    }
  }
} 