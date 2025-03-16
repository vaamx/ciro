import { OpenAIService } from '../openai/OpenAIService';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { StructuredAnalysisResponse, AnalysisStep, Visualization } from "../../types/ExcelTypes";
import { PromptTemplates } from './PromptTemplates';
import { DataSourceType } from '../processors/UniversalDataProcessor';

/**
 * UniversalDataHandler - A specialized handler for all data source types
 * that provides structured responses using the Universal Structured Response approach.
 */
export class UniversalDataHandler {
  private openaiService: OpenAIService;
  private promptTemplates: PromptTemplates;

  constructor() {
    this.openaiService = new OpenAIService();
    this.promptTemplates = new PromptTemplates();
  }

  /**
   * Process a data query with reliable, structured results
   * @param query The user's query
   * @param data The data in JSON or other format
   * @param dataSourceType The type of data source being analyzed
   * @returns A formatted response with accurate data analysis
   */
  public async processDataQuery(
    query: string, 
    data: any, 
    dataSourceType: DataSourceType = DataSourceType.UNKNOWN
  ): Promise<any> {
    console.log(`Processing ${dataSourceType} query directly: "${query}"`);
    
    // Create a structured analytical prompt based on the data source type
    const systemMessage = this.promptTemplates.getUniversalStructuredResponsePrompt(dataSourceType);

    try {
      // Format the data appropriately based on its type
      const formattedData = this.formatDataForPrompt(data, dataSourceType);
      
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `Here is my ${dataSourceType} data:\n${formattedData}\n\nMy question is: ${query}` }
      ];

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
      
      // Parse structured content into visualization-friendly format
      const structuredResponse = this.parseStructuredResponse(content);
      
