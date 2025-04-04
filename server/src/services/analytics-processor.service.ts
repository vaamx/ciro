import { v4 as uuidv4 } from 'uuid';
import { createServiceLogger } from '../utils/logger-factory';
import { NlpProcessorService, QueryType } from './nlp-processor.service';
import { StatisticalAnalysisService } from './statistical-analysis.service';

/**
 * Types of analytical operations that can be performed
 */
export enum AnalyticalOperationType {
  FILTERING = 'filtering',
  AGGREGATION = 'aggregation',
  GROUPING = 'grouping',
  SORTING = 'sorting',
  VISUALIZATION = 'visualization',
  COMPARATIVE = 'comparative',
  STATISTICAL = 'statistical',
  FORECASTING = 'forecasting',
  INSIGHTS = 'insights',
  SUMMARY = 'summary'
}

/**
 * Types of visualizations that can be generated
 */
export enum VisualizationType {
  BAR_CHART = 'bar',
  LINE_CHART = 'line',
  PIE_CHART = 'pie',
  DONUT_CHART = 'donut',
  AREA_CHART = 'area',
  STACKED_BAR = 'stackedBar',
  HORIZONTAL_BAR = 'horizontalBar',
  ENHANCED_AREA = 'enhancedArea',
  SCATTER_PLOT = 'scatter',
  RADAR_CHART = 'radar',
  SPIDER_CHART = 'radar', // Alias for RADAR_CHART
  HEATMAP = 'heatmap',
  FUNNEL_CHART = 'funnel',
  TREE_MAP = 'treemap',
  SANKEY_DIAGRAM = 'sankey',
  GEOSPATIAL_MAP = 'geospatial',
  NETWORK_GRAPH = 'network',
  TABLE = 'table',
  THREE_D_CHART = '3d',
  ANIMATED_CHART = 'animated'
}

/**
 * Structure for a single analytical step
 */
export interface AnalyticalStep {
  id: string;
  type: AnalyticalOperationType;
  description: string;
  order: number;
  data?: any; // The data to be displayed in this step
  code?: string; // Optional code used to generate the data
  visualization?: {
    type: VisualizationType;
    config: Record<string, any>;
  };
  statistics?: Record<string, any>; // Statistical analysis results
  forecast?: Record<string, any>; // Forecasting results
  comparison?: Record<string, any>; // Comparative analysis results
  insights?: any[]; // Statistical insights
}

/**
 * Structure for a complete analytical process
 */
export interface AnalyticalProcess {
  id: string;
  query: string;
  steps: AnalyticalStep[];
  finalInsights: string[];
  recommendations?: string[];
}

/**
 * Service to process analytical queries and generate structured, multi-step responses
 */
export class AnalyticsProcessorService {
  private static instance: AnalyticsProcessorService;
  private readonly logger = createServiceLogger('AnalyticsProcessorService');
  private nlpProcessor: NlpProcessorService;
  private statisticalAnalysis: StatisticalAnalysisService;

  private constructor() {
    this.nlpProcessor = NlpProcessorService.getInstance();
    this.statisticalAnalysis = StatisticalAnalysisService.getInstance();
  }

  public static getInstance(): AnalyticsProcessorService {
    if (!AnalyticsProcessorService.instance) {
      AnalyticsProcessorService.instance = new AnalyticsProcessorService();
    }
    return AnalyticsProcessorService.instance;
  }

