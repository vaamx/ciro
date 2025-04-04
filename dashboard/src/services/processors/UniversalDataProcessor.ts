import { OpenAIService } from '../openai/OpenAIService';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { 
  StructuredAnalysisResponse, 
  AnalysisStep, 
  Visualization 
} from "../../types/ExcelTypes";
import { TableFormatter } from '../TableFormatter';
import { ServerAnalyticsService } from '../ServerAnalyticsService';
import { ChartProcessor } from '../../Visualization/ChartProcessor';

// Import these types from ServerAnalyticsService instead of defining them locally
import { 
  AnalyticalOperationType, 
  VisualizationType,
  QueryType,
  CorrelationResult,
  TrendResult
} from '../ServerAnalyticsService';

/**
 * Progress callback function type for tracking processing progress
 */
export type ProgressCallback = (stage: string, progress: number, message?: string) => void;

/**
 * DataSourceType - Represents the different types of data sources 
 * that can be processed by the UniversalDataProcessor
 */
export enum DataSourceType {
  EXCEL = 'excel',
  CSV = 'csv',
  PDF = 'pdf',
  DOC = 'document',
  TEXT = 'text',
  JSON = 'json',
  TABLE = 'table', // Any generic tabular data
  UNKNOWN = 'unknown'
}

/**
 * Processing stage names for progress tracking
 */
export enum ProcessingStage {
  INITIALIZING = 'Initializing',
  ANALYZING_QUERY = 'Analyzing Query',
  DETERMINING_OPERATIONS = 'Determining Operations',
  PREPROCESSING_DATA = 'Preprocessing Data',
  ENHANCING_DATA = 'Enhancing Data',
  GENERATING_RESPONSE = 'Generating Response',
  PARSING_RESPONSE = 'Parsing Response',
  PREPARING_VISUALIZATION = 'Preparing Visualization',
  COMPLETED = 'Completed'
}

/**
 * UniversalDataProcessor - A generalized handler for all types of data queries
 * that provides structured, step-by-step responses regardless of data source
 */
export class UniversalDataProcessor {
  private openaiService: OpenAIService;
  private serverAnalyticsService: ServerAnalyticsService;
  private progressCallback: ProgressCallback | null = null;

  constructor() {
    this.openaiService = new OpenAIService();
    // Use the singleton pattern to get the ServerAnalyticsService instance
    this.serverAnalyticsService = ServerAnalyticsService.getInstance();
  }

  /**
   * Set a progress callback to track processing stages
   * @param callback The progress callback function
   */
  public setProgressCallback(callback: ProgressCallback | null): void {
    this.progressCallback = callback;
  }

  /**
   * Update progress with current stage and percentage
   * @param stage The current processing stage
   * @param progress Percentage of completion (0-100)
   * @param message Optional status message
   */
  private updateProgress(stage: ProcessingStage, progress: number, message?: string): void {
    if (this.progressCallback) {
      this.progressCallback(stage, progress, message);
    }
  }

