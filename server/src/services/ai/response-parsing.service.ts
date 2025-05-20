import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { v4 as uuidv4 } from 'uuid'; // Might be needed by helpers if they generate IDs

// Copied types/enums from DataAnalysisOrchestratorService for now
// TODO: Move these to a shared types file (e.g., ../../types/analysis.types.ts)
export enum ChartType {
  BAR_CHART = 'enhanced-bar-chart',
  LINE_CHART = 'line-chart',
  PIE_CHART = 'pie-chart',
  SCATTER_PLOT = 'scatter-plot',
  AREA_CHART = 'area-chart',
  TABLE = 'table',
  NONE = 'none'
}

export interface StructuredAnalysisResponse {
  summary: string;
  steps: AnalysisStep[];
  insights: string[];
  nextSteps?: string[];
  visualization?: {
    type: ChartType;
    config: any;
  };
  content?: string; // Added content field if needed later
}

export interface AnalysisStep {
  id: string;
  type: string;
  description: string;
  content?: string;
  order: number;
  data?: any;
  visualization?: {
    type: ChartType;
    config: any;
  };
}

@Injectable()
export class ResponseParsingService {
  private readonly logger = createServiceLogger('ResponseParsingService');

  constructor() {
    this.logger.info('ResponseParsingService initialized');
  }

