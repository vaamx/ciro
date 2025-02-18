import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { config } from '../config';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  organization: config.openai.orgId,
});

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  status: 'complete' | 'streaming' | 'error' | 'loading';
  metadata?: {
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    suggestions?: string[];
  };
}

export interface ChatOptions {
  model?: 'gpt-4o' | 'gpt-4' | 'gpt-3.5-turbo';
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export class OpenAIService {
  private static instance: OpenAIService;
  private constructor() {}

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  async generateChatCompletion(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<Response> {
    const {
      model = 'gpt-4-turbo-preview',
      temperature = 0.7,
      stream = false,
      systemPrompt = 'You are a helpful AI assistant.'
    } = options;

    // Convert our messages to OpenAI format
    const openAiMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role === 'error' ? 'assistant' : msg.role,
        content: msg.content
      }))
    ];

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: openAiMessages,
        temperature,
        stream,
      });

      if (stream) {
        // Return the stream directly
        return new Response(completion as any, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Return a regular JSON response
        const response = completion.choices[0]?.message?.content || '';
        return new Response(JSON.stringify({
          id: completion.id,
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          status: 'complete',
          metadata: {
            model,
            tokens: {
              prompt: completion.usage?.prompt_tokens || 0,
              completion: completion.usage?.completion_tokens || 0,
              total: completion.usage?.total_tokens || 0,
            }
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Error generating chat completion:', error);
      return new Response(JSON.stringify({
        id: Date.now().toString(),
        role: 'error',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: Date.now(),
        status: 'error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }
}

export const openAIService = OpenAIService.getInstance();

export { openai }; 