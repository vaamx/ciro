import { createServiceLogger } from '../utils/logger-factory';
import { OpenAIService } from './openai.service';
import { StatisticalAnalysisService } from './statistical-analysis.service';
import { VisualizationService } from './visualization.service';
import {
  ProcessingStage,
  DataSourceType,
  AnalyticalOperationType,
} from '../types/processing';
import { v4 as uuidv4 } from 'uuid';

// Define VisualizationType as a string enum instead of importing it
export enum VisualizationType {
  BAR = 'bar_chart',
  LINE = 'line_chart',
  PIE = 'pie_chart',
  SCATTER = 'scatter_plot',
  AREA = 'area_chart',
  TABLE = 'table',
  NONE = 'none'
}

// Update the StructuredAnalysisResponse interface to include all needed properties
export interface StructuredAnalysisResponse {
  summary: string;
  steps: AnalysisStep[];
  insights: string[];
  nextSteps?: string[];
  visualization?: {
    type: string;
    config: any;
  };
  content?: string;
}

// Update the AnalysisStep interface to include visualization
export interface AnalysisStep {
  id: string;
  type: string;
  description: string;
  content?: string;
  order: number;
  data?: any;
  visualization?: {
    type: string;
    config: any;
  };
}

// Define ProgressCallback type since we're no longer importing it
export type ProgressCallback = (stage: ProcessingStage, progress: number, message?: string) => void;

/**
 * Server-side implementation of UniversalDataProcessor
 * Handles advanced data processing, analysis, and visualization
 */
export class UniversalDataProcessorService {
  private openaiService: OpenAIService;
  private statisticalAnalysis: StatisticalAnalysisService;
  private visualizationService: VisualizationService;
  private progressCallback: ProgressCallback | null = null;
  private readonly logger = createServiceLogger('UniversalDataProcessor');
  
