/**
 * ServerAnalyticsService 
 * 
 * This service provides a bridge to server-side analytical capabilities:
 * - NlpProcessorService
 * - AnalyticsProcessorService
 * - StatisticalAnalysisService
 */

// Import types from server (these would typically be shared types)
export enum QueryType {
  DESCRIPTIVE = 'descriptive',     // What happened?
  DIAGNOSTIC = 'diagnostic',       // Why did it happen?
  PREDICTIVE = 'predictive',       // What will happen?
  PRESCRIPTIVE = 'prescriptive',   // What should we do?
  COMPARATIVE = 'comparative',     // How does X compare to Y?
  CORRELATION = 'correlation',     // Is X related to Y?
  TREND = 'trend',                 // How has X changed over time?
  ANOMALY = 'anomaly',             // Are there any outliers or unusual patterns?
  RANKING = 'ranking',             // What are the top/bottom items?
  SEGMENTATION = 'segmentation',   // How can the data be grouped?
  DISTRIBUTION = 'distribution',   // How is X distributed?
  GENERAL = 'general'              // General query
}

export enum AnalysisDomain {
  SALES = 'sales',
  MARKETING = 'marketing',
  FINANCE = 'finance',
  OPERATIONS = 'operations',
  HUMAN_RESOURCES = 'human_resources',
  CUSTOMER_SERVICE = 'customer_service',
  PRODUCT = 'product',
  GENERAL = 'general'
}

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

export interface QueryAnalysisResult {
  id: string;
  originalQuery: string;
  queryType: QueryType;
  domain: AnalysisDomain;
  entities: string[];
  temporalAspects: {
    hasTemporalReference: boolean;
    timeFrame?: 'past' | 'present' | 'future';
    timePeriod?: string;
    isTimeSeries: boolean;
  };
  dataRequirements: {
    requiredVariables: string[];
    optionalVariables: string[];
    aggregations: string[];
    filters: string[];
    groupBy?: string[];
    sortBy?: { field: string; direction: 'asc' | 'desc' }[];
  };
  suggestedAnalyses: string[];
  suggestedVisualizations: string[];
}

export interface CorrelationResult {
  variable1: string;
  variable2: string;
  coefficient: number;
  pValue: number;
  isSignificant: boolean;
}

export interface TrendResult {
  type: string; // 'increasing', 'decreasing', etc.
  strength: number;
  pValue: number;
  isSignificant: boolean;
}

export interface StatisticalInsight {
  id: string;
  type: 'correlation' | 'anomaly' | 'trend' | 'forecast' | 'general';
  description: string;
  confidence: number;
  importance: number;
  relatedVariables: string[];
  visualizationRecommendation?: {
    type: string;
    config: any;
  };
}

/**
 * ServerAnalyticsService provides a bridge to server-side analytical services
 */
export class ServerAnalyticsService {
  private static instance: ServerAnalyticsService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api';
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ServerAnalyticsService {
    if (!ServerAnalyticsService.instance) {
      ServerAnalyticsService.instance = new ServerAnalyticsService();
    }
    return ServerAnalyticsService.instance;
  }