      // Return both the raw content and the parsed structured response
      return {
        content,
        structuredResponse,
        metadata: {
          isAnalytical: true,
          hasStructuredResponse: true,
          dataSourceType
        }
      };
    } catch (error: any) {
      console.error(`Error in processDataQuery for ${dataSourceType}:`, error);
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
   * Format data appropriately based on its type
   */
  private formatDataForPrompt(data: any, dataSourceType: DataSourceType): string {
    switch (dataSourceType) {
      case DataSourceType.EXCEL:
        // Special handling for Excel data
        if (typeof data === 'string') {
          try {
            // Try to parse the data if it's a JSON string
            const parsedData = JSON.parse(data);
            // Format Excel data in a table-like structure for better AI comprehension
            if (Array.isArray(parsedData)) {
              return this.formatArrayAsTable(parsedData);
            }
            return JSON.stringify(parsedData, null, 2);
          } catch (e) {
            // If not valid JSON, return as is
            return data;
          }
        }
        // If it's already an object/array, format appropriately
        if (Array.isArray(data)) {
          return this.formatArrayAsTable(data);
        }
        return JSON.stringify(data, null, 2);
        
      case DataSourceType.JSON:
      case DataSourceType.TABLE:
        // For structured data, stringify as JSON
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        
      case DataSourceType.CSV:
        // For CSV, keep as a string or format as table
        return typeof data === 'string' ? data : 
               (Array.isArray(data) ? this.formatArrayAsTable(data) : JSON.stringify(data, null, 2));
        
      case DataSourceType.PDF:
      case DataSourceType.DOC:
      case DataSourceType.TEXT:
        // For text-based documents, keep as a string
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        
      default:
        // Default to JSON stringification
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format an array of data (likely from Excel) as a readable ASCII table
   * @param data Array of objects to format as a table
   * @returns Formatted string representation of the table
   */
  private formatArrayAsTable(data: any[]): string {
    if (!data || data.length === 0) {
      return "Empty table";
    }

    // Extract all unique keys from all objects
    const allKeys = new Set<string>();
    data.forEach(row => {
      if (typeof row === 'object' && row !== null) {
        Object.keys(row).forEach(key => allKeys.add(key));
      }
    });
    
    // Convert to array and filter out empty keys
    const keys = Array.from(allKeys).filter(key => key.trim() !== '');
    
    if (keys.length === 0) {
      // If no valid keys, try to format the raw data as a string
      return JSON.stringify(data, null, 2);
    }
    
    // Calculate the maximum width needed for each column
    const columnWidths: Record<string, number> = {};
    keys.forEach(key => {
      // Start with the header length
      columnWidths[key] = key.length;
      
      // Check each row's cell width for this column
      data.forEach(row => {
        if (row && row[key] !== undefined && row[key] !== null) {
          const cellValue = String(row[key]);
          columnWidths[key] = Math.max(columnWidths[key], cellValue.length);
        }
      });
      
      // Add some padding
      columnWidths[key] += 2;
    });
    
    // Build header row
    let table = '| ';
    keys.forEach(key => {
      table += key.padEnd(columnWidths[key]) + '| ';
    });
    table += '\n|';
    
    // Add separator row
    keys.forEach(key => {
      table += '-'.repeat(columnWidths[key] + 2) + '|';
    });
    table += '\n';
    
    // Add data rows
    data.forEach(row => {
      table += '| ';
      keys.forEach(key => {
        const cellValue = row && row[key] !== undefined && row[key] !== null ? String(row[key]) : '';
        table += cellValue.padEnd(columnWidths[key]) + '| ';
      });
      table += '\n';
    });
    
    return table;
  }

  /**
   * Parses the structured text response into a visualization-friendly format
   */
  private parseStructuredResponse(content: string): StructuredAnalysisResponse {
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
            
            // Try to extract step type from text (e.g., "FILTERING: First I...")
            let stepType = 'analysis'; // Default type
            const typeMatch = stepText.match(/^([A-Z]+):/i);
            if (typeMatch) {
              stepType = typeMatch[1].toLowerCase();
            }
            
            steps.push({
              id: `step-${index + 1}`,
              type: stepType,
              description: stepText.split('\n')[0].replace(/^([A-Z]+):\s*/i, ''), // First line as description, removing type prefix
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
      
      // Parse visualization
      let visualization: Visualization | null = null;
      if (visualizationMatch && visualizationMatch[1]) {
        const vizText = visualizationMatch[1].trim();
        
        // Parse chart type
        const chartTypeMatch = vizText.match(/Chart Type:\s*(\w+)/i);
        const chartType = chartTypeMatch ? chartTypeMatch[1].toLowerCase() : 'bar';
        
        // Parse axes
        const xAxisMatch = vizText.match(/X-Axis:\s*([a-zA-Z0-9_]+)/i);
        const yAxisMatch = vizText.match(/Y-Axis:\s*([a-zA-Z0-9_]+)/i);
        
        // Parse data
        const dataMatch = vizText.match(/```json\s*([\s\S]*?)```/);
        
        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1].trim());
            visualization = {
              type: chartType,
              config: {
                data: data,
                xKey: xAxisMatch ? xAxisMatch[1] : Object.keys(data[0])[0],
                yKey: yAxisMatch ? yAxisMatch[1] : Object.keys(data[0])[1],
                labels: {
                  title: 'Analysis Visualization',
                  xAxis: xAxisMatch ? xAxisMatch[1] : Object.keys(data[0])[0],
                  yAxis: yAxisMatch ? yAxisMatch[1] : Object.keys(data[0])[1]
                }
              }
            };
            
            // Add visualization as a step
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
   * Determines if a query is analytical in nature (can be used for any data type)
   * @param query The user's query
   * @returns True if the query is analytical
   */
  public isAnalyticalQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for analytical terms
    const analyticalTerms = [
      // General analytical terms
      'analyze', 'analysis', 'examine', 'investigate', 'study', 'evaluate', 
      'assess', 'explore', 'review', 'interpret',
      
      // Data terms
      'data', 'information', 'records', 'stats', 'statistics', 'metrics', 'figures',
      
      // Comparative terms
      'compare', 'comparison', 'versus', 'vs', 'against', 'relative to', 'compared to',
      
      // Trend terms
      'trend', 'pattern', 'over time', 'history', 'historical', 'timeline', 'progression',
      
      // Aggregation terms
      'total', 'sum', 'average', 'mean', 'median', 'aggregate', 'count',
      
      // Visualization terms
      'chart', 'graph', 'plot', 'visualize', 'visualization', 'display', 'show', 'illustrate',
      
      // Result terms
      'result', 'outcome', 'finding', 'conclusion', 'insight', 'summary'
    ];
    
    // Check if the query contains any analytical terms
    return analyticalTerms.some(term => lowerQuery.includes(term));
  }
}

export { DataSourceType }; 