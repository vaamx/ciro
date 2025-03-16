/**
 * OpenAI types and interfaces for the application
 */

// Declare the OpenAI module
declare module 'openai' {
  // Export the OpenAI class as both a type and a value
  export default class OpenAI {
    constructor(options: {
      apiKey: string;
      baseURL?: string;
      organization?: string;
      maxRetries?: number;
      timeout?: number;
      dangerouslyAllowBrowser?: boolean;
    });
  }
}

// Directly declare the module augmentation for openai service
declare module '../services/openai.service' {
  // Make ModelName accept any string value
  type ModelName = string;
  
  // Update the ChatOptions interface
  interface ChatOptions {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string[];
    stream?: boolean;
    systemPrompt?: string;
  }
} 