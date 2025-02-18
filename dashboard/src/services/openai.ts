import { apiService } from './api';
import type { ChatMessage, MessageRole, MessageStatus, MessageMetadata } from '../components/Chat/types';

export interface ChatOptions {
  model?: 'gpt-4-turbo-preview' | 'gpt-4' | 'gpt-3.5-turbo';
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
    options: ChatOptions = {},
    onStream?: (chunk: string) => void
  ): Promise<ChatMessage> {
    const {
      model = 'gpt-4-turbo-preview',
      temperature = 0.7,
      stream = false,
      systemPrompt = 'You are a helpful AI assistant.'
    } = options;

    try {
      if (stream && onStream) {
        const response = await apiService.streamChatCompletion(messages, {
          model,
          temperature,
          systemPrompt,
          streaming: true,
          contextLength: 4096
        });

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        let fullContent = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  onStream(content);
                }
              } catch (e) {
                console.error('Error parsing streaming response:', e);
              }
            }
          }
        }

        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: fullContent,
          status: 'complete',
          timestamp: Date.now()
        };
      } else {
        const response = await apiService.generateChatCompletion(messages, {
          model,
          temperature,
          systemPrompt,
          streaming: false,
          contextLength: 4096
        });

        const data = await response.json();
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message.content,
          status: 'complete',
          timestamp: Date.now(),
          metadata: {
            model,
            tokens: data.usage
          }
        };
      }
    } catch (error) {
      console.error('Error generating chat completion:', error);
      return {
        id: Date.now().toString(),
        role: 'error',
        content: 'Sorry, there was an error processing your request. Please try again.',
        status: 'error',
        timestamp: Date.now()
      };
    }
  }
}

export const openAIService = OpenAIService.getInstance(); 