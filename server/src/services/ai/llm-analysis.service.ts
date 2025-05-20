import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage, ChatOptions } from './openai.service';
import { DataSourceType, AnalyticalOperationType } from '../../types/document/processing';
import { v4 as uuidv4 } from 'uuid';

// Interface for the input parameters of generateAnalysis
interface LlmAnalysisInput {
  query: string;
  processedData: string; // Enhanced data string
  dataSourceType: DataSourceType;
  analyticalOperations: AnalyticalOperationType[];
  chatOptions?: Partial<ChatOptions>; // Allow overriding default chat options
}

@Injectable()
export class LlmAnalysisService {
  private readonly logger = createServiceLogger('LlmAnalysisService');

  constructor(private readonly openAIService: OpenAIService) {}

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
    const { query, processedData, dataSourceType, analyticalOperations, chatOptions } = input;
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
        id: uuidv4(), // Generate unique ID
        role: 'system', 
        content: systemPrompt, 
        timestamp: Date.now(), // Add timestamp
        status: 'loading' // Set initial status
      },
      { 
        id: uuidv4(), // Generate unique ID
        role: 'user', 
        content: userMessageContent, 
        timestamp: Date.now(), // Add timestamp
        status: 'loading' // Set initial status
      },
    ];

    // Default options + overrides from request
    const finalChatOptions: ChatOptions = {
      model: 'gpt-4o', 
      temperature: 0.2, 
      ...chatOptions, // Apply overrides
      stream: false // Force stream off for this service
    };
    this.logger.debug(`Using chat options: ${JSON.stringify(finalChatOptions)}`);

    try {
      this.logger.info('Sending request to LLM...');
      // Use the correct method name and handle the Response object
      const response = await this.openAIService.generateChatCompletion(messages, finalChatOptions);
      
      // Check if the response is okay and parse the JSON body
      if (!response.ok) {
        throw new Error(`LLM API request failed with status ${response.status}`);
      }
      
      // Parse the JSON response body which should contain our ChatMessage structure
      const responseData = await response.json() as ChatMessage; 
      
      const analysisContent = responseData?.content?.trim() ?? '';
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
