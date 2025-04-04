export * from './config';
export * from './errors';
export * from './base-service';
export * from './chat-service';
export * from './embeddings-service';

// Factory function to create services with shared configuration
import { OpenAIConfig } from './config';
import { ChatService } from './chat-service';
import { EmbeddingsService } from './embeddings-service';

// Import OpenAI client correctly
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

export interface OpenAIServices {
  chat: ChatService;
  embeddings: EmbeddingsService;
}

export function createOpenAIServices(config: OpenAIConfig): OpenAIServices {
  return {
    chat: new ChatService(config),
    embeddings: new EmbeddingsService(config),
  };
}

// Legacy service class for backward compatibility
type MessageRole = 'user' | 'assistant' | 'system' | 'developer';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export class OpenAIService {
  private client: OpenAI;
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  // Generate embeddings for vector search
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use type assertion to bypass TypeScript error
      const embeddings = this.client as any;
      const response = await embeddings.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  // Generate chat completion with context
  async generateChatResponse(
    messages: ChatMessage[],
    context?: string
  ): Promise<string> {
    try {
      // If context is provided, add it to the system message
      if (context) {
        messages.unshift({
          role: 'system',
          content: `Context: ${context}\n\nRespond based on the above context.`
        });
      }

      // Use type assertion to bypass TypeScript error
      const openai = this.client as any;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 500,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }
}