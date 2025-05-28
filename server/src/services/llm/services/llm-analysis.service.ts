import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../../common/utils/logger-factory';
import { LLMService } from '../llm.service';
import { ChatMessage } from '../types/llm-types';
import { DataSourceType, AnalyticalOperationType } from '../../../types/document/processing';
import { v4 as uuidv4 } from 'uuid';

// Interface for the input parameters of generateAnalysis
interface LlmAnalysisInput {
  query: string;
  processedData: string; // Enhanced data string
  dataSourceType: DataSourceType;
  analyticalOperations: AnalyticalOperationType[];
  model?: string; // Allow model override
  temperature?: number; // Allow temperature override
}

@Injectable()
export class LlmAnalysisService {
  private readonly logger = createServiceLogger('LlmAnalysisService');

  constructor(private readonly llmService: LLMService) {
    this.logger.info('LlmAnalysisService initialized with LLM abstraction layer');
  }

  // Method to create the system prompt 
  // (Assuming a basic implementation was intended here)
  private createSystemPrompt(
    dataSourceType: DataSourceType,
    analyticalOperations: AnalyticalOperationType[]
  ): string {
    let prompt = `You are an expert data analyst tasked with analyzing data.`;
    prompt += ` The data is of type: ${dataSourceType}.`;
    prompt += ` Focus on these operations: ${analyticalOperations.join(', ')}.`;
    prompt += ` Provide a clear, structured response including a summary, key insights, and if applicable, data points suitable for visualization.`;
    // Add more detailed instructions based on operations if needed
    if (analyticalOperations.includes(AnalyticalOperationType.TREND)) {
      prompt += ` Identify any significant trends.`;
    }
    if (analyticalOperations.includes(AnalyticalOperationType.FORECAST)) {
      prompt += ` Provide a forecast if possible.`;
    }
     if (analyticalOperations.includes(AnalyticalOperationType.CORRELATE)) {
      prompt += ` Identify correlations between variables.`;
    }
    return prompt;
  }

  /**
   * Generate analysis using LLM based on provided context
   * @param input Parameters for the analysis generation
   * @returns The raw analysis content string from the LLM
   */
  public async generateAnalysis(input: LlmAnalysisInput): Promise<string> {
    const { query, processedData, dataSourceType, analyticalOperations, model, temperature } = input;
    this.logger.info(`Generating LLM analysis for query: "${query}"`);

    // Create system prompt
    const systemPrompt = this.createSystemPrompt(dataSourceType, analyticalOperations);
    this.logger.debug(`Generated system prompt: ${systemPrompt}`);

    // Prepare user message
    const userMessageContent = `Based on the following data (${dataSourceType}):\n\n${processedData}\n\nPlease analyze it according to this query: "${query}"\n\nFocus on the following analytical operations: ${analyticalOperations.join(', ')}\nPlease provide a structured response including summary, insights, and potentially data for visualization.`;
    this.logger.debug(`User message content prepared.`);

    // Prepare chat messages
    const messages: ChatMessage[] = [
      { 
        id: uuidv4(),
        role: 'system', 
        content: systemPrompt, 
        timestamp: Date.now()
      },
      { 
        id: uuidv4(),
        role: 'user', 
        content: userMessageContent, 
        timestamp: Date.now()
      },
    ];

    try {
      this.logger.info('Sending request to LLM...');
      
      const response = await this.llmService.generateChatCompletion(messages, {
        model: model || 'gpt-4o', // Default to GPT-4o for analysis
        temperature: temperature || 0.2,
        taskType: 'complex_reasoning',
        taskComplexity: 'complex'
      });
      
      const analysisContent = response.content?.trim() ?? '';
      this.logger.info('Received response from LLM.');
      this.logger.debug(`LLM Response Content: ${analysisContent.substring(0, 100)}...`);
      
      if (!analysisContent) {
        this.logger.warn('LLM response content was empty.');
      }
      
      return analysisContent;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during LLM analysis generation: ${errorMessage}`, error);
      // Rethrow or handle as appropriate for the application flow
      throw new Error(`Failed to generate LLM analysis: ${errorMessage}`);
    }
  }
} 