  /**
   * Process any data query with a structured, analytical approach
   * @param query The user's query
   * @param data The data in JSON format
   * @param dataSourceType The type of data source
   * @returns A formatted response with structured analysis
   */
  public async processDataQuery(
    query: string,
    data: any,
    dataSourceType: DataSourceType = DataSourceType.UNKNOWN
  ): Promise<any> {
    console.log(`Processing ${dataSourceType} query: "${query}"`);
    
    this.updateProgress(ProcessingStage.INITIALIZING, 0, "Starting analysis...");
    
    try {
      // Use the NLP processor to analyze the query
      this.updateProgress(ProcessingStage.ANALYZING_QUERY, 10, "Analyzing your question...");
      const queryAnalysis = await this.serverAnalyticsService.analyzeQuery(query);
      console.log(`Query analysis:`, queryAnalysis);
      
      // Determine analytical operations based on query analysis
      this.updateProgress(ProcessingStage.DETERMINING_OPERATIONS, 20, "Determining analytical operations...");
      let analyticalOperations: AnalyticalOperationType[] = [];
      if (queryAnalysis.queryType !== QueryType.GENERAL) {
        analyticalOperations = await this.serverAnalyticsService.determineAnalyticalOperations(query);
        console.log(`Analytical operations from server:`, analyticalOperations);
      }
      
      // Create a structured analytical prompt based on the data source type
      const systemMessage = this.createSystemPrompt(
        dataSourceType, 
        analyticalOperations
      );

      // Preprocess the data based on its type
      this.updateProgress(ProcessingStage.PREPROCESSING_DATA, 30, "Preprocessing data...");
      const processedData = this.preprocessData(data, dataSourceType);
      
      // Add statistical insights using the server's statistical analysis service
      this.updateProgress(ProcessingStage.ENHANCING_DATA, 50, "Enhancing data with statistical insights...");
      const enhancedData = this.canApplyStatistics(data) && analyticalOperations.length > 0
        ? await this.enhanceDataWithServerStatistics(processedData, analyticalOperations)
        : processedData;
      
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMessage },
        { 
          role: 'user', 
          content: `Here is my ${dataSourceType} data:\n${enhancedData}\n\nMy question is: ${query}` 
        }
      ];

