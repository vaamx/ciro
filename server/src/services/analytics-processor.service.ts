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
  BAR_CHART = 'bar_chart',
  LINE_CHART = 'line_chart',
  PIE_CHART = 'pie_chart',
  SCATTER_PLOT = 'scatter_plot',
  HISTOGRAM = 'histogram',
  HEATMAP = 'heatmap',
  TABLE = 'table',
  TREE_MAP = 'tree_map',
  BUBBLE_CHART = 'bubble_chart',
  RADAR_CHART = 'radar_chart',
  FUNNEL_CHART = 'funnel_chart',
  GAUGE_CHART = 'gauge_chart',
  NETWORK_GRAPH = 'network_graph',
  GEOSPATIAL_MAP = 'geospatial_map',
  SANKEY_DIAGRAM = 'sankey_diagram',
  SPIDER_CHART = 'spider_chart',
  ANIMATED_CHART = 'animated_chart',
  THREE_D_CHART = 'three_d_chart'
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
        'histogram': VisualizationType.HISTOGRAM,
        'heat map': VisualizationType.HEATMAP,
        'table': VisualizationType.TABLE,
        'treemap': VisualizationType.TREE_MAP,
        'bubble chart': VisualizationType.BUBBLE_CHART,
        'radar chart': VisualizationType.RADAR_CHART,
        'funnel chart': VisualizationType.FUNNEL_CHART,
        'gauge chart': VisualizationType.GAUGE_CHART
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
      return VisualizationType.HISTOGRAM;
    } else if (normalizedQuery.includes('heatmap') || normalizedQuery.includes('heat map')) {
      return VisualizationType.HEATMAP;
    } else if (normalizedQuery.includes('table')) {
      return VisualizationType.TABLE;
    } else if (normalizedQuery.includes('treemap') || normalizedQuery.includes('tree map')) {
      return VisualizationType.TREE_MAP;
    } else if (normalizedQuery.includes('bubble chart') || normalizedQuery.includes('bubble graph')) {
      return VisualizationType.BUBBLE_CHART;
    } else if (normalizedQuery.includes('radar chart') || normalizedQuery.includes('radar graph') || normalizedQuery.includes('spider chart')) {
      return VisualizationType.RADAR_CHART;
    } else if (normalizedQuery.includes('funnel chart') || normalizedQuery.includes('funnel graph')) {
      return VisualizationType.FUNNEL_CHART;
    } else if (normalizedQuery.includes('gauge chart') || normalizedQuery.includes('gauge graph')) {
      return VisualizationType.GAUGE_CHART;
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
      return VisualizationType.HISTOGRAM;
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
   * Process data for statistical analysis
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

    // Clean data by removing outliers
    const { cleanedData, outliers } = this.statisticalAnalysis.detectAndRemoveOutliers(data);
    
    let processedData: any[] = cleanedData;
    let insights: any[] = [];
    let visualizationConfig: Record<string, any> | undefined = undefined;

    // Process data based on operation type
    switch (operationType) {
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
        
      case AnalyticalOperationType.FORECASTING:
        // Generate forecast
        if (processedData.length >= 5) {
          // Extract numeric values for forecasting
          let timeSeriesData: number[] = [];
          
          if (Array.isArray(processedData) && typeof processedData[0] === 'number') {
            // If data is already an array of numbers
            timeSeriesData = processedData as number[];
          } else if (Array.isArray(processedData) && typeof processedData[0] === 'object') {
            // If data is an array of objects, extract the 'value' property or first numeric property
            const firstItem = processedData[0];
            if (firstItem && 'value' in firstItem && typeof firstItem.value === 'number') {
              timeSeriesData = processedData.map(item => (item as any).value as number);
            } else if (firstItem) {
              // Find the first numeric property
              const numericProp = Object.keys(firstItem).find(key => typeof firstItem[key] === 'number');
              if (numericProp) {
                timeSeriesData = processedData.map(item => (item as any)[numericProp] as number);
              }
            }
          }
          
          if (timeSeriesData.length >= 5) {
            const forecast = this.statisticalAnalysis.generateForecast(timeSeriesData);
            
            if (forecast) {
              // Create forecast data points
              const forecastPoints = forecast.forecastData.map((value, index) => ({
                type: 'forecast',
                value,
                lowerBound: forecast.lowerBound[index],
                upperBound: forecast.upperBound[index]
              }));
              
              // Add forecast points to processed data
              // Use type assertion to avoid type error
              processedData = [...processedData, ...forecastPoints] as any[];
              
              insights.push({
                id: uuidv4(),
                type: 'forecast',
                description: `Forecast generated with ${forecast.method} method. MAPE: ${forecast.mape ? (forecast.mape * 100).toFixed(2) + '%' : 'N/A'}`,
                confidence: 0.8,
                importance: 0.9,
                relatedVariables: ['forecast']
              });
              
              visualizationConfig = {
                type: 'line',
                data: processedData,
                xKey: 'index',
                yKey: 'value',
                showConfidenceInterval: true
              };
            }
          }
        }
        break;
        
      case AnalyticalOperationType.COMPARATIVE:
        // Perform comparative analysis
        if (processedData.length > 0 && typeof processedData[0] === 'object') {
          // Extract numeric properties
          const numericProps = Object.keys(processedData[0]).filter(key => 
            typeof processedData[0][key] === 'number'
          );
          
          // Create data map for each numeric property
          const dataMap: Record<string, number[]> = {};
          numericProps.forEach(prop => {
            dataMap[prop] = processedData.map(item => item[prop]);
          });
          
          // Calculate correlations between variables
          for (let i = 0; i < numericProps.length; i++) {
            for (let j = i + 1; j < numericProps.length; j++) {
              const correlation = this.statisticalAnalysis.calculateCorrelation(
                dataMap[numericProps[i]],
                dataMap[numericProps[j]],
                numericProps[i],
                numericProps[j]
              );
              
              if (correlation && correlation.isSignificant) {
                insights.push({
                  id: uuidv4(),
                  type: 'correlation',
                  description: `There is a ${correlation.coefficient > 0 ? 'positive' : 'negative'} correlation of ${correlation.coefficient.toFixed(2)} between ${correlation.variable1} and ${correlation.variable2} (p-value: ${correlation.pValue.toFixed(4)})`,
                  confidence: 1 - correlation.pValue,
                  importance: Math.abs(correlation.coefficient),
                  relatedVariables: [correlation.variable1, correlation.variable2]
                });
              }
            }
          }
          
          visualizationConfig = {
            type: 'bar',
            data: processedData,
            xKey: numericProps[0],
            yKey: numericProps[1],
            comparative: true
          };
        }
        break;
        
      case AnalyticalOperationType.INSIGHTS:
        // Generate insights from the data
        if (processedData.length > 0 && typeof processedData[0] === 'object') {
          // Extract numeric properties
          const numericProps = Object.keys(processedData[0]).filter(key => 
            typeof processedData[0][key] === 'number'
          );
          
          // Create data map for each numeric property
          const dataMap: Record<string, number[]> = {};
          numericProps.forEach(prop => {
            dataMap[prop] = processedData.map(item => item[prop]);
          });
          
          // Generate statistical insights
          insights = this.statisticalAnalysis.generateInsights(dataMap);
        }
        break;
    }

    return {
      processedData,
      insights,
      visualizationConfig
    };
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
} 