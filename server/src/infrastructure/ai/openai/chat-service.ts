import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { BaseOpenAIService } from './base-service';
import { TokenLimitError } from './errors';
import { encode } from 'gpt-tokenizer';

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ChatCompletionCreateParams['tools'];
  responseFormat?: ChatCompletionCreateParams['response_format'];
}

export class ChatService extends BaseOpenAIService {
  private readonly DEFAULT_MODEL = 'gpt-4o-mini';
  private readonly MAX_TOKENS = 128000; // GPT-4o-mini context window
  private readonly MODEL_CONFIG = {
    'gpt-4o-mini': {
      model: 'gpt-4o-mini',
      maxTokens: 128000,
      temperature: 0.7,
    },
    'gpt-4o': {
      model: 'gpt-4o',
      maxTokens: 128000,
      temperature: 0.7,
    },
    'o3-mini': {
      model: 'o3-mini',
      maxTokens: 200000,
      temperature: 0.7,
    }
  } as const;

  async generateResponse(
    messages: ChatCompletionMessageParam[],
    options: ChatOptions = {}
  ) {
    // Calculate token count
    const tokenCount = this.calculateTokens(messages);
    if (tokenCount > this.MAX_TOKENS) {
      throw new TokenLimitError(
        'Input exceeds maximum token limit',
        tokenCount,
        this.MAX_TOKENS
      );
    }

    const defaultOptions = {
      model: this.DEFAULT_MODEL,
      temperature: 0.7,
      maxTokens: 2048,
    };

    const finalOptions = { ...defaultOptions, ...options };

    return this.executeWithRetry(
      async () => {
        const completion = await this.client.chat.completions.create({
          model: finalOptions.model,
          messages,
          temperature: finalOptions.temperature,
          max_tokens: finalOptions.maxTokens,
          tools: finalOptions.tools,
          response_format: finalOptions.responseFormat,
        });

        return completion.choices[0].message;
      },
      'completions',
      tokenCount
    );
  }

  async streamResponse(
    messages: ChatCompletionMessageParam[],
    options: ChatOptions = {}
  ) {
    const tokenCount = this.calculateTokens(messages);
    if (tokenCount > this.MAX_TOKENS) {
      throw new TokenLimitError(
        'Input exceeds maximum token limit',
        tokenCount,
        this.MAX_TOKENS
      );
    }

    const defaultOptions = {
      model: this.DEFAULT_MODEL,
      temperature: 0.7,
      maxTokens: 2048,
    };

    const finalOptions = { ...defaultOptions, ...options };

    return this.executeWithRetry(
      async () => {
        const stream = await this.client.chat.completions.create({
          model: finalOptions.model,
          messages,
          temperature: finalOptions.temperature,
          max_tokens: finalOptions.maxTokens,
          tools: finalOptions.tools,
          response_format: finalOptions.responseFormat,
          stream: true,
        });

        return stream;
      },
      'completions',
      tokenCount
    );
  }

  private calculateTokens(messages: ChatCompletionMessageParam[]): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalTokens += encode(message.content).length;
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text') {
            totalTokens += encode(content.text).length;
          }
          // Add handling for other content types (images, etc.) if needed
        }
      }
    }

    return totalTokens;
  }
} 