  /**
   * Analyze a query using NLP Processor
   */
  public async analyzeQuery(query: string): Promise<QueryAnalysisResult> {
    try {
      const response = await fetch(`${this.baseUrl}/nlp/analyze-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze query: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing query:', error);
      
      // Return a fallback analysis with basic information
      return {
        id: Date.now().toString(),
        originalQuery: query,
        queryType: QueryType.GENERAL,
        domain: AnalysisDomain.GENERAL,
        entities: [],
        temporalAspects: {
          hasTemporalReference: false,
          isTimeSeries: false
        },
        dataRequirements: {
          requiredVariables: [],
          optionalVariables: [],
          aggregations: [],
          filters: []
        },
        suggestedAnalyses: [],
        suggestedVisualizations: []
      };
    }
  }

  /**
   * Determine analytical operations using Analytics Processor
   */
  public async determineAnalyticalOperations(query: string): Promise<AnalyticalOperationType[]> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/determine-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Failed to determine operations: ${response.statusText}`);
      }

      const data = await response.json();
      return data.operations;
    } catch (error) {
      console.error('Error determining analytical operations:', error);
      
      // Implement a fallback using a simplified algorithm (similar to what we had)
      return this.fallbackDetermineOperations(query);
    }
  }

  /**
   * Determine visualization type using Analytics Processor
   */
  public async determineVisualizationType(
    query: string, 
    operations: AnalyticalOperationType[]
  ): Promise<VisualizationType> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/determine-visualization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, operations })
      });

      if (!response.ok) {
        throw new Error(`Failed to determine visualization: ${response.statusText}`);
      }

      const data = await response.json();
      return data.visualizationType;
    } catch (error) {
      console.error('Error determining visualization type:', error);
      
      // Enhanced fallback visualization selection with comprehensive rules
      return this.fallbackDetermineVisualizationType(query, operations);
    }
  }

  /**
   * Fallback visualization type determination with comprehensive support for all chart types
   */
  private fallbackDetermineVisualizationType(
    query: string, 
    operations: AnalyticalOperationType[]
  ): VisualizationType {
    const lowerQuery = query.toLowerCase();
    
    // Check for explicit chart type mentions in the query
    if (lowerQuery.includes('bar chart') || lowerQuery.includes('bar graph')) {
      return VisualizationType.BAR_CHART;
    } else if (lowerQuery.includes('line chart') || lowerQuery.includes('trend line')) {
      return VisualizationType.LINE_CHART;
    } else if (lowerQuery.includes('pie chart') || lowerQuery.includes('donut chart')) {
      return VisualizationType.PIE_CHART;
    } else if (lowerQuery.includes('scatter plot') || lowerQuery.includes('scatter chart')) {
      return VisualizationType.SCATTER_PLOT;
    } else if (lowerQuery.includes('histogram')) {
      return VisualizationType.HISTOGRAM;
    } else if (lowerQuery.includes('heatmap')) {
      return VisualizationType.HEATMAP;
    } else if (lowerQuery.includes('table') || lowerQuery.includes('grid')) {
      return VisualizationType.TABLE;
    } else if (lowerQuery.includes('tree map') || lowerQuery.includes('treemap')) {
      return VisualizationType.TREE_MAP;
    } else if (lowerQuery.includes('bubble chart')) {
      return VisualizationType.BUBBLE_CHART;
    } else if (lowerQuery.includes('radar chart') || lowerQuery.includes('spider chart')) {
      return VisualizationType.RADAR_CHART;
    } else if (lowerQuery.includes('funnel')) {
      return VisualizationType.FUNNEL_CHART;
    } else if (lowerQuery.includes('gauge')) {
      return VisualizationType.GAUGE_CHART;
    } else if (lowerQuery.includes('network') || lowerQuery.includes('graph')) {
      return VisualizationType.NETWORK_GRAPH;
    } else if (lowerQuery.includes('map') || lowerQuery.includes('geographical') || lowerQuery.includes('geo')) {
      return VisualizationType.GEOSPATIAL_MAP;
    } else if (lowerQuery.includes('sankey')) {
      return VisualizationType.SANKEY_DIAGRAM;
    } else if (lowerQuery.includes('animated') || lowerQuery.includes('motion')) {
      return VisualizationType.ANIMATED_CHART;
    } else if (lowerQuery.includes('3d') || lowerQuery.includes('three dimensional')) {
      return VisualizationType.THREE_D_CHART;
    }
    
    // If no explicit mention, determine based on analytical operations and query intent
    
    // Distribution visualization
    if (lowerQuery.includes('distribution') || lowerQuery.includes('spread')) {
      return VisualizationType.HISTOGRAM;
    }
    
    // Part-to-whole relationships
    if (lowerQuery.includes('percentage') || lowerQuery.includes('proportion') || 
        lowerQuery.includes('composition') || lowerQuery.includes('breakdown') || 
        lowerQuery.includes('share')) {
      return VisualizationType.PIE_CHART;
    }
    
    // Time-series data
    if (lowerQuery.includes('over time') || lowerQuery.includes('trend') || 
        lowerQuery.includes('evolution') || lowerQuery.includes('growth') || 
        lowerQuery.includes('changes') || lowerQuery.includes('historical') ||
        operations.includes(AnalyticalOperationType.FORECASTING)) {
      return VisualizationType.LINE_CHART;
    }
    
    // Correlations
    if (lowerQuery.includes('correlation') || lowerQuery.includes('relationship') || 
        lowerQuery.includes('versus') || lowerQuery.includes(' vs ') || 
        lowerQuery.includes('compared to') || lowerQuery.includes('against')) {
      return VisualizationType.SCATTER_PLOT;
    }
    
    // Geographical data
    if (lowerQuery.includes('country') || lowerQuery.includes('region') || 
        lowerQuery.includes('location') || lowerQuery.includes('geographic') || 
        lowerQuery.includes('spatial')) {
      return VisualizationType.GEOSPATIAL_MAP;
    }
    
    // Network relationships
    if (lowerQuery.includes('network') || lowerQuery.includes('connections') || 
        lowerQuery.includes('relationships') || lowerQuery.includes('links')) {
      return VisualizationType.NETWORK_GRAPH;
    }
    
    // Hierarchical data
    if (lowerQuery.includes('hierarchy') || lowerQuery.includes('nested') || 
        lowerQuery.includes('parent') || lowerQuery.includes('child')) {
      return VisualizationType.TREE_MAP;
    }
    
    // Flow data
    if (lowerQuery.includes('flow') || lowerQuery.includes('process') || 
        lowerQuery.includes('stages') || lowerQuery.includes('progression')) {
      return VisualizationType.SANKEY_DIAGRAM;
    }
    
    // Multi-dimensional comparisons
    if (lowerQuery.includes('dimensions') || lowerQuery.includes('attributes') || 
        lowerQuery.includes('characteristics') || lowerQuery.includes('features')) {
      return VisualizationType.RADAR_CHART;
    }
    
    // Determine based on operations
    if (operations.includes(AnalyticalOperationType.COMPARATIVE)) {
      // For comparisons between categories
      return VisualizationType.BAR_CHART;
    } else if (operations.includes(AnalyticalOperationType.FORECASTING) || 
              operations.includes(AnalyticalOperationType.STATISTICAL)) {
      // For time series or statistical analysis
      return VisualizationType.LINE_CHART;
    } else {
      // Default to bar chart as a general-purpose visualization
      return VisualizationType.BAR_CHART;
    }
  }

  /**
   * Generate statistical insights using Statistical Analysis Service
   */
  public async generateStatisticalInsights(data: any[]): Promise<StatisticalInsight[]> {
    try {
      const response = await fetch(`${this.baseUrl}/statistics/generate-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.statusText}`);
      }

      const result = await response.json();
      return result.insights;
    } catch (error) {
      console.error('Error generating statistical insights:', error);
      return []; // Return empty insights on error
    }
  }

  /**
   * Calculate correlations using Statistical Analysis Service
   */
  public async calculateCorrelations(
    data: any[], 
    variables: string[]
  ): Promise<CorrelationResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/statistics/calculate-correlations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data, variables })
      });

      if (!response.ok) {
        throw new Error(`Failed to calculate correlations: ${response.statusText}`);
      }

      const result = await response.json();
      return result.correlations;
    } catch (error) {
      console.error('Error calculating correlations:', error);
      return []; // Return empty correlations on error
    }
  }

  /**
   * Detect trends using Statistical Analysis Service
   */
  public async detectTrends(data: any[], timeVariable: string, valueVariable: string): Promise<TrendResult> {
    try {
      const response = await fetch(`${this.baseUrl}/statistics/detect-trend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data, timeVariable, valueVariable })
      });

      if (!response.ok) {
        throw new Error(`Failed to detect trend: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error detecting trend:', error);
      
      // Return a fallback trend result
      return {
        type: 'unknown',
        strength: 0,
        pValue: 1,
        isSignificant: false
      };
    }
  }

  /**
   * Create an analytical process template using Analytics Processor
   */
  public async createAnalyticalProcess(query: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/create-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Failed to create analytical process: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating analytical process:', error);
      return null;
    }
  }

  /**
   * Fallback method to determine operations when the API is unavailable
   */
  private fallbackDetermineOperations(query: string): AnalyticalOperationType[] {
    const lowerQuery = query.toLowerCase();
    const operations: AnalyticalOperationType[] = [];
    
    // Detecting filtering operations
    if (
      lowerQuery.includes('filter') || 
      lowerQuery.includes('where') || 
      lowerQuery.includes('only') || 
      lowerQuery.includes('exclude') || 
      lowerQuery.includes('remove')
    ) {
      operations.push(AnalyticalOperationType.FILTERING);
    }
    
    // Detecting aggregation operations
    if (
      lowerQuery.includes('total') || 
      lowerQuery.includes('sum') || 
      lowerQuery.includes('average') || 
      lowerQuery.includes('mean') || 
      lowerQuery.includes('median') || 
      lowerQuery.includes('count')
    ) {
      operations.push(AnalyticalOperationType.AGGREGATION);
    }
    
    // Detecting grouping operations
    if (
      lowerQuery.includes('group') || 
      lowerQuery.includes('categorize') || 
      lowerQuery.includes('segment') || 
      lowerQuery.includes('classify') ||
      lowerQuery.includes('by region') ||
      lowerQuery.includes('by category')
    ) {
      operations.push(AnalyticalOperationType.GROUPING);
    }
    
    // Detecting sorting operations
    if (
      lowerQuery.includes('sort') || 
      lowerQuery.includes('order') || 
      lowerQuery.includes('rank') || 
      lowerQuery.includes('top') || 
      lowerQuery.includes('bottom')
    ) {
      operations.push(AnalyticalOperationType.SORTING);
    }
    
    // Detecting visualization operations
    if (
      lowerQuery.includes('visualize') || 
      lowerQuery.includes('visualization') || 
      lowerQuery.includes('chart') || 
      lowerQuery.includes('graph') || 
      lowerQuery.includes('plot')
    ) {
      operations.push(AnalyticalOperationType.VISUALIZATION);
    }
    
    // Detecting comparative operations
    if (
      lowerQuery.includes('compare') || 
      lowerQuery.includes('versus') || 
      lowerQuery.includes(' vs') || 
      lowerQuery.includes('against') || 
      lowerQuery.includes('difference')
    ) {
      operations.push(AnalyticalOperationType.COMPARATIVE);
    }
    
    // If no operations were detected, add a default 'summary' operation
    if (operations.length === 0) {
      operations.push(AnalyticalOperationType.SUMMARY);
    }
    
    return operations;
  }
}

// Export singleton instance
export const serverAnalyticsService = ServerAnalyticsService.getInstance(); 