      // Get the response from the language model
      this.updateProgress(ProcessingStage.GENERATING_RESPONSE, 70, "Generating response...");
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o',
          temperature: 0.0,
          max_tokens: 2500
        }
      );

      // Process and structure the response
      const content = response || 'No response received';
      
      // Determine the best visualization type using the server service
      this.updateProgress(ProcessingStage.PREPARING_VISUALIZATION, 80, "Preparing visualization...");
      const visualizationType = await this.serverAnalyticsService.determineVisualizationType(
        query, 
        analyticalOperations
      );
      
      // Parse structured content into visualization-friendly format
      this.updateProgress(ProcessingStage.PARSING_RESPONSE, 90, "Parsing structured response...");
      const structuredResponse = this.parseStructuredResponse(
        content, 
        analyticalOperations,
        visualizationType
      );
      
      // Use the server to create the analytical process
      const analyticalProcess = await this.serverAnalyticsService.createAnalyticalProcess(query);
      
      this.updateProgress(ProcessingStage.COMPLETED, 100, "Analysis complete!");
      
      return {
        content,
        structuredResponse,
        metadata: {
          isAnalytical: queryAnalysis.queryType !== QueryType.GENERAL,
          hasStructuredResponse: true,
          dataSourceType,
          analyticalOperations,
          queryAnalysis,
          analyticalProcess
        }
      };
    } catch (error: any) {
      console.error(`Error in processDataQuery for ${dataSourceType}:`, error);
      this.updateProgress(ProcessingStage.COMPLETED, 100, `Error: ${error.message || 'Unknown error'}`);
      return {
        content: `I encountered an error while processing your query: ${error.message || 'Unknown error'}`,
        structuredResponse: {
          summary: "",
          steps: [],
          insights: [],
          visualization: null
        },
        metadata: {
          isAnalytical: false,
          error: error.message || 'Unknown error',
          dataSourceType
        }
      };
    }
  }

  /**
   * Creates a custom system prompt based on the data source type
   */
  private createSystemPrompt(dataSourceType: DataSourceType, analyticalOperations: AnalyticalOperationType[] = []): string {
    // Common guidelines for all data sources
    const commonGuidelines = `
You are an expert data analyst. Analyze the data provided according to the user's question.

IMPORTANT GUIDELINES:
- Only use the data provided. DO NOT hallucinate or make up data points.
- Provide a step-by-step breakdown of your analysis process.
- Include relevant calculations and visualizations when applicable.
- Format your response with clear section headers for easier parsing.
- Each analysis step should have a clear TYPE that describes the operation being performed.

RESPONSE FORMAT - Use the following structure:
## Summary
[Provide a brief summary of findings]

## Steps
1. [Analysis step 1]
2. [Analysis step 2]
3. [Analysis step 3]
[Add more steps as needed]

## Insights
- [Key insight 1]
- [Key insight 2]
- [Key insight 3]
[Add more insights as needed]
`;

    // Enhanced prompting if analytical operations were detected
    let analyticalPrompt = '';
    if (analyticalOperations.length > 0) {
      analyticalPrompt = `
ANALYTICAL OPERATIONS:
I've detected that this query is analytical in nature and involves the following operations:
${analyticalOperations.map(op => `- ${op.toUpperCase()}`).join('\n')}

Your response should address these specific analytical needs with appropriate steps.
`;
    }

    // Data source specific guidelines
    let dataSpecificGuidelines = '';
    
    switch (dataSourceType) {
      case DataSourceType.EXCEL:
      case DataSourceType.CSV:
      case DataSourceType.TABLE:
        dataSpecificGuidelines = `
## Visualization
Chart Type: [bar, line, pie, scatter, area]
X-Axis: [column name]
Y-Axis: [column name]
Data:
\`\`\`json
[Include the data for the visualization in JSON format]
\`\`\`

## Table
If appropriate, provide a formatted table of the most relevant data:
\`\`\`json
[Include the data for the table in JSON format]
\`\`\`

STEP TYPES:
When defining your analysis steps, use one of these step types that best describes the operation:
- filtering: When you're filtering or selecting a subset of the data
- aggregation: When you're calculating sums, averages, etc.
- grouping: When you're grouping data by a specific dimension
- sorting: When you're ordering data by a specific criterion
- visualization: When you're creating a visual representation
- comparative: When you're comparing different sets of data
- insights: When you're drawing conclusions from the data
- table: When you're presenting tabular data
`;
        break;
        
      case DataSourceType.PDF:
      case DataSourceType.DOC:
        dataSpecificGuidelines = `
## Key Information
- [Important piece of information 1]
- [Important piece of information 2]
- [Important piece of information 3]

## Table
If the document contains tabular data, provide it in a structured format:
\`\`\`json
[Include the table data in JSON format]
\`\`\`

STEP TYPES:
When defining your analysis steps, use one of these step types that best describes the operation:
- filtering: When you're extracting specific information
- insights: When you're drawing conclusions from the content
- table: When you're presenting tabular data
`;
        break;
        
      case DataSourceType.JSON:
        dataSpecificGuidelines = `
## Structure Analysis
[Description of the JSON structure]

## Key Values
- [Important key/value pair 1]
- [Important key/value pair 2]
- [Important key/value pair 3]

## Table
If appropriate, provide a formatted table of the most relevant data:
\`\`\`json
[Include the data for the table in JSON format]
\`\`\`

STEP TYPES:
When defining your analysis steps, use one of these step types that best describes the operation:
- filtering: When you're extracting specific information
- aggregation: When you're calculating values from the data
- insights: When you're drawing conclusions from the data
- table: When you're presenting tabular data
`;
        break;
        
      default:
        dataSpecificGuidelines = `
## Key Points
- [Key point 1]
- [Key point 2]
- [Key point 3]

## Table
If the data contains any tabular information, provide it in a structured format:
\`\`\`json
[Include the table data in JSON format]
\`\`\`

STEP TYPES:
When defining your analysis steps, use one of these step types that best describes the operation:
- filtering: When you're extracting specific information
- insights: When you're drawing conclusions
- table: When you're presenting tabular data
`;
        break;
    }
    
    // Visualization instructions for all data sources
    const visualizationInstructions = `
VISUALIZATION RULES:
1. Select the most appropriate chart type for the data and query.
2. Format data properly as an array of objects with consistent properties.
3. ONLY include columns relevant to the visualization.
4. For time series data, use line or area charts.
5. For comparisons between categories, use bar charts.
6. For part-to-whole relationships, use pie charts.
7. For correlations, use scatter plots.
8. Always include proper headers/property names in the visualization data.

TABLE FORMATTING RULES:
1. Always include headers for each column.
2. Format data as an array of objects with consistent properties.
3. If the table has many columns, focus on the most relevant ones for the query.
4. Ensure numeric values are properly formatted as numbers.
5. Ensure dates are properly formatted.

STEP FORMAT:
For each analysis step, include:
- type: The type of operation being performed (see STEP TYPES above)
- description: A clear, concise description of what the step does
- data: Any relevant data in JSON format
`;

    return `${commonGuidelines}\n${analyticalPrompt}\n${dataSpecificGuidelines}\n${visualizationInstructions}`;
  }

  /**
   * Preprocess the data based on its type
   */
  private preprocessData(data: any, dataSourceType: DataSourceType): string {
    switch (dataSourceType) {
      case DataSourceType.EXCEL:
      case DataSourceType.JSON:
        return JSON.stringify(data, null, 2);
        
      case DataSourceType.CSV:
        // If the CSV data is already parsed into an array of objects
        if (Array.isArray(data) && typeof data[0] === 'object') {
          return JSON.stringify(data, null, 2);
        }
        // Otherwise, try to parse it
        const parsed = TableFormatter.parseCSVLikeContent(data);
        return parsed ? JSON.stringify(parsed, null, 2) : data;
        
      case DataSourceType.TABLE:
        if (typeof data === 'string') {
          // Try to parse as CSV or extract tables from markdown
          const parsed = TableFormatter.parseCSVLikeContent(data) || 
                         TableFormatter.extractTablesFromMarkdown(data)[0];
          return parsed ? JSON.stringify(parsed, null, 2) : data;
        }
        return JSON.stringify(data, null, 2);
        
      case DataSourceType.PDF:
      case DataSourceType.DOC:
      case DataSourceType.TEXT:
      default:
        // For text-based documents, send as is
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  }

  /**
   * Check if statistical analysis can be applied to this data
   */
  private canApplyStatistics(data: any): boolean {
    // Check if data is an array of objects with numeric properties
    if (!Array.isArray(data) || data.length === 0) return false;
    
    // Check if at least one property in the first object is numeric
    const firstItem = data[0];
    return Object.values(firstItem).some(value => typeof value === 'number');
  }

  /**
   * Enhance data with statistical insights from the server
   */
  private async enhanceDataWithServerStatistics(
    data: string, 
    operations: AnalyticalOperationType[]
  ): Promise<string> {
    try {
      // Parse the data
      const parsedData = JSON.parse(data);
      
      // If not an array, we can't apply statistics
      if (!Array.isArray(parsedData) || parsedData.length === 0) return data;
      
      // Get statistical insights from the server
      const insights = await this.serverAnalyticsService.generateStatisticalInsights(parsedData);
      
      // Calculate correlations if needed
      let correlations: CorrelationResult[] = [];
      if (operations.includes(AnalyticalOperationType.COMPARATIVE)) {
        // Extract numeric variables for correlation analysis
        const firstItem = parsedData[0];
        const numericVariables = Object.keys(firstItem).filter(
          key => typeof firstItem[key] === 'number'
        );
        correlations = await this.serverAnalyticsService.calculateCorrelations(parsedData, numericVariables);
      }
      
      // Detect trends if needed
      let trends: TrendResult | null = null;
      if (operations.includes(AnalyticalOperationType.FORECASTING)) {
        // Try to identify time and value variables for trend analysis
        const firstItem = parsedData[0];
        const timeVariable = Object.keys(firstItem).find(key => 
          key.toLowerCase().includes('date') || 
          key.toLowerCase().includes('time') ||
          key.toLowerCase().includes('year') ||
          key.toLowerCase().includes('month')
        ) || Object.keys(firstItem)[0];
        
        // Find a numeric variable for the value
        const valueVariable = Object.keys(firstItem).find(key => 
          typeof firstItem[key] === 'number' && key !== timeVariable
        ) || Object.keys(firstItem)[1];
        
        trends = await this.serverAnalyticsService.detectTrends(parsedData, timeVariable, valueVariable);
      }
      
      // Format insights as a comment
      let statisticalComment = `/* \nSTATISTICAL INSIGHTS:\n`;
      
      if (insights && insights.length > 0) {
        statisticalComment += `Basic statistics:\n${JSON.stringify(insights, null, 2)}\n\n`;
      }
      
      if (correlations && correlations.length > 0) {
        statisticalComment += `Correlations:\n${JSON.stringify(correlations, null, 2)}\n\n`;
      }
      
      if (trends) {
        statisticalComment += `Trends:\n${JSON.stringify(trends, null, 2)}\n\n`;
      }
      
      statisticalComment += `*/`;
      
      return `${data}\n\n${statisticalComment}`;
    } catch (error) {
      console.error("Error enhancing data with server statistics:", error);
      return data;
    }
  }

  /**
   * Parses the structured text response into a visualization-friendly format
   */
  private parseStructuredResponse(
    content: string, 
    analyticalOperations: AnalyticalOperationType[] = [],
    suggestedVisualizationType?: VisualizationType
  ): StructuredAnalysisResponse {
    try {
      // Extract different sections using regex
      const summaryMatch = content.match(/## Summary\s+([\s\S]*?)(?=##|$)/);
      const stepsMatch = content.match(/## Steps\s+([\s\S]*?)(?=##|$)/);
      const insightsMatch = content.match(/## Insights\s+([\s\S]*?)(?=##|$)/);
      const visualizationMatch = content.match(/## Visualization\s+([\s\S]*?)(?=##|$)/);
      const tableMatch = content.match(/## Table\s+([\s\S]*?)(?=##|$)/);
      
      // Parse steps
      const steps: AnalysisStep[] = [];
      if (stepsMatch && stepsMatch[1]) {
        const stepsText = stepsMatch[1].trim();
        const stepMatches = stepsText.match(/\d+\.\s+([\s\S]*?)(?=\d+\.|$)/g);
        
        if (stepMatches) {
          stepMatches.forEach((step, index) => {
            const stepText = step.replace(/^\d+\.\s+/, '').trim();
            
            // Try to extract step type from text
            let stepType = 'analysis'; // Default type
            const typeMatch = stepText.match(/\b(filtering|aggregation|grouping|sorting|visualization|comparative|insights|table)\b/i);
            if (typeMatch) {
              stepType = typeMatch[1].toLowerCase();
            } else if (analyticalOperations.length > index) {
              // Use analytical operation type if available
              stepType = analyticalOperations[index].toString().toLowerCase();
            }
            
            steps.push({
              id: `step-${index + 1}`,
              type: stepType,
              description: stepText.split('\n')[0], // First line as description
              order: index + 1,
              content: stepText
            });
          });
        }
      }
      
      // Parse insights
      const insights: string[] = [];
      if (insightsMatch && insightsMatch[1]) {
        const insightsText = insightsMatch[1].trim();
        const insightMatches = insightsText.match(/- ([\s\S]*?)(?=-|$)/g);
        
        if (insightMatches) {
          insightMatches.forEach((insight) => {
            insights.push(insight.replace(/^-\s+/, '').trim());
          });
        }
      }
      
      // Parse visualization with ChartProcessor integration
      let visualization: Visualization | null = null;
      if (visualizationMatch && visualizationMatch[1]) {
        const vizText = visualizationMatch[1].trim();
        
        // Parse chart type
        const chartTypeMatch = vizText.match(/Chart Type:\s*(\w+)/i);
        let chartType = chartTypeMatch ? chartTypeMatch[1].toLowerCase() : 'bar';
        
        // Use suggested visualization type if provided
        if (suggestedVisualizationType) {
          chartType = suggestedVisualizationType.toString().toLowerCase();
        }
        
        // Parse axes
        const xAxisMatch = vizText.match(/X-Axis:\s*(\w+)/i);
        const yAxisMatch = vizText.match(/Y-Axis:\s*(\w+)/i);
        
        // Parse data
        const dataMatch = vizText.match(/```json\s*([\s\S]*?)```/);
        
        if (dataMatch) {
          try {
            const rawData = JSON.parse(dataMatch[1].trim());
            
            // Use ChartProcessor to process the data
            const xKey = xAxisMatch ? xAxisMatch[1] : Object.keys(rawData[0])[0];
            const yKey = yAxisMatch ? yAxisMatch[1] : Object.keys(rawData[0])[1];
            
            // Define the chart configuration
            const chartConfig = {
              type: chartType,
              xKey,
              yKey,
              labels: {
                title: 'Analysis Visualization',
                xAxis: xKey,
                yAxis: yKey
              }
            };
            
            // Process the data with ChartProcessor
            const { data: processedData, config: processedConfig } = ChartProcessor.processForVisualization(
              rawData,
              chartConfig
            );
            
            visualization = {
              type: processedConfig.type || chartType,
              config: {
                data: processedData,
                xKey: processedConfig.xKey || xKey,
                yKey: processedConfig.yKey || yKey,
                labels: processedConfig.labels || {
                  title: 'Analysis Visualization',
                  xAxis: xKey,
                  yAxis: yKey
                }
              }
            };
            
            // Add visualization as a step as well
            steps.push({
              id: `step-visualization`,
              type: 'visualization',
              description: 'Data Visualization',
              order: steps.length + 1,
              visualization: visualization
            });
          } catch (e) {
            console.error("Error parsing visualization data:", e);
          }
        }
      }
      
      // Parse table data and add it as a step if present
      if (tableMatch && tableMatch[1]) {
        const tableText = tableMatch[1].trim();
        const tableDataMatch = tableText.match(/```json\s*([\s\S]*?)```/);
        
        if (tableDataMatch) {
          try {
            const tableData = JSON.parse(tableDataMatch[1].trim());
            steps.push({
              id: `step-table`,
              type: 'table',
              description: 'Data Table',
              order: steps.length + 1,
              data: tableData
            });
          } catch (e) {
            console.error("Error parsing table data:", e);
          }
        }
      }
      
      return {
        summary: summaryMatch ? summaryMatch[1].trim() : "",
        steps: steps,
        insights: insights,
        visualization: visualization
      };
    } catch (error) {
      console.error("Error parsing structured response:", error);
      return {
        summary: "",
        steps: [],
        insights: [],
        visualization: null
      };
    }
  }

  /**
   * Detects the type of data based on content
   * @param data The data to analyze
   * @returns The detected data type
   */
  public detectDataType(data: any): DataSourceType {
    if (!data) return DataSourceType.UNKNOWN;
    
    // Check if it's a string
    if (typeof data === 'string') {
      // Check for CSV-like content
      if (TableFormatter.parseCSVLikeContent(data)) {
        return DataSourceType.CSV;
      }
      
      // Check for JSON-like content
      try {
        JSON.parse(data);
        return DataSourceType.JSON;
      } catch {
        // Not JSON
      }
      
      // Check for PDF content markers
      if (data.includes('%PDF')) {
        return DataSourceType.PDF;
      }
      
      // Check for DOC content markers
      if (data.includes('Microsoft Word') || data.includes('DOCX')) {
        return DataSourceType.DOC;
      }
      
      // Default to text
      return DataSourceType.TEXT;
    }
    
    // If it's an array with objects, it's likely tabular data
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return DataSourceType.TABLE;
    }
    
    // If it's an object, check if it looks like Excel data
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      // Excel data often has sheet names as keys
      if (keys.some(k => k.includes('Sheet') || k.includes('Table'))) {
        return DataSourceType.EXCEL;
      }
      return DataSourceType.JSON;
    }
    
    return DataSourceType.UNKNOWN;
  }
} 