  /**
   * Analyzes a query to determine if it's an analytical query requiring advanced processing
   */
  public isAnalyticalQuery(query: string): boolean {
    // Use the NLP processor to analyze the query
    const queryAnalysis = this.nlpProcessor.analyzeQuery(query);
    
    // Consider it analytical if it's not a general query and has a high confidence score
    if (queryAnalysis.queryType !== QueryType.GENERAL && queryAnalysis.confidenceScore > 0.6) {
      return true;
    }
    
    // Check for entity-focused patterns that should be considered analytical
    const entityPatterns = [
      /tell me about\s+(.+)/i,
      /information (on|about)\s+(.+)/i,
      /details (of|about)\s+(.+)/i,
      /who is\s+(.+)/i,
      /what is\s+(.+)/i,
      /describe\s+(.+)/i,
      /explain\s+(.+)/i,
      /show me\s+(.+)/i,
      /find\s+(.+)/i,
      /look up\s+(.+)/i
    ];
    
    for (const pattern of entityPatterns) {
      if (pattern.test(query)) {
        return true; // Treat entity-focused queries as analytical
      }
    }
    
    // Check for analytical keywords
    const analyticalKeywords = [
      'analyze',
      'analysis',
      'trend',
      'compare',
      'correlation',
      'forecast',
      'predict',
      'statistics',
      'metrics',
      'measure',
      'performance',
      'kpi',
      'dashboard',
      'report',
      'visualization',
      'chart',
      'graph',
      'plot',
      'distribution',
      'average',
      'mean',
      'median',
      'mode',
      'sum',
      'count',
      'min',
      'max',
      'standard deviation',
      'variance',
      'percentile',
      'quartile',
      'rank',
      'segment',
      'group',
      'categorize',
      'classify',
      'cluster',
      'outlier',
      'anomaly'
    ];
    
    const normalizedQuery = query.toLowerCase();
    
    // Check if the query contains any analytical keywords
    for (const keyword of analyticalKeywords) {
      if (normalizedQuery.includes(keyword)) {
        return true;
      }
    }
    
    // Check for specific analytical patterns
    const analyticalPatterns = [
      /how (many|much)/i,
      /what is the (total|average|sum)/i,
      /show me the (top|bottom)/i,
      /compare .* (to|with|against)/i,
      /relationship between/i,
      /correlation between/i,
      /trend (of|in)/i,
      /over (time|the past|the last)/i,
      /growth (rate|percentage)/i,
      /increase|decrease/i,
      /higher|lower/i,
      /performance (of|in)/i,
      /breakdown (of|by)/i
    ];
    
    for (const pattern of analyticalPatterns) {
      if (pattern.test(normalizedQuery)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Analyzes a query to determine what type of analytical operations should be performed
   */
  public determineAnalyticalOperations(query: string): AnalyticalOperationType[] {
    const operations: AnalyticalOperationType[] = [];
    
    // Use the NLP processor to analyze the query
    const queryAnalysis = this.nlpProcessor.analyzeQuery(query);
    
    // Map query types to analytical operations
    const queryTypeToOperations: Record<QueryType, AnalyticalOperationType[]> = {
      [QueryType.DESCRIPTIVE]: [AnalyticalOperationType.FILTERING, AnalyticalOperationType.AGGREGATION, AnalyticalOperationType.SUMMARY],
      [QueryType.DIAGNOSTIC]: [AnalyticalOperationType.FILTERING, AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.INSIGHTS],
      [QueryType.PREDICTIVE]: [AnalyticalOperationType.FORECASTING, AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.INSIGHTS],
      [QueryType.PRESCRIPTIVE]: [AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.INSIGHTS],
      [QueryType.COMPARATIVE]: [AnalyticalOperationType.COMPARATIVE, AnalyticalOperationType.FILTERING, AnalyticalOperationType.INSIGHTS],
      [QueryType.CORRELATION]: [AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.INSIGHTS],
      [QueryType.TREND]: [AnalyticalOperationType.FILTERING, AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.INSIGHTS],
      [QueryType.ANOMALY]: [AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.INSIGHTS],
      [QueryType.RANKING]: [AnalyticalOperationType.SORTING, AnalyticalOperationType.AGGREGATION, AnalyticalOperationType.SUMMARY],
      [QueryType.SEGMENTATION]: [AnalyticalOperationType.GROUPING, AnalyticalOperationType.AGGREGATION, AnalyticalOperationType.SUMMARY],
      [QueryType.DISTRIBUTION]: [AnalyticalOperationType.STATISTICAL, AnalyticalOperationType.SUMMARY],
      [QueryType.GENERAL]: [AnalyticalOperationType.FILTERING, AnalyticalOperationType.AGGREGATION, AnalyticalOperationType.SUMMARY]
    };
    
    // Add operations based on query type
    operations.push(...queryTypeToOperations[queryAnalysis.queryType]);
    
    // Always add visualization
    if (!operations.includes(AnalyticalOperationType.VISUALIZATION)) {
      operations.push(AnalyticalOperationType.VISUALIZATION);
    }
    
    // Check for filtering operations in the query
    if (queryAnalysis.dataRequirements.filters.length > 0 && !operations.includes(AnalyticalOperationType.FILTERING)) {
      operations.push(AnalyticalOperationType.FILTERING);
    }
    
    // Check for aggregation operations in the query
    if (queryAnalysis.dataRequirements.aggregations.length > 0 && !operations.includes(AnalyticalOperationType.AGGREGATION)) {
      operations.push(AnalyticalOperationType.AGGREGATION);
    }
    
    // Check for grouping operations in the query
    const groupingKeywords = ['group', 'segment', 'categorize', 'classify', 'cluster', 'by'];
    const normalizedQuery = query.toLowerCase();
    
    for (const keyword of groupingKeywords) {
      if (normalizedQuery.includes(keyword) && !operations.includes(AnalyticalOperationType.GROUPING)) {
        operations.push(AnalyticalOperationType.GROUPING);
        break;
      }
    }
    
    // Check for sorting operations in the query
    const sortingKeywords = ['sort', 'order', 'rank', 'top', 'bottom', 'highest', 'lowest'];
    
    for (const keyword of sortingKeywords) {
      if (normalizedQuery.includes(keyword) && !operations.includes(AnalyticalOperationType.SORTING)) {
        operations.push(AnalyticalOperationType.SORTING);
        break;
      }
    }
    
    // Always include insights
    if (!operations.includes(AnalyticalOperationType.INSIGHTS)) {
      operations.push(AnalyticalOperationType.INSIGHTS);
    }
    
    return operations;
  }

  /**
   * Determines what type of visualization would be appropriate based on the query
   */
  public determineVisualizationType(query: string, operations: AnalyticalOperationType[]): VisualizationType {
    // Use the NLP processor to analyze the query
    const queryAnalysis = this.nlpProcessor.analyzeQuery(query);
    
    // Get visualization suggestions from the NLP processor
    const suggestedVisualizations = queryAnalysis.suggestedVisualizations;
    
    // Map NLP visualization suggestions to VisualizationType
    if (suggestedVisualizations.length > 0) {
      const visualizationMap: Record<string, VisualizationType> = {
        'bar chart': VisualizationType.BAR_CHART,
        'line chart': VisualizationType.LINE_CHART,
        'pie chart': VisualizationType.PIE_CHART,
        'scatter plot': VisualizationType.SCATTER_PLOT,
        'histogram': VisualizationType.BAR_CHART,
        'heat map': VisualizationType.HEATMAP,
        'table': VisualizationType.TABLE,
        'treemap': VisualizationType.TREE_MAP,
        'bubble chart': VisualizationType.PIE_CHART,
        'radar chart': VisualizationType.RADAR_CHART,
        'funnel chart': VisualizationType.FUNNEL_CHART,
        'gauge chart': VisualizationType.PIE_CHART
      };
      
      // Try to find a matching visualization type
      for (const suggestion of suggestedVisualizations) {
        const normalizedSuggestion = suggestion.toLowerCase();
        
        for (const [key, value] of Object.entries(visualizationMap)) {
          if (normalizedSuggestion.includes(key)) {
            return value;
          }
        }
      }
    }
    
    // If no match found, determine based on query type and operations
    const normalizedQuery = query.toLowerCase();
    
    // Check for explicit visualization mentions
    if (normalizedQuery.includes('bar chart') || normalizedQuery.includes('bar graph')) {
      return VisualizationType.BAR_CHART;
    } else if (normalizedQuery.includes('line chart') || normalizedQuery.includes('line graph') || normalizedQuery.includes('trend')) {
      return VisualizationType.LINE_CHART;
    } else if (normalizedQuery.includes('pie chart') || normalizedQuery.includes('pie graph') || normalizedQuery.includes('distribution')) {
      return VisualizationType.PIE_CHART;
    } else if (normalizedQuery.includes('scatter plot') || normalizedQuery.includes('scatter graph') || normalizedQuery.includes('correlation')) {
      return VisualizationType.SCATTER_PLOT;
    } else if (normalizedQuery.includes('histogram')) {
      return VisualizationType.BAR_CHART;
    } else if (normalizedQuery.includes('heatmap') || normalizedQuery.includes('heat map')) {
      return VisualizationType.HEATMAP;
    } else if (normalizedQuery.includes('table')) {
      return VisualizationType.TABLE;
    } else if (normalizedQuery.includes('treemap') || normalizedQuery.includes('tree map')) {
      return VisualizationType.TREE_MAP;
    } else if (normalizedQuery.includes('bubble chart') || normalizedQuery.includes('bubble graph')) {
      return VisualizationType.PIE_CHART;
    } else if (normalizedQuery.includes('radar chart') || normalizedQuery.includes('radar graph') || normalizedQuery.includes('spider chart')) {
      return VisualizationType.RADAR_CHART;
    } else if (normalizedQuery.includes('funnel chart') || normalizedQuery.includes('funnel graph')) {
      return VisualizationType.FUNNEL_CHART;
    } else if (normalizedQuery.includes('gauge chart') || normalizedQuery.includes('gauge graph')) {
      return VisualizationType.PIE_CHART;
    }
    
    // Determine based on operations and query type
    if (operations.includes(AnalyticalOperationType.FORECASTING)) {
      return VisualizationType.LINE_CHART;
    } else if (operations.includes(AnalyticalOperationType.COMPARATIVE)) {
      return VisualizationType.BAR_CHART;
    } else if (operations.includes(AnalyticalOperationType.STATISTICAL) && normalizedQuery.includes('correlation')) {
      return VisualizationType.SCATTER_PLOT;
    } else if (operations.includes(AnalyticalOperationType.GROUPING) && !operations.includes(AnalyticalOperationType.SORTING)) {
      return VisualizationType.PIE_CHART;
    } else if (operations.includes(AnalyticalOperationType.SORTING)) {
      return VisualizationType.BAR_CHART;
    } else if (queryAnalysis.temporalAspects.isTimeSeries) {
      return VisualizationType.LINE_CHART;
    } else if (queryAnalysis.queryType === QueryType.DISTRIBUTION) {
      return VisualizationType.BAR_CHART;
    } else if (queryAnalysis.queryType === QueryType.CORRELATION) {
      return VisualizationType.SCATTER_PLOT;
    } else if (queryAnalysis.queryType === QueryType.SEGMENTATION) {
      return VisualizationType.PIE_CHART;
    } else if (queryAnalysis.queryType === QueryType.RANKING) {
      return VisualizationType.BAR_CHART;
    }
    
    // Default to bar chart if no specific type is determined
    return VisualizationType.BAR_CHART;
  }

  /**
   * Creates a template for an analytical process based on the query
   */
  public createAnalyticalProcessTemplate(query: string): AnalyticalProcess {
    // Use the NLP processor to analyze the query
    const queryAnalysis = this.nlpProcessor.analyzeQuery(query);
    
    // Determine the analytical operations
    const operations = this.determineAnalyticalOperations(query);
    
    // Create steps based on operations
    const steps: AnalyticalStep[] = [];
    let order = 1;
    
    // Add data preparation step if needed
    if (queryAnalysis.dataRequirements.requiredVariables.length > 0 || queryAnalysis.dataRequirements.filters.length > 0) {
      steps.push({
        id: uuidv4(),
        type: AnalyticalOperationType.FILTERING,
        description: `Data Preparation: Selecting and filtering the relevant data for analysis.`,
        order: order++
      });
    }
    
    // Add steps based on operations
    for (const operation of operations) {
      // Skip filtering if already added
      if (operation === AnalyticalOperationType.FILTERING && steps.some(step => step.type === AnalyticalOperationType.FILTERING)) {
        continue;
      }
      
      // Skip visualization (will be added at the end)
      if (operation === AnalyticalOperationType.VISUALIZATION) {
        continue;
      }
      
      // Add step based on operation type
      switch (operation) {
        case AnalyticalOperationType.FILTERING:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Filtering: Applying filters to focus on the relevant data.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.AGGREGATION:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Aggregation: Calculating summary statistics for the data.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.GROUPING:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Grouping: Organizing data into meaningful categories.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.SORTING:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Sorting: Arranging data to highlight key patterns.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.COMPARATIVE:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Comparison: Analyzing differences and similarities between data sets.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.STATISTICAL:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Statistical Analysis: Applying statistical methods to uncover patterns.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.FORECASTING:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Forecasting: Predicting future trends based on historical data.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.INSIGHTS:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Insights: Extracting key findings and actionable intelligence.`,
            order: order++
          });
          break;
          
        case AnalyticalOperationType.SUMMARY:
          steps.push({
            id: uuidv4(),
            type: operation,
            description: `Summary: Providing an overview of the analysis results.`,
            order: order++
          });
          break;
      }
    }
    
    // Add visualization step
    steps.push({
      id: uuidv4(),
      type: AnalyticalOperationType.VISUALIZATION,
      description: `Visualization: Presenting the analysis results visually.`,
      order: order++
    });
    
    // Get suggested analyses from the NLP processor
    const suggestedAnalyses = queryAnalysis.suggestedAnalyses;
    
    return {
      id: uuidv4(),
      query,
      steps,
      finalInsights: [],
      recommendations: suggestedAnalyses
    };
  }

  /**
   * Generate a structured analytical response from the AI
   */
  public generateStructuredPrompt(analyticalProcess: AnalyticalProcess): string {
    // Use the NLP processor to analyze the query
    const queryAnalysis = this.nlpProcessor.analyzeQuery(analyticalProcess.query);
    
    // Generate clarification questions if needed
    const clarificationQuestions = this.nlpProcessor.generateClarificationQuestions(queryAnalysis);
    
    // Build the prompt
    let prompt = `You are an advanced analytical assistant. You'll be helping with a data analysis task.

Query: "${analyticalProcess.query}"

I need you to perform a step-by-step analysis to answer this query. Follow these steps:

`;

    // Add steps to the prompt
    for (const step of analyticalProcess.steps) {
      prompt += `Step ${step.order}: ${step.description}\n`;
    }

    // Add clarification information if available
    if (clarificationQuestions.length > 0 && queryAnalysis.confidenceScore < 0.7) {
      prompt += `\nBased on the query, I have some clarifications that might help with the analysis:\n`;
      
      for (const question of clarificationQuestions.slice(0, 2)) {
        prompt += `- ${question.question}\n`;
      }
      
      prompt += `\nPlease make reasonable assumptions for these clarifications in your analysis.\n`;
    }

    // Add information about the query type and domain
    prompt += `\nThis appears to be a ${queryAnalysis.queryType.toLowerCase()} query in the ${queryAnalysis.domain.toLowerCase()} domain.\n`;

    // Add information about data requirements
    if (queryAnalysis.dataRequirements.requiredVariables.length > 0) {
      prompt += `\nKey metrics/variables to analyze: ${queryAnalysis.dataRequirements.requiredVariables.join(', ')}\n`;
    }

    if (queryAnalysis.dataRequirements.filters.length > 0) {
      prompt += `\nFilters to apply: ${queryAnalysis.dataRequirements.filters.join(', ')}\n`;
    }

    // Add suggested analyses
    if (analyticalProcess.recommendations && analyticalProcess.recommendations.length > 0) {
      prompt += `\nRecommended analytical approaches:\n`;
      for (const recommendation of analyticalProcess.recommendations) {
        prompt += `- ${recommendation}\n`;
      }
    }

    // Add formatting instructions
    prompt += `
For each step, provide:
1. A clear explanation of what you're doing
2. The analytical technique being applied
3. Sample data or results where applicable
4. Key findings from that step

Format your response as a step-by-step analysis, with each step clearly labeled (e.g., "Step 1: Data Preparation").

After completing all steps, provide a concise summary of the key insights and findings.`;

    return prompt;
  }

  /**
   * Process data with statistics, handling large datasets with batch processing
   * @param data The data to process
   * @param operationType The type of operation to perform
   * @returns Processed data with statistical insights
   */
  public processDataWithStatistics(
    data: any[],
    operationType: AnalyticalOperationType
  ): {
    processedData: any[];
    insights: any[];
    visualizationConfig?: Record<string, any>;
  } {
    if (!data || data.length === 0) {
      return { processedData: [], insights: [] };
    }

    // Log size of the dataset
    this.logger.info(`Processing ${data.length} records with operation type: ${operationType}`);

    // Handle large datasets with batch processing for aggregation operations
    if (operationType === AnalyticalOperationType.AGGREGATION && data.length > 1000) {
      return this.processBatchedAggregation(data);
    }

    // Clean data by removing outliers for statistical analysis
    // Skip outlier removal for aggregation operations - we want to include all data
    const skipOutlierRemoval = [
      AnalyticalOperationType.AGGREGATION,
      AnalyticalOperationType.SUMMARY
    ].includes(operationType);
    
    let processedData: any[];
    if (skipOutlierRemoval) {
      processedData = data;
    } else {
      const { cleanedData } = this.statisticalAnalysis.detectAndRemoveOutliers(data);
      processedData = cleanedData;
    }
    
    this.logger.info(`Processed data contains ${processedData.length} records after cleaning`);
    
    let insights: any[] = [];
    let visualizationConfig: Record<string, any> | undefined = undefined;

    // Process data based on operation type
    switch (operationType) {
      case AnalyticalOperationType.AGGREGATION:
        // For aggregation, we need to calculate sums and counts
        const aggregatedResults = this.calculateAggregations(processedData);
        
        // Generate insights based on aggregations
        insights = this.generateAggregationInsights(aggregatedResults);
        
        // Create visualization config based on aggregations
        visualizationConfig = {
          type: 'bar',
          data: Object.entries(aggregatedResults.sums).map(([key, value]) => ({
            category: key,
            value
          })),
          xKey: 'category',
          yKey: 'value',
          title: 'Aggregation Results'
        };
        
        // Set processed data to the aggregated results in flattened format
        processedData = Object.entries(aggregatedResults.sums).map(([key, value]) => ({
          category: key,
          value,
          count: aggregatedResults.counts[key] || 0
        }));
        break;
        
      case AnalyticalOperationType.STATISTICAL:
        // Calculate basic statistics
        const stats = this.statisticalAnalysis.calculateBasicStats(processedData);
        
        // Generate insights from the data
        const dataMap: Record<string, number[]> = {};
        
        // Assuming data is an array of objects with numeric properties
        if (processedData.length > 0 && typeof processedData[0] === 'object') {
          // Extract numeric properties
          const numericProps = Object.keys(processedData[0]).filter(key => 
            typeof processedData[0][key] === 'number'
          );
          
          // Create data map for each numeric property
          numericProps.forEach(prop => {
            dataMap[prop] = processedData.map(item => item[prop]);
          });
          
          // Generate statistical insights
          const statInsights = this.statisticalAnalysis.generateInsights(dataMap);
          insights = statInsights;
          
          // Create visualization config based on insights
          if (statInsights.length > 0 && statInsights[0].visualizationRecommendation) {
            visualizationConfig = statInsights[0].visualizationRecommendation.config;
          }
        }
        break;
        
      // Handle other operation types...
      default:
        // Default insights from base data
        insights = this.generateBasicInsights(processedData);
    }

    return {
      processedData,
      insights,
      visualizationConfig
    };
  }

  /**
   * Process data in batches for aggregation operations on large datasets
   * @param data The full dataset to process
   * @returns Processed aggregation results
   */
  private processBatchedAggregation(data: any[]): {
    processedData: any[];
    insights: any[];
    visualizationConfig?: Record<string, any>;
  } {
    this.logger.info(`Processing large dataset with ${data.length} records using batch aggregation`);
    
    // Initialize aggregation results
    const aggregatedResults = {
      sums: {} as Record<string, number>,
      counts: {} as Record<string, number>,
      mins: {} as Record<string, number>,
      maxes: {} as Record<string, number>
    };
    
    // Process in batches to avoid memory issues
    const batchSize = 1000;
    const numBatches = Math.ceil(data.length / batchSize);
    
    this.logger.info(`Splitting into ${numBatches} batches of ${batchSize} records each`);
    
    // Process each batch
    for (let i = 0; i < numBatches; i++) {
      const batchStart = i * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, data.length);
      const batch = data.slice(batchStart, batchEnd);
      
      this.logger.info(`Processing batch ${i + 1}/${numBatches} with ${batch.length} records`);
      
      // Calculate aggregations for this batch
      const batchAggregations = this.calculateAggregations(batch);
      
      // Merge batch results into overall results
      this.mergeAggregations(aggregatedResults, batchAggregations);
    }
    
    // Generate insights based on the aggregated data
    const insights = this.generateAggregationInsights(aggregatedResults);
    
    // Create visualization configuration
    const visualizationConfig = {
      type: 'bar',
      data: Object.entries(aggregatedResults.sums).map(([key, value]) => ({
        category: key,
        value
      })),
      xKey: 'category',
      yKey: 'value',
      title: 'Aggregation Results'
    };
    
    // Create processed data in the expected format
    const processedData = Object.entries(aggregatedResults.sums).map(([key, value]) => ({
      category: key,
                value,
      count: aggregatedResults.counts[key] || 0,
      min: aggregatedResults.mins[key] || 0,
      max: aggregatedResults.maxes[key] || 0
    }));
    
    this.logger.info(`Aggregation complete, created ${processedData.length} result rows`);
    
    return {
      processedData,
      insights,
      visualizationConfig
    };
  }

  /**
   * Calculate aggregations (sum, count, min, max) for a dataset
   * @param data The data to aggregate
   * @returns Aggregation results
   */
  private calculateAggregations(data: any[]): {
    sums: Record<string, number>;
    counts: Record<string, number>;
    mins: Record<string, number>;
    maxes: Record<string, number>;
  } {
    // Initialize result structure
    const result = {
      sums: {} as Record<string, number>,
      counts: {} as Record<string, number>,
      mins: {} as Record<string, number>,
      maxes: {} as Record<string, number>
    };
    
    if (!data || data.length === 0) {
      return result;
    }
    
    try {
      // Identify potential grouping fields (categorical) and value fields (numeric)
      const firstItem = data[0];
      
      const potentialGroupFields = Object.keys(firstItem).filter(key => 
        typeof firstItem[key] === 'string' && 
        !key.startsWith('_') &&
        !/^(id|uuid|guid)$/i.test(key)
      );
      
      const potentialValueFields = Object.keys(firstItem).filter(key => 
        (typeof firstItem[key] === 'number' || 
         (typeof firstItem[key] === 'string' && !isNaN(parseFloat(firstItem[key]))))
      );
      
      this.logger.info(`Found ${potentialGroupFields.length} potential grouping fields and ${potentialValueFields.length} potential value fields`);
      
      // If we don't have both grouping and value fields, we can't perform aggregation
      if (potentialGroupFields.length === 0 || potentialValueFields.length === 0) {
        return result;
      }
      
      // Select the most appropriate grouping field (prefer categorical with fewer unique values)
      let bestGroupField = potentialGroupFields[0];
      let lowestUniqueValues = Infinity;
      
      for (const field of potentialGroupFields) {
        const uniqueValues = new Set(data.map(item => item[field])).size;
        if (uniqueValues < lowestUniqueValues) {
          lowestUniqueValues = uniqueValues;
          bestGroupField = field;
        }
      }
      
      // Select the most appropriate value field (prefer price, cost, revenue fields)
      let bestValueField = potentialValueFields[0];
      const valueKeywords = ['price', 'cost', 'revenue', 'sales', 'amount', 'value', 'quantity', 'count'];
      
      for (const field of potentialValueFields) {
        const fieldLower = field.toLowerCase();
        for (const keyword of valueKeywords) {
          if (fieldLower.includes(keyword)) {
            bestValueField = field;
        break;
          }
        }
      }
      
      this.logger.info(`Selected grouping field: ${bestGroupField}, value field: ${bestValueField}`);
      
      // Process each record
      for (const record of data) {
        const groupValue = record[bestGroupField];
        const numericValue = typeof record[bestValueField] === 'number' 
          ? record[bestValueField] 
          : parseFloat(record[bestValueField]);
        
        // Skip if we can't get a valid group or numeric value
        if (!groupValue || isNaN(numericValue)) {
          continue;
        }
        
        // Initialize group if needed
        if (!result.sums[groupValue]) {
          result.sums[groupValue] = 0;
          result.counts[groupValue] = 0;
          result.mins[groupValue] = numericValue;
          result.maxes[groupValue] = numericValue;
        }
        
        // Update aggregations
        result.sums[groupValue] += numericValue;
        result.counts[groupValue]++;
        result.mins[groupValue] = Math.min(result.mins[groupValue], numericValue);
        result.maxes[groupValue] = Math.max(result.maxes[groupValue], numericValue);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error calculating aggregations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Merge batch aggregation results into the overall results
   * @param target The target aggregation object to update
   * @param source The source aggregation object to merge in
   */
  private mergeAggregations(
    target: {
      sums: Record<string, number>;
      counts: Record<string, number>;
      mins: Record<string, number>;
      maxes: Record<string, number>;
    },
    source: {
      sums: Record<string, number>;
      counts: Record<string, number>;
      mins: Record<string, number>;
      maxes: Record<string, number>;
    }
  ): void {
    // Merge sums and counts
    for (const [key, value] of Object.entries(source.sums)) {
      if (!target.sums[key]) {
        target.sums[key] = 0;
        target.counts[key] = 0;
        target.mins[key] = Infinity;
        target.maxes[key] = -Infinity;
      }
      
      target.sums[key] += value;
      target.counts[key] += source.counts[key] || 0;
      
      // Update min/max if needed
      if (source.mins[key] !== undefined) {
        target.mins[key] = Math.min(target.mins[key], source.mins[key]);
      }
      if (source.maxes[key] !== undefined) {
        target.maxes[key] = Math.max(target.maxes[key], source.maxes[key]);
      }
    }
  }

  /**
   * Generate insights based on aggregation results
   * @param aggregatedResults The aggregation results
   * @returns Array of insights
   */
  private generateAggregationInsights(aggregatedResults: {
    sums: Record<string, number>;
    counts: Record<string, number>;
    mins?: Record<string, number>;
    maxes?: Record<string, number>;
  }): any[] {
    const insights: any[] = [];
    
    try {
      // Calculate the total sum across all categories
      const totalSum = Object.values(aggregatedResults.sums).reduce((sum, value) => sum + value, 0);
      const totalCount = Object.values(aggregatedResults.counts).reduce((sum, value) => sum + value, 0);
      
      insights.push({
        id: uuidv4(),
        type: 'total',
        description: `Total sum: ${this.formatNumber(totalSum)}`,
        importance: 1,
        confidence: 1,
        value: totalSum // Add the raw value for calculations
      });
      
      insights.push({
        id: uuidv4(),
        type: 'count',
        description: `Total records: ${totalCount}`,
        importance: 0.9,
        confidence: 1,
        value: totalCount // Add the raw value for calculations
      });
      
      // Calculate average
      if (totalCount > 0) {
        const average = totalSum / totalCount;
                insights.push({
                  id: uuidv4(),
          type: 'average',
          description: `Average value: ${this.formatNumber(average)}`,
          importance: 0.8,
          confidence: 1,
          value: average // Add the raw value for calculations
        });
      }
      
      // Find highest and lowest categories
      if (Object.keys(aggregatedResults.sums).length > 0) {
        // Sort categories by sum
        const sortedCategories = Object.entries(aggregatedResults.sums)
          .sort((a, b) => b[1] - a[1]);
          
        const highest = sortedCategories[0];
        const lowest = sortedCategories[sortedCategories.length - 1];
        
        if (highest) {
          const highestPercentage = (highest[1] / totalSum * 100).toFixed(1);
          insights.push({
            id: uuidv4(),
            type: 'highest',
            description: `Highest total: ${highest[0]} (${this.formatNumber(highest[1])}, ${highestPercentage}% of total)`,
            importance: 0.9,
            confidence: 1,
            value: highest[1], // Add the raw value for calculations
            category: highest[0] // Add the category name
          });
        }
        
        if (lowest && lowest !== highest) {
          const lowestPercentage = (lowest[1] / totalSum * 100).toFixed(1);
          insights.push({
            id: uuidv4(),
            type: 'lowest',
            description: `Lowest total: ${lowest[0]} (${this.formatNumber(lowest[1])}, ${lowestPercentage}% of total)`,
            importance: 0.7,
            confidence: 1,
            value: lowest[1], // Add the raw value for calculations
            category: lowest[0] // Add the category name
          });
        }
      }
      
      return insights;
    } catch (error) {
      this.logger.error(`Error generating aggregation insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Format a number for display in insights
   * @param value The number to format
   * @returns Formatted string
   */
  private formatNumber(value: number): string {
    try {
      // Remove any spaces that might cause display issues like "$ 2, 0 0 0 0"
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K`;
      } else {
        return value.toLocaleString('en-US', {maximumFractionDigits: 2}).replace(/\s+/g, '');
      }
    } catch (error) {
      // Fallback to simple formatting if there's an error
      return value.toString();
    }
  }

  /**
   * Clean and preprocess data
   * @param data The data to clean
   * @returns Cleaned data
   */
  public cleanAndPreprocessData(data: any[]): any[] {
    if (!data || data.length === 0) {
      return [];
    }

    // Use statistical service to detect and remove outliers
    const { cleanedData } = this.statisticalAnalysis.detectAndRemoveOutliers(data);
    
    return cleanedData;
  }

  /**
   * Generate basic insights from data
   * @param data The data to analyze
   * @returns Array of basic insights
   */
  public generateBasicInsights(data: any[]): any[] {
    const insights: any[] = [];
    
    try {
      if (!data || data.length === 0) {
        return insights;
      }
      
      // Add insight about the data size
      insights.push({
        id: uuidv4(),
        type: 'count',
        description: `Analyzed ${data.length} records`,
        importance: 0.5,
        confidence: 1
      });
      
      // Check if data has numeric properties for basic stats
      if (typeof data[0] === 'object') {
        // Find numeric properties with priority for sales, price, revenue, etc.
        const numericProps = Object.keys(data[0])
          .filter(key => 
            typeof data[0][key] === 'number' || 
            (typeof data[0][key] === 'string' && !isNaN(parseFloat(data[0][key])))
          );
        
        // Sort numeric properties by priority - price/revenue/sales first
        const priorityProps = numericProps.sort((a, b) => {
          const aPriority = /price|cost|revenue|sales|amount|total/i.test(a) ? 0 : 1;
          const bPriority = /price|cost|revenue|sales|amount|total/i.test(b) ? 0 : 1;
          return aPriority - bPriority;
        });
        
        // If we have numeric properties, add basic stats
        if (priorityProps.length > 0) {
          // Calculate basic stats for highest priority numeric property
          const prop = priorityProps[0];
          // Process data in batches to handle large datasets
          const batchSize = 10000;
          let sum = 0;
          let count = 0;
          let min = Infinity;
          let max = -Infinity;
          
          // Process data in batches
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, Math.min(i + batchSize, data.length));
            const values = batch
              .map(item => {
                // Clean and extract numeric value
                let val = item[prop];
                if (typeof val === 'string') {
                  // Remove currency symbols, commas, etc.
                  val = val.replace(/[$,€£¥]/g, '');
                  val = parseFloat(val);
                }
                return typeof val === 'number' && !isNaN(val) ? val : null;
              })
              .filter(val => val !== null) as number[];
            
            if (values.length > 0) {
              // Update totals
              const batchSum = values.reduce((acc, val) => acc + val, 0);
              sum += batchSum;
              count += values.length;
              min = Math.min(min, ...values);
              max = Math.max(max, ...values);
            }
          }
          
          // Only add insights if we have valid data
          if (count > 0) {
            const avg = sum / count;
            
            // Add insights
            insights.push({
              id: uuidv4(),
              type: 'sum',
              description: `Total ${prop}: ${this.formatNumber(sum)}`,
              importance: 0.9,
              confidence: 1,
              value: sum
            });
            
            insights.push({
              id: uuidv4(),
              type: 'average',
              description: `Average ${prop}: ${this.formatNumber(avg)}`,
              importance: 0.7,
              confidence: 1,
              value: avg
            });
            
            insights.push({
              id: uuidv4(),
              type: 'range',
              description: `Range of ${prop}: ${this.formatNumber(min)} to ${this.formatNumber(max)}`,
              importance: 0.6,
              confidence: 1,
              min: min,
              max: max
            });
          }
          
          // Check if there are categorical properties to analyze
          const categoricalProps = Object.keys(data[0]).filter(key => 
            typeof data[0][key] === 'string' && 
            !/^id$/i.test(key) && 
            !numericProps.includes(key)
          );
          
          if (categoricalProps.length > 0) {
            // Find the most informative categorical property (one with reasonable number of distinct values)
            let selectedProp = categoricalProps[0];
            let bestDistinctCount = 0;
            
            for (const catProp of categoricalProps) {
              // Sample the data to estimate distinct values
              const sample = data.slice(0, Math.min(1000, data.length));
              const distinctValues = new Set(sample.map(item => item[catProp])).size;
              
              // Good categorical properties have between 2 and 20 distinct values
              if (distinctValues >= 2 && distinctValues <= 20 && distinctValues > bestDistinctCount) {
                selectedProp = catProp;
                bestDistinctCount = distinctValues;
              }
            }
            
            // Only add distribution insight if we found a good categorical property
            if (bestDistinctCount >= 2) {
              // Calculate distribution in batches
              const distribution: Record<string, number> = {};
              
              for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, Math.min(i + batchSize, data.length));
                
                for (const item of batch) {
                  const value = String(item[selectedProp] || 'Unknown').trim();
                  if (value) {
                    distribution[value] = (distribution[value] || 0) + 1;
                  }
                }
              }
              
              insights.push({
                id: uuidv4(),
                type: 'distribution',
                description: `Distribution by ${selectedProp}`,
                importance: 0.8,
                confidence: 0.9,
                distribution
              });
            }
          }
        }
      }
      
      return insights;
    } catch (error) {
      this.logger.error(`Error generating basic insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return insights;
    }
  }
} 