  /**
   * Parse the LLM response content into a structured format.
   * Attempts JSON parsing first, falls back to natural language parsing.
   * @param content The raw LLM response content string.
   * @param suggestedVisualizationType Optional hint from query analysis.
   * @param dataSourceId Optional ID for context.
   * @param userId Optional ID for context.
   * @returns Structured analysis response object.
   */
  public parseLlmResponse(
    content: string,
    suggestedVisualizationType?: ChartType,
    dataSourceId?: string, // Keep optional params for context if needed by future parsing logic
    userId?: string
  ): StructuredAnalysisResponse {
    this.logger.info(`Parsing LLM response content (length: ${content.length})`);
    try {
      // Attempt to parse as structured JSON first (e.g., if LLM followed JSON format instructions)
      // Look for JSON block
      const jsonMatch = content.match(/```(?:json)?\s*(\{[^\n]*?\})?\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsedJson = JSON.parse(jsonMatch[1]);
          // Basic validation to check if it resembles our structure
          if (parsedJson.summary && Array.isArray(parsedJson.steps)) {
            this.logger.info('Successfully parsed structured JSON from LLM response.');
            // TODO: Add more robust validation/mapping if needed
            return parsedJson as StructuredAnalysisResponse;
          }
        } catch (jsonError) {
          this.logger.warn('Found JSON block, but failed to parse. Falling back to NL parsing.', jsonError);
        }
      }

      // Fallback to natural language parsing if no valid JSON structure found
      this.logger.info('No valid structured JSON found, attempting natural language parsing.');
      return this.parseNaturalLanguageResponse(content, suggestedVisualizationType);

    } catch (error) {
      this.logger.error('Error parsing LLM response:', error);
      // Return a minimal error structure
      return {
        summary: 'Error parsing analysis response.',
        steps: [{ id: 'error', type: 'error', description: 'Parsing Error', content: content.substring(0, 500), order: 1 }],
        insights: [],
        visualization: { type: ChartType.NONE, config: {} }
      };
    }
  }

  // --- Start of Methods Moved from DataAnalysisOrchestratorService --- 

  /**
   * Parse the LLM response into a structured format (Original Method)
   * NOTE: This was the original parsing method, potentially superseded by parseLlmResponse.
   * Keeping it for reference or potential reuse of its internal logic.
   */
  private async parseStructuredResponse(
    content: string, 
    // analyticalOperations: AnalyticalOperationType[] = [], // Removed dependency
    suggestedVisualizationType?: ChartType,
    dataSourceId?: string,
    userId?: string
    // configGenerationFunc?: (dsId: string, uId: string) => Promise<any> // Added dependency if needed
  ): Promise<StructuredAnalysisResponse> {
    this.logger.warn('Executing legacy parseStructuredResponse method.'); // Add warning
    try {
      const response: StructuredAnalysisResponse = {
        summary: '',
        steps: [],
        insights: [],
        visualization: {
          type: ChartType.NONE,
          config: {}
        }
      };
      
      const extractedType = this.extractVisualizationType(content);
      const vizType = extractedType || suggestedVisualizationType || ChartType.BAR_CHART;
      
      const summaryMatch = content.match(/##?\s*Summary\s*\n([^\n]*?)(?=##?\s|$)/i);
      if (summaryMatch && summaryMatch[1]) {
        response.summary = summaryMatch[1].trim();
      }
      
      const stepsMatch = content.match(/##?\s*Steps\s*\n([^\n]*?)(?=##?\s|$)/i);
      if (stepsMatch && stepsMatch[1]) {
        const stepsContent = stepsMatch[1].trim();
        const stepRegex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*:?\s*([^\n]*?)(?=\n\s*\d+\.\s*\*\*|$)/g;
        let stepMatch;
        
        while ((stepMatch = stepRegex.exec(stepsContent)) !== null) {
          const stepNumber = parseInt(stepMatch[1], 10);
          const stepType = this.determineStepType(stepMatch[2].trim());
          const stepDescription = stepMatch[2].trim();
          let stepContent = stepMatch[3].trim();
          
          const tableMatches = this.extractTablesFromMarkdown(stepContent);
          let stepData = null;
          
          if (tableMatches.length > 0) {
            try {
              stepData = this.convertMarkdownTableToData(tableMatches[0]);
            } catch (e) {
              this.logger.warn(`Failed to parse table in step ${stepNumber}:`, e);
            }
          }
          
          const step: AnalysisStep = {
            id: `step-${stepNumber}`,
            type: stepType,
            description: stepDescription,
            content: stepContent,
            order: stepNumber,
            data: stepData
          };
          
          if (stepType === 'chart' || stepType === 'visualization') {
            const extractedStepType = this.extractVisualizationType(stepContent);
            const stepVizType = extractedStepType || suggestedVisualizationType || ChartType.BAR_CHART;
            step.visualization = {
              type: stepVizType,
              // config: this.generateVisualizationConfig(stepData, stepVizType, String(stepDescription || 'Visualization')) // Config gen moved out
              config: {} // Placeholder config
            };
          }
          
          response.steps.push(step);
        }
      }
      
      const insightsMatch = content.match(/##?\s*Insights\s*\n([^\n]*?)(?=##?\s|$)/i);
      if (insightsMatch && insightsMatch[1]) {
        const insightsContent = insightsMatch[1].trim();
        const insightRegex = /-\s*([^\n]*?)(?=\n\s*-\s*|$)/g;
        let insightMatch;
        
        while ((insightMatch = insightRegex.exec(insightsContent)) !== null) {
          if (insightMatch[1] && insightMatch[1].trim()) {
            response.insights.push(insightMatch[1].trim());
          }
        }
      }
      
      // Visualization handling might need adjustment based on where config generation happens
      if (!response.visualization && suggestedVisualizationType !== ChartType.NONE) {
         // Simplified - assumes config generation happens elsewhere
         response.visualization = { type: vizType, config: {} };
      }
      
      const nextStepsMatch = content.match(/##?\s*Next Steps\s*\n([^\n]*?)(?=##?\s|$)/i);
      if (nextStepsMatch && nextStepsMatch[1]) {
        const nextStepsContent = nextStepsMatch[1].trim();
        const nextStepRegex = /-\s*([^\n]*?)(?=\n\s*-\s*|$)/g;
        let nextStepMatch;
        response.nextSteps = [];
        while ((nextStepMatch = nextStepRegex.exec(nextStepsContent)) !== null) {
          if (nextStepMatch[1] && nextStepMatch[1].trim()) {
            response.nextSteps.push(nextStepMatch[1].trim());
          }
        }
      }
      
      response.nextSteps = response.nextSteps || [];
      
      // Config generation call removed - needs to happen elsewhere
      // if (vizType !== ChartType.NONE && dataSourceId && userId && configGenerationFunc) {
      //   const config = await configGenerationFunc(dataSourceId, userId);
      //   response.visualization = {
      //     type: vizType,
      //     config: config || {}
      //   };
      // }
      
      return response;
    } catch (error) {
      this.logger.error('Error parsing structured response (legacy method):', error);
      return {
        summary: 'Error parsing response',
        steps: [],
        insights: [],
        visualization: {
          type: ChartType.NONE,
          config: {}
        }
      };
    }
  }

  /**
   * Parse a natural language response into a structured format (Moved Method)
   */
  private parseNaturalLanguageResponse(
    content: string,
    suggestedVisualizationType?: ChartType
  ): StructuredAnalysisResponse {
    try {
      const paragraphs = content.split('\n\n');
      const summary = paragraphs[0] || "Analysis complete.";
      
      const stepPattern = /(?:^|\n)(?:\d+\.|\*|Step \d+:|#+\s*Step \d+:)\s*(.*?)(?=\n(?:\d+\.|\*|Step \d+:|#+\s*Step \d+:)|\n\n|$)/gs;
      const steps: AnalysisStep[] = [];
      
      let match;
      let stepIndex = 0;
      while ((match = stepPattern.exec(content)) !== null) {
        stepIndex++;
        const stepContent = match[0].trim();
        const stepTitle = match[2]?.trim() || `Step ${stepIndex}`;
        
        steps.push({
          id: `step${stepIndex}`,
          type: this.determineStepType(stepTitle), // Use helper
          description: stepTitle,
          content: stepContent,
          order: stepIndex
        });
      }
      
      if (steps.length === 0) {
        const contentChunks = paragraphs.slice(1);
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
      
      const insights: string[] = [];
      const insightSectionMatch = content.match(/(?:insights|findings|key points|conclusions):\s*([\s\S]*?)(?=\n\n|$)/i);
      
      if (insightSectionMatch) {
        const insightSection = insightSectionMatch[1];
        const bulletPoints = insightSection.match(/(?:^|\n)(?:-|\*|\d+\.)\s*(.*?)(?=\n(?:-|\*|\d+\.)|\n\n|$)/gi);
        if (bulletPoints) {
          bulletPoints.forEach(point => {
            const cleaned = point.replace(/(?:^|\n)(?:-|\*|\d+\.)\s*/, '').trim();
            if (cleaned) insights.push(cleaned);
          });
        }
      }
      
      if (insights.length === 0) {
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
        const insightCandidates = sentences.filter(sentence => 
          /(?:find|found|show|indicate|suggest|reveal|highlight|conclude|determine)/i.test(sentence)
        );
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
        } : { type: ChartType.NONE, config: {} } // Ensure viz object exists
      };
    } catch (error) {
      this.logger.error('Error parsing natural language response:', error);
      return {
        summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        steps: [{ id: 'error', type: 'error', description: 'Parsing Error', content, order: 1 }],
        insights: [],
        visualization: { type: ChartType.NONE, config: {} }
      };
    }
  }

  /**
   * Extract tables from markdown content (Moved Method)
   */
  private extractTablesFromMarkdown(content: string): string[] {
    const result: string[] = [];
    const tableRegex = /(\|[^\n]+\\|\n\|[-:| ]+\|\n(?:\|[^\n]+\\|\n)+)/g;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      result.push(match[1]);
    }
    return result;
  }

  /**
   * Convert a markdown table to structured data (Moved Method)
   */
  private convertMarkdownTableToData(markdownTable: string): any[] {
    const lines = markdownTable.trim().split('\n');
    if (lines.length < 3) throw new Error('Invalid markdown table format');
    
    const headerRow = lines[0];
    const headers = headerRow.split('|').map(cell => cell.trim()).filter(Boolean);
    
    const result: any[] = [];
    for (let i = 2; i < lines.length; i++) {
      const dataRow = lines[i];
      const cells = dataRow.split('|').map(cell => cell.trim()).filter(Boolean);
      if (cells.length === headers.length) {
        const rowData: any = {};
        for (let j = 0; j < headers.length; j++) {
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
   * Map chart type string to visualization type (Moved Method)
   */
  private mapChartTypeToVisualization(chartType: string): ChartType {
    const typeMap: Record<string, ChartType> = {
      'bar': ChartType.BAR_CHART,
      'bar_chart': ChartType.BAR_CHART,
      'line': ChartType.LINE_CHART,
      'line_chart': ChartType.LINE_CHART,
      'pie': ChartType.PIE_CHART,
      'pie_chart': ChartType.PIE_CHART,
      'scatter': ChartType.SCATTER_PLOT,
      'scatter_plot': ChartType.SCATTER_PLOT,
      'area': ChartType.AREA_CHART,
      'area_chart': ChartType.AREA_CHART,
      'table': ChartType.TABLE
    };
    return typeMap[chartType.toLowerCase()] || ChartType.BAR_CHART;
  }

  /**
   * Determine step type based on step description (Moved Method)
   */
  private determineStepType(description: string): string {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('filter') || lowerDesc.includes('exclude')) return 'filter';
    if (lowerDesc.includes('sort') || lowerDesc.includes('order')) return 'sort';
    if (lowerDesc.includes('group') || lowerDesc.includes('categorize')) return 'group';
    if (lowerDesc.includes('aggregate') || lowerDesc.includes('sum') || lowerDesc.includes('count')) return 'aggregate';
    if (lowerDesc.includes('visual') || lowerDesc.includes('chart') || lowerDesc.includes('plot')) return 'visualization';
    if (lowerDesc.includes('insight') || lowerDesc.includes('finding')) return 'insight';
    if (lowerDesc.includes('table') || lowerDesc.includes('data')) return 'table';
    if (lowerDesc.includes('compare') || lowerDesc.includes('contrast')) return 'compare';
    return 'analysis';
  }

  /**
   * Extracts visualization type from step content (Moved Method)
   */
  private extractVisualizationType(content: string): ChartType | null {
    if (!content) return null;
    const vizTypePatterns = [
      { pattern: /bar\s+chart|bar\s+graph|column\s+chart/i, type: ChartType.BAR_CHART },
      { pattern: /line\s+chart|line\s+graph|trend\s+line/i, type: ChartType.LINE_CHART },
      { pattern: /pie\s+chart|donut\s+chart|circle\s+chart/i, type: ChartType.PIE_CHART },
      { pattern: /scatter\s+plot|scatter\s+chart|scatter\s+graph/i, type: ChartType.SCATTER_PLOT },
      { pattern: /area\s+chart|area\s+graph|stacked\s+area/i, type: ChartType.AREA_CHART },
      { pattern: /table|tabular/i, type: ChartType.TABLE }
    ];
    for (const { pattern, type } of vizTypePatterns) {
      if (pattern.test(content)) return type;
    }
    return null;
  }
  
  // --- End of Moved Methods --- 
} 