  private static instance: UniversalDataProcessorService | null = null;
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): UniversalDataProcessorService {
    if (!UniversalDataProcessorService.instance) {
      UniversalDataProcessorService.instance = new UniversalDataProcessorService();
    }
    return UniversalDataProcessorService.instance;
  }
  
  constructor() {
    this.openaiService = OpenAIService.getInstance();
    this.statisticalAnalysis = StatisticalAnalysisService.getInstance();
    this.visualizationService = VisualizationService.getInstance();
    this.logger.info('UniversalDataProcessor initialized');
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
    dataSourceType: DataSourceType = DataSourceType.UNKNOWN
  ): Promise<StructuredAnalysisResponse> {
    this.logger.info(`Processing query: "${query}" for data source type: ${dataSourceType}`);
    this.updateProgress(ProcessingStage.INITIALIZING, 0, 'Starting analysis');
    
    // Step 1: Detect data type if unknown
    if (dataSourceType === DataSourceType.UNKNOWN) {
      dataSourceType = this.detectDataType(data);
      this.logger.info(`Detected data type: ${dataSourceType}`);
    }
    
    // Step 2: Analyze query to determine operations
    this.updateProgress(ProcessingStage.ANALYZING_QUERY, 10, 'Analyzing query intent');
    const analyticalOperations = await this.determineAnalyticalOperations(query);
    this.logger.info(`Determined operations: ${analyticalOperations.join(', ')}`);
    
    // Step 3: Preprocess the data
    this.updateProgress(ProcessingStage.PREPROCESSING_DATA, 25, 'Preprocessing data');
    const processedData = this.preprocessData(data, dataSourceType);
    
    // Step 4: Determine visualization type
    const visualizationType = await this.determineVisualizationType(query, analyticalOperations);
    this.logger.info(`Suggested visualization: ${visualizationType}`);
    
    // Step 5: Enhance data with statistical analysis if appropriate
    this.updateProgress(ProcessingStage.ENHANCING_DATA, 40, 'Applying statistical analysis');
    const enhancedData = await this.enhanceDataWithStatistics(processedData, analyticalOperations);
    
    // Step 6: Generate the LLM response
    this.updateProgress(ProcessingStage.GENERATING_RESPONSE, 60, 'Generating analysis');
    const systemPrompt = this.createSystemPrompt(dataSourceType, analyticalOperations);
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Query: ${query}\n\nData:\n${enhancedData}` }
    ];
    
    const completion = await this.openaiService.generateChatCompletion(messages, {
      model: 'gpt-4o',
      temperature: 0.2 // Lower temperature for analytical content
    });
    
    // Extract content from completion
    let content = '';
    if (completion && 'choices' in completion && completion.choices && completion.choices.length > 0) {
      content = completion.choices[0].message.content || '';
    }
    
    // Step 7: Parse the structured response
    this.updateProgress(ProcessingStage.PARSING_RESPONSE, 80, 'Parsing response');
    const structuredResponse = this.parseStructuredResponse(content, analyticalOperations, visualizationType);
    
    // Step 8: Create visualization if needed
    if (visualizationType !== VisualizationType.NONE) {
      this.updateProgress(ProcessingStage.PREPARING_VISUALIZATION, 90, 'Creating visualization');
      
      // Extract data for visualization from the response
      const visualizationData = this.extractDataForVisualization(structuredResponse, data);
      
      // Generate the visualization config
      structuredResponse.visualization = {
        type: visualizationType,
        config: this.visualizationService.createVisualization(
          visualizationType as any,
          visualizationData,
          `${query} Visualization`,
          { responsive: true }
        )
      };
    }
    
    // Complete
    this.updateProgress(ProcessingStage.COMPLETED, 100, 'Analysis complete');
    return structuredResponse;
  }
  
  /**
   * Create a system prompt for the LLM
   * @param dataSourceType The type of data source
   * @param analyticalOperations The analytical operations to perform
   * @returns A formatted system prompt
   */
  private createSystemPrompt(dataSourceType: DataSourceType, analyticalOperations: AnalyticalOperationType[] = []): string {
    const basePrompt = `You are an expert data analyst specializing in ${dataSourceType} data analysis.
Your task is to provide a detailed, step-by-step analysis of the data provided, focusing on answering the user's query.

Follow these guidelines:
1. Provide a structured analysis with clearly defined steps.
2. Begin with understanding what the query is asking for.
3. Identify the relevant data points needed to answer the query.
4. Perform necessary calculations and analysis.
5. Summarize your findings with clear, actionable insights.
6. Be specific and precise with numbers and statistics.
7. Format your response in a structured JSON format when possible.
8. Include recommendations for data visualization when appropriate.`;

    // Add operation-specific instructions
    const operationInstructions: string[] = [];
    
    if (analyticalOperations.includes(AnalyticalOperationType.SUMMARIZE)) {
      operationInstructions.push('- Provide a concise summary of the key points and trends in the data.');
    }
    
    if (analyticalOperations.includes(AnalyticalOperationType.COUNT)) {
      operationInstructions.push('- Count relevant items or occurrences based on the query.');
    }
    
    if (analyticalOperations.includes(AnalyticalOperationType.AVERAGE) || 
        analyticalOperations.includes(AnalyticalOperationType.MIN) || 
        analyticalOperations.includes(AnalyticalOperationType.MAX)) {
      operationInstructions.push('- Calculate relevant statistical measures (average, min, max) as needed.');
    }
    
    if (analyticalOperations.includes(AnalyticalOperationType.TREND)) {
      operationInstructions.push('- Identify and describe trends or patterns in the data.');
    }
    
    if (analyticalOperations.includes(AnalyticalOperationType.COMPARE)) {
      operationInstructions.push('- Compare different categories or time periods in the data.');
    }
    
    if (analyticalOperations.includes(AnalyticalOperationType.SEGMENT)) {
      operationInstructions.push('- Segment or group the data in meaningful ways to reveal insights.');
    }
    
    // Add formatting instructions
    const formattingInstructions = `
Format your response following this structure:
\`\`\`json
{
  "summary": "A brief 1-2 sentence summary of your findings",
  "steps": [
    {
      "id": "step1",
      "description": "Understand what's being asked",
      "content": "Explanation of what the query is asking for"
    },
    {
      "id": "step2",
      "description": "Identify relevant data",
      "content": "Description of the data points needed"
    },
    {
      "id": "step3",
      "description": "Perform analysis",
      "content": "Details of the calculations and analysis performed"
    },
    {
      "id": "step4",
      "description": "Formulate conclusion",
      "content": "The final answer with supporting evidence"
    }
  ],
  "insights": [
    "Key insight 1",
    "Key insight 2",
    "Key insight 3"
  ],
  "visualization": {
    "suggestion": "Recommended visualization type",
    "description": "How this visualization would help"
  }
}
\`\`\`

Ensure your response is directly relevant to the user's query and provides valuable, data-driven insights.`;

    // Combine all parts
    return [
      basePrompt,
      operationInstructions.length > 0 ? '\nSpecific analytical operations to perform:' : '',
      ...operationInstructions,
      formattingInstructions
    ].join('\n');
  }
  
  /**
   * Preprocess data for analysis
   * @param data The raw data
   * @param dataSourceType The type of data source
   * @returns Processed data as a string
   */
  private preprocessData(data: any, dataSourceType: DataSourceType): string {
    try {
      // Convert data to appropriate format based on type
      if (typeof data === 'string') {
        return data; // Already a string
      }
      
      if (Array.isArray(data)) {
        if (dataSourceType === DataSourceType.TABLE || 
            dataSourceType === DataSourceType.CSV || 
            dataSourceType === DataSourceType.EXCEL) {
          // Format as a table
          if (data.length > 0 && typeof data[0] === 'object') {
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => 
              Object.values(row).map(val => 
                typeof val === 'string' ? `"${val}"` : val
              ).join(',')
            ).join('\n');
            return `${headers}\n${rows}`;
          }
        }
        
        // Default array formatting
        return JSON.stringify(data, null, 2);
      }
      
      if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data, null, 2);
      }
      
      return String(data);
    } catch (error) {
      this.logger.error('Error preprocessing data:', error);
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
  }
  
  /**
   * Determine if statistical analysis can be applied to the data
   * @param data The data to analyze
   * @returns Whether statistical analysis can be applied
   */
  private canApplyStatistics(data: any): boolean {
    if (Array.isArray(data) && data.length > 5) {
      // Check if the data has numeric fields
      if (data[0] && typeof data[0] === 'object') {
        const sample = data[0];
        return Object.values(sample).some(val => typeof val === 'number');
      }
    }
    return false;
  }
  
  /**
   * Enhance data with statistical analysis
   * @param data The processed data
   * @param operations The analytical operations to perform
   * @returns Enhanced data with statistical insights
   */
  private async enhanceDataWithStatistics(
    data: string, 
    operations: AnalyticalOperationType[]
  ): Promise<string> {
    try {
      // Skip if no statistical operations or data isn't in a format we can enhance
      if (!operations.some(op => [
        AnalyticalOperationType.AVERAGE,
        AnalyticalOperationType.MIN,
        AnalyticalOperationType.MAX,
        AnalyticalOperationType.SUM,
        AnalyticalOperationType.TREND,
        AnalyticalOperationType.FORECAST,
        AnalyticalOperationType.CORRELATE
      ].includes(op))) {
        return data;
      }
      
      // Try to parse the data
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        // If not valid JSON, try to parse as CSV
        if (data.includes(',') && data.includes('\n')) {
          const lines = data.trim().split('\n');
          const headers = lines[0].split(',');
          
          parsedData = lines.slice(1).map(line => {
            const values = line.split(',');
            const row: Record<string, any> = {};
            
            headers.forEach((header, index) => {
              let value = values[index]?.trim() || '';
              
              // Convert to number if possible
              if (/^-?\d+(\.\d+)?$/.test(value)) {
                row[header] = parseFloat(value);
              } else {
                row[header] = value.replace(/^"|"$/g, ''); // Remove quotes
              }
            });
            
            return row;
          });
        } else {
          return data; // Return original if can't parse
        }
      }
      
      if (!this.canApplyStatistics(parsedData)) {
        return data;
      }
      
      // Apply statistical enhancements
      let enhancedData = data;
      
      try {
        // Extract numeric data for statistical analysis
        const numericData = this.extractNumericDataFromText(parsedData);
        
        if (numericData.length > 0) {
          // Use calculateBasicStats instead of analyzeData which doesn't exist
          const stats = {
            basicStats: this.statisticalAnalysis.calculateBasicStats(numericData)
          };
          
          // Add statistical insights at the end of the data
          enhancedData += `\n\n--- Statistical Analysis ---\n`;
          enhancedData += `Basic Statistics:\n${JSON.stringify(stats.basicStats, null, 2)}\n\n`;
          
          // Only include operations that we can actually perform with the available methods
          if (operations.includes(AnalyticalOperationType.TREND)) {
            enhancedData += `Trend Analysis: Not available in this version\n\n`;
          }
          
          if (operations.includes(AnalyticalOperationType.COMPARE)) {
            enhancedData += `Comparative Analysis: Not available in this version\n\n`;
          }
          
          if (operations.includes(AnalyticalOperationType.FORECAST)) {
            enhancedData += `Forecasting: Not available in this version\n\n`;
          }
        } else {
          enhancedData += `\n\nNo numeric data found to perform statistical analysis.\n`;
        }
      } catch (error) {
        this.logger.error(`Error performing statistical analysis: ${error.message}`);
        enhancedData += `\n\nUnable to perform statistical analysis due to an error.\n`;
      }
      
      return enhancedData;
    } catch (error) {
      this.logger.error('Error enhancing data with statistics:', error);
      return data; // Return original data if enhancement fails
    }
  }
  
  /**
   * Extract numeric data from text content for statistical analysis
   * @param text The text content to extract numeric data from
   * @returns Array of numeric values extracted from the text
   */
  private extractNumericDataFromText(text: string): number[] {
    const numericValues: number[] = [];
    
    // Match numbers in the text (including decimals and negative numbers)
    const numberRegex = /-?\d+(\.\d+)?/g;
    const matches = text.match(numberRegex);
    
    if (matches) {
      // Convert matches to numbers and add to the array
      matches.forEach(match => {
        const num = parseFloat(match);
        if (!isNaN(num)) {
          numericValues.push(num);
        }
      });
    }
    
    return numericValues;
  }
  
  /**
   * Parse the LLM response into a structured format
   * @param content The raw response content
   * @param analyticalOperations The operations performed
   * @param suggestedVisualizationType Suggested visualization type
   * @returns Structured analysis response
   */
  private parseStructuredResponse(
    content: string, 
    analyticalOperations: AnalyticalOperationType[] = [],
    suggestedVisualizationType?: VisualizationType
  ): StructuredAnalysisResponse {
    // Use content in the method but don't add it to the response object
    const response: StructuredAnalysisResponse = {
      steps: [],
      insights: [],
      summary: '',
    };
    
    try {
      // Check if the response includes structured steps or insights
      const summaryMatch = content.match(/##?\s*Summary\s*\n([\s\S]*?)(?=##?\s|$)/i);
      if (summaryMatch && summaryMatch[1]) {
        response.summary = summaryMatch[1].trim();
      }
      
      // Extract steps with improved regex to better capture multi-line content
      const stepsMatch = content.match(/##?\s*Steps\s*\n([\s\S]*?)(?=##?\s|$)/i);
      if (stepsMatch && stepsMatch[1]) {
        const stepsContent = stepsMatch[1].trim();
        
        // Match numbered steps with descriptions
        const stepRegex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*:?\s*([\s\S]*?)(?=\n\s*\d+\.\s*\*\*|$)/g;
        let stepMatch;
        
        // Extract and properly format each analytical step
        while ((stepMatch = stepRegex.exec(stepsContent)) !== null) {
          const stepNumber = parseInt(stepMatch[1], 10);
          const stepType = this.determineStepType(stepMatch[2].trim());
          const stepDescription = stepMatch[2].trim();
          let stepContent = stepMatch[3].trim();
          
          // Try to extract tables from step content
          const tableMatches = this.extractTablesFromMarkdown(stepContent);
          let stepData = null;
          
          if (tableMatches.length > 0) {
            // If tables found, convert the first one to structured data
            try {
              stepData = this.convertMarkdownTableToData(tableMatches[0]);
            } catch (e) {
              this.logger.warn(`Failed to parse table in step ${stepNumber}:`, e);
            }
          }
          
          // Create the step with extracted data
          const step: AnalysisStep = {
            id: `step-${stepNumber}`,
            type: stepType,
            description: stepDescription,
            content: stepContent,
            order: stepNumber,
            data: stepData
          };
          
          // Add visualization if applicable
          if (stepType === 'chart' || stepType === 'visualization') {
            // Try to extract visualization data
            const vizType = this.extractVisualizationType(stepContent) || 
                           (suggestedVisualizationType !== 'none' ? suggestedVisualizationType : 'bar_chart');
            
            // Generate visualization config
            step.visualization = {
              type: vizType,
              config: this.generateVisualizationConfig(stepData, vizType, stepDescription)
            };
          }
          
          response.steps.push(step);
        }
      }
      
      // Extract insights with improved regex to better capture multi-line content
      const insightsMatch = content.match(/##?\s*Insights\s*\n([\s\S]*?)(?=##?\s|$)/i);
      if (insightsMatch && insightsMatch[1]) {
        const insightsContent = insightsMatch[1].trim();
        
        // Match bullet points that may span multiple lines
        const insightRegex = /-\s*([\s\S]*?)(?=\n\s*-\s*|$)/g;
        let insightMatch;
        
        while ((insightMatch = insightRegex.exec(insightsContent)) !== null) {
          if (insightMatch[1] && insightMatch[1].trim()) {
            response.insights.push(insightMatch[1].trim());
          }
        }
      }
      
      // Try to extract visualization type if not already provided
      if (!response.visualization && suggestedVisualizationType !== VisualizationType.NONE) {
        const visualizationMatch = content.match(/##?\s*Visualization\s*\n([\s\S]*?)(?=##?\s|$)/i);
        if (visualizationMatch && visualizationMatch[1]) {
          const vizContent = visualizationMatch[1].trim();
          const chartTypeMatch = vizContent.match(/Chart\s*Type:\s*(\w+)/i);
          const chartType = chartTypeMatch ? chartTypeMatch[1].toLowerCase() : 'bar_chart';
          
          // Extract data for visualization
          let vizData = null;
          const jsonMatch = vizContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              vizData = JSON.parse(jsonMatch[1]);
            } catch (e) {
              this.logger.warn('Failed to parse visualization data:', e);
            }
          }
          
          // Extract axis information
          const xAxisMatch = vizContent.match(/X-Axis:\s*([^\n]+)/);
          const yAxisMatch = vizContent.match(/Y-Axis:\s*([^\n]+)/);
          
          // Create visualization config
          if (vizData) {
            const vizType = this.mapChartTypeToVisualization(chartType);
            response.visualization = {
              type: vizType,
              config: {
                data: vizData,
                xKey: xAxisMatch ? xAxisMatch[1].trim() : Object.keys(vizData[0])[0],
                yKey: yAxisMatch ? yAxisMatch[1].trim() : Object.keys(vizData[0])[1],
                labels: {
                  title: `Visualization`,
                  xAxis: xAxisMatch ? xAxisMatch[1].trim() : '',
                  yAxis: yAxisMatch ? yAxisMatch[1].trim() : ''
                }
              }
            };
          }
        }
      }
      
      // Extract next steps suggestions
      const nextStepsMatch = content.match(/##?\s*Next Steps\s*\n([\s\S]*?)(?=##?\s|$)/i);
      if (nextStepsMatch && nextStepsMatch[1]) {
        const nextStepsContent = nextStepsMatch[1].trim();
        
        // Match bullet points
        const nextStepRegex = /-\s*([\s\S]*?)(?=\n\s*-\s*|$)/g;
        let nextStepMatch;
        
        response.nextSteps = [];
        while ((nextStepMatch = nextStepRegex.exec(nextStepsContent)) !== null) {
          if (nextStepMatch[1] && nextStepMatch[1].trim()) {
            response.nextSteps.push(nextStepMatch[1].trim());
          }
        }
      }
      
      // Ensure nextSteps property is recognized
      response.nextSteps = response.nextSteps || [];
      
      return response;
    } catch (error) {
      this.logger.error('Error parsing structured response:', error);
      // Fall back to unstructured parsing
      return this.parseNaturalLanguageResponse(content, suggestedVisualizationType);
    }
  }
  
  /**
   * Extract tables from markdown content
   */
  private extractTablesFromMarkdown(content: string): string[] {
    const result: string[] = [];
    
    // Match markdown tables (both with and without headers)
    const tableRegex = /(\|[^\n]+\|\n\|[-:| ]+\|\n(?:\|[^\n]+\|\n)+)/g;
    let match;
    
    while ((match = tableRegex.exec(content)) !== null) {
      result.push(match[1]);
    }
    
    return result;
  }
  
  /**
   * Convert a markdown table to structured data
   */
  private convertMarkdownTableToData(markdownTable: string): any[] {
    const lines = markdownTable.trim().split('\n');
    
    if (lines.length < 3) {
      throw new Error('Invalid markdown table format');
    }
    
    // Parse header row
    const headerRow = lines[0];
    const headers = headerRow
      .split('|')
      .filter(cell => cell.trim().length > 0)
      .map(cell => cell.trim());
    
    // Skip separator row and parse data rows
    const result: any[] = [];
    
    for (let i = 2; i < lines.length; i++) {
      const dataRow = lines[i];
      const cells = dataRow
        .split('|')
        .filter(cell => cell.trim().length > 0)
        .map(cell => cell.trim());
      
      if (cells.length === headers.length) {
        const rowData: any = {};
        
        for (let j = 0; j < headers.length; j++) {
          // Try to convert numeric values
          const value = cells[j];
          const numericValue = parseFloat(value);
          
          rowData[headers[j]] = !isNaN(numericValue) ? numericValue : value;
        }
        
        result.push(rowData);
      }
    }
    
    return result;
  }
  
  /**
   * Map chart type string to visualization type
   */
  private mapChartTypeToVisualization(chartType: string): string {
    const typeMap: Record<string, string> = {
      'bar': 'bar_chart',
      'bar_chart': 'bar_chart',
      'line': 'line_chart',
      'line_chart': 'line_chart',
      'pie': 'pie_chart',
      'pie_chart': 'pie_chart',
      'scatter': 'scatter_plot',
      'scatter_plot': 'scatter_plot',
      'area': 'area_chart',
      'area_chart': 'area_chart',
      'table': 'table'
    };
    
    return typeMap[chartType.toLowerCase()] || 'bar_chart';
  }
  
  /**
   * Determine step type based on step description
   */
  private determineStepType(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('filter') || lowerDesc.includes('exclude')) {
      return 'filter';
    } else if (lowerDesc.includes('sort') || lowerDesc.includes('order')) {
      return 'sort';
    } else if (lowerDesc.includes('group') || lowerDesc.includes('categorize')) {
      return 'group';
    } else if (lowerDesc.includes('aggregate') || lowerDesc.includes('sum') || lowerDesc.includes('count')) {
      return 'aggregate';
    } else if (lowerDesc.includes('visual') || lowerDesc.includes('chart') || lowerDesc.includes('plot')) {
      return 'visualization';
    } else if (lowerDesc.includes('insight') || lowerDesc.includes('finding')) {
      return 'insight';
    } else if (lowerDesc.includes('table') || lowerDesc.includes('data')) {
      return 'table';
    } else if (lowerDesc.includes('compare') || lowerDesc.includes('contrast')) {
      return 'compare';
    } else {
      return 'analysis';
    }
  }
  
  /**
   * Parse a natural language response into a structured format
   * @param content The response content
   * @param suggestedVisualizationType Suggested visualization type
   * @returns Structured analysis response
   */
  private parseNaturalLanguageResponse(
    content: string,
    suggestedVisualizationType?: VisualizationType
  ): StructuredAnalysisResponse {
    try {
      // Extract summary (first paragraph)
      const paragraphs = content.split('\n\n');
      const summary = paragraphs[0] || "Analysis complete.";
      
      // Extract steps based on numbered lists or headers
      const stepPattern = /(?:^|\n)(?:\d+\.|\*|Step \d+:|#+\s*Step \d+:)\s*(.*?)(?=(?:\n(?:\d+\.|\*|Step \d+:|#+\s*Step \d+:)|\n\n|$))/gs;
      const steps: AnalysisStep[] = [];
      
      let match;
      let stepIndex = 0;
      while ((match = stepPattern.exec(content)) !== null) {
        stepIndex++;
        const stepContent = match[0].trim();
        const stepTitle = stepContent.match(/(?:\d+\.|\*|Step \d+:|#+\s*Step \d+:)\s*(.*?)(?=\n|$)/)?.[1]?.trim() || 
                        `Step ${stepIndex}`;
        
        steps.push({
          id: `step${stepIndex}`,
          type: 'analysis',
          description: stepTitle,
          content: stepContent,
          order: stepIndex
        });
      }
      
      // If no steps were found, generate some based on the content
      if (steps.length === 0) {
        const contentChunks = paragraphs.slice(1); // Skip summary
        
        // Create at least 2 steps
        if (contentChunks.length > 0) {
          const midpoint = Math.floor(contentChunks.length / 2);
          
          steps.push({
            id: 'step1',
            type: 'analysis',
            description: 'Understanding the data',
            content: contentChunks.slice(0, midpoint).join('\n\n'),
            order: 1
          });
          
          steps.push({
            id: 'step2',
            type: 'analysis',
            description: 'Analysis and findings',
            content: contentChunks.slice(midpoint).join('\n\n'),
            order: 2
          });
        } else {
          steps.push({
            id: 'step1',
            type: 'analysis',
            description: 'Analysis',
            content: content,
            order: 1
          });
        }
      }
      
      // Extract insights
      const insights: string[] = [];
      
      // Look for insight sections or bullet points
      const insightSectionMatch = content.match(/(?:insights|findings|key points|conclusions):\s*([\s\S]*?)(?=\n\n|$)/i);
      
      if (insightSectionMatch) {
        const insightSection = insightSectionMatch[1];
        const bulletPoints = insightSection.match(/(?:^|\n)(?:-|\*|\d+\.)\s*(.*?)(?=(?:\n(?:-|\*|\d+\.)|\n\n|$))/gi);
        
        if (bulletPoints) {
          bulletPoints.forEach(point => {
            const cleaned = point.replace(/(?:^|\n)(?:-|\*|\d+\.)\s*/, '').trim();
            if (cleaned) {
              insights.push(cleaned);
            }
          });
        }
      }
      
      // If no insights found, generate some from the content
      if (insights.length === 0) {
        // Split content into sentences
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
        
        // Look for sentences that might be insights
        const insightCandidates = sentences.filter(sentence => 
          /(?:find|found|show|indicate|suggest|reveal|highlight|conclude|determine)/i.test(sentence)
        );
        
        // Add up to 3 insights
        for (let i = 0; i < Math.min(insightCandidates.length, 3); i++) {
          insights.push(insightCandidates[i].trim());
        }
      }
      
      return {
        summary,
        steps,
        insights,
        visualization: suggestedVisualizationType ? {
          type: suggestedVisualizationType,
          config: {}
        } : undefined
      };
    } catch (error) {
      this.logger.error('Error parsing natural language response:', error);
      
      // Default response
      return {
        summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        steps: [
          {
            id: 'step1',
            type: 'analysis',
            description: 'Analysis',
            content: content,
            order: 1
          }
        ],
        insights: []
      };
    }
  }
  
  /**
   * Extract data for visualization from a structured response
   * @param response The structured response
   * @param originalData The original data
   * @returns Data formatted for visualization
   */
  private extractDataForVisualization(response: StructuredAnalysisResponse, originalData: any): any[] {
    // First check if any step contains data
    for (const step of response.steps) {
      if (step.data && Array.isArray(step.data)) {
        return step.data;
      }
    }
    
    // If no data in steps, use the original data if it's an array
    if (Array.isArray(originalData)) {
      return originalData;
    }
    
    // If original data is not an array, try to parse it
    if (typeof originalData === 'string') {
      try {
        const parsed = JSON.parse(originalData);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Not valid JSON, try CSV parsing if applicable
        if (originalData.includes(',') && originalData.includes('\n')) {
          const lines = originalData.trim().split('\n');
          const headers = lines[0].split(',');
          
          return lines.slice(1).map(line => {
            const values = line.split(',');
            const row: Record<string, any> = {};
            
            headers.forEach((header, index) => {
              let value = values[index]?.trim() || '';
              
              // Convert to number if possible
              if (/^-?\d+(\.\d+)?$/.test(value)) {
                row[header] = parseFloat(value);
              } else {
                row[header] = value.replace(/^"|"$/g, ''); // Remove quotes
              }
            });
            
            return row;
          });
        }
      }
    }
    
    // Generate sample data if needed
    return [
      { label: 'Category A', value: 30 },
      { label: 'Category B', value: 45 },
      { label: 'Category C', value: 25 }
    ];
  }
  
  /**
   * Detect the type of data
   * @param data The data to analyze
   * @returns The detected data source type
   */
  public detectDataType(data: any): DataSourceType {
    if (typeof data === 'string') {
      // Check for CSV
      if (data.includes(',') && data.split('\n').length > 1) {
        return DataSourceType.CSV;
      }
      
      // Check for JSON
      if ((data.startsWith('{') && data.endsWith('}')) || 
          (data.startsWith('[') && data.endsWith(']'))) {
        try {
          JSON.parse(data);
          return DataSourceType.JSON;
        } catch {
          // Not valid JSON
        }
      }
      
      return DataSourceType.TEXT;
    }
    
    if (Array.isArray(data)) {
      // Check if it's tabular data
      if (data.length > 0 && typeof data[0] === 'object') {
        return DataSourceType.TABLE;
      }
      return DataSourceType.JSON;
    }
    
    if (typeof data === 'object' && data !== null) {
      return DataSourceType.JSON;
    }
    
    return DataSourceType.UNKNOWN;
  }
  
  /**
   * Determine the analytical operations to perform based on the query
   * @param query The user's query
   * @returns Array of analytical operations
   */
  public async determineAnalyticalOperations(query: string): Promise<AnalyticalOperationType[]> {
    const lowerQuery = query.toLowerCase();
    const operations: AnalyticalOperationType[] = [];
    
    // Check for operation keywords
    if (/summar(y|ize)/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.SUMMARIZE);
    }
    
    if (/count|how many|number of/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.COUNT);
    }
    
    if (/average|mean|typical/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.AVERAGE);
    }
    
    if (/minimum|lowest|smallest/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.MIN);
    }
    
    if (/maximum|highest|largest/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.MAX);
    }
    
    if (/sum|total|add up/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.SUM);
    }
    
    if (/trend|over time|pattern/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.TREND);
    }
    
    if (/forecast|predict|future/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.FORECAST);
    }
    
    if (/compare|difference|versus|vs\.|against/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.COMPARE);
    }
    
    if (/correlat(e|ion)|relationship|between/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.CORRELATE);
    }
    
    if (/segment|group|categorize|by/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.SEGMENT);
    }
    
    if (/rank|top|bottom|best|worst/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.RANK);
    }
    
    if (/categor(y|ies|ize)|classify/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.CATEGORIZE);
    }
    
    if (/anomal(y|ies)|outlier|unusual/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.ANOMALY_DETECTION);
    }
    
    // Use LLM if we don't detect any operations or for complex queries
    if (operations.length === 0 || query.length > 50) {
      const sysPrompt = `You are an analytical operations classifier. 
Determine which analytical operations are needed to answer the following query.
Choose from these operations: ${Object.values(AnalyticalOperationType).join(', ')}
Return ONLY the operation names separated by commas, nothing else.`;
      
      try {
        const messages = [
          { role: 'system' as const, content: sysPrompt },
          { role: 'user' as const, content: query }
        ];
        
        const result = await this.openaiService.generateChatCompletion(messages, {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 100
        });
        
        if (result && 'choices' in result && result.choices && result.choices.length > 0) {
          const content = result.choices[0].message.content || '';
          const llmOperations = content.split(/,\s*/).map(op => op.trim().toLowerCase());
          
          for (const op of llmOperations) {
            const matchedOp = Object.values(AnalyticalOperationType).find(
              validOp => validOp.toLowerCase() === op
            );
            
            if (matchedOp && !operations.includes(matchedOp as AnalyticalOperationType)) {
              operations.push(matchedOp as AnalyticalOperationType);
            }
          }
        }
      } catch (error) {
        this.logger.error('Error determining operations with LLM:', error);
      }
    }
    
    // Ensure we have at least one operation
    if (operations.length === 0) {
      operations.push(AnalyticalOperationType.SUMMARIZE);
    }
    
    return operations;
  }
  
  /**
   * Determine the visualization type based on query and operations
   * @param query The user's query
   * @param operations The analytical operations
   * @returns The suggested visualization type
   */
  public async determineVisualizationType(
    query: string,
    operations: AnalyticalOperationType[]
  ): Promise<VisualizationType> {
    const lowerQuery = query.toLowerCase();
    
    // Check for explicit visualization requests
    if (/bar (?:chart|graph)/i.test(lowerQuery)) {
      return VisualizationType.BAR;
    }
    
    if (/line (?:chart|graph)/i.test(lowerQuery)) {
      return VisualizationType.LINE;
    }
    
    if (/pie (?:chart|graph)/i.test(lowerQuery)) {
      return VisualizationType.PIE;
    }
    
    
    if (/scatter (?:plot|chart|graph)/i.test(lowerQuery)) {
      return VisualizationType.SCATTER;
    }
    
    if (/area (?:chart|graph)/i.test(lowerQuery)) {
      return VisualizationType.AREA;
    }
    
    if (/heat ?map/i.test(lowerQuery)) {
      return VisualizationType.NONE;
    }
    
    if (/table|list/i.test(lowerQuery)) {
      return VisualizationType.TABLE;
    }
    
    // Infer from operations
    if (operations.includes(AnalyticalOperationType.TREND) || 
        operations.includes(AnalyticalOperationType.FORECAST)) {
      return VisualizationType.LINE;
    }
    
    if (operations.includes(AnalyticalOperationType.COMPARE)) {
      return VisualizationType.BAR;
    }
    
    if (operations.includes(AnalyticalOperationType.CORRELATE)) {
      return VisualizationType.SCATTER;
    }
    
    if (operations.includes(AnalyticalOperationType.SEGMENT) && operations.length === 1) {
      return VisualizationType.PIE;
    }
    
    // Use LLM for more complex determination
    const sysPrompt = `You are a data visualization expert. 
Based on the query, determine the most appropriate visualization type.
Choose from these types: ${Object.values(VisualizationType).join(', ')}
Return ONLY the visualization type name, nothing else.`;
    
    try {
      const operationsText = operations.join(', ');
      const messages = [
        { role: 'system' as const, content: sysPrompt },
        { role: 'user' as const, content: `Query: ${query}\nOperations: ${operationsText}` }
      ];
      
      const result = await this.openaiService.generateChatCompletion(messages, {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 20
      });
      
      if (result && 'choices' in result && result.choices && result.choices.length > 0) {
        const content = result.choices[0].message.content || '';
        const normalized = content.trim().toLowerCase().replace(/\s+/g, '_');
        
        for (const type of Object.values(VisualizationType)) {
          if (type.toLowerCase() === normalized) {
            return type as VisualizationType;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error determining visualization type with LLM:', error);
    }
    
    // Default based on common operations
    if (operations.includes(AnalyticalOperationType.COUNT) || 
        operations.includes(AnalyticalOperationType.SUM)) {
      return VisualizationType.BAR;
    }
    
    return VisualizationType.NONE;
  }

  /**
   * Extracts visualization type from step content
   */
  private extractVisualizationType(content: string): string | null {
    if (!content) return null;
    
    // Look for explicit visualization type mentions
    const vizTypePatterns = [
      { pattern: /bar\s+chart|bar\s+graph|column\s+chart/i, type: VisualizationType.BAR },
      { pattern: /line\s+chart|line\s+graph|trend\s+line/i, type: VisualizationType.LINE },
      { pattern: /pie\s+chart|donut\s+chart|circle\s+chart/i, type: VisualizationType.PIE },
      { pattern: /scatter\s+plot|scatter\s+chart|scatter\s+graph/i, type: VisualizationType.SCATTER },
      { pattern: /area\s+chart|area\s+graph|stacked\s+area/i, type: VisualizationType.AREA },
      { pattern: /table|tabular/i, type: VisualizationType.TABLE }
    ];
    
    for (const { pattern, type } of vizTypePatterns) {
      if (pattern.test(content)) {
        return type;
      }
    }
    
    return null;
  }

  /**
   * Generates visualization configuration based on data and type
   */
  private generateVisualizationConfig(data: any, type: string, title: string): any {
    if (!data) {
      return { 
        data: [],
        xKey: '',
        yKey: ''
      };
    }
    
    // Process array data
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      const keys = Object.keys(firstItem);
      
      // Find numeric columns for y-axis
      const numericKeys = keys.filter(key => 
        typeof firstItem[key] === 'number' || 
        !isNaN(parseFloat(firstItem[key]))
      );
      
      // Find string columns for x-axis
      const categoryKeys = keys.filter(key => 
        typeof firstItem[key] === 'string' && 
        !numericKeys.includes(key)
      );
      
      const xKey = categoryKeys.length > 0 ? categoryKeys[0] : keys[0];
      const yKey = numericKeys.length > 0 ? numericKeys[0] : (keys.length > 1 ? keys[1] : keys[0]);
      
      return {
        data,
        xKey,
        yKey,
        labels: {
          title: title || 'Data Visualization',
          xAxis: xKey,
          yAxis: yKey
        }
      };
    }
    
    // Default configuration for empty data
    return {
      data: [],
      xKey: '',
      yKey: ''
    };
  }
} 