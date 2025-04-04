/**
 * OpenAI types and interfaces for the application
 */

// Declare the OpenAI module
declare module 'openai' {
  interface OpenAIClient {
    embeddings: {
      create(options: { model: string; input: string | string[] }): Promise<{
        data: Array<{ embedding: number[] }>;
      }>;
    };
    chat: {
      completions: {
        create(options: {
          model: string;
          messages: any[];
          temperature?: number;
          max_tokens?: number;
          store?: boolean;
        }): Promise<{
          choices: Array<{
            message: {
              content: string | null;
            };
          }>;
        }>;
      };
    };
  }

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
    embeddings: OpenAIClient['embeddings'];
    chat: OpenAIClient['chat'];
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