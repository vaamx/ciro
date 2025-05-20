import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { config } from '../../config';
import * as fs from 'fs';
import type { FilePurpose } from 'openai/resources';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey || '',
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
  model?: string;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

@Injectable()
export class OpenAIService {
  
  constructor() {
    // Initialize any dependencies here if needed
  }

  /**
   * Generate embeddings for a text query or queries
   * @param query Text or array of texts to generate embeddings for
   * @param options Optional parameters
   * @returns Array of embeddings
   */
  async createEmbeddings(query: string | string[], options?: { skipCache?: boolean }): Promise<number[][]> {
    try {
      const input = Array.isArray(query) ? query : [query];
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input,
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Upload a file to OpenAI
   * @param filePath Path to the file to upload
   * @param purpose Purpose of the file (e.g., 'fine-tune')
   * @returns Response from the OpenAI API
   */
  async uploadFile(filePath: string, purpose: FilePurpose): Promise<any> {
    try {
      const file = await (openai as any).files.create({
        file: fs.createReadStream(filePath),
        purpose
      });
      return file;
    } catch (error) {
      console.error('Error uploading file to OpenAI:', error);
      throw error;
    }
  }

  /**
   * Create a fine-tuning job
   * @param params Parameters for the fine-tuning job
   * @returns Response from the OpenAI API
   */
  async createFineTuningJob(params: any): Promise<any> {
    try {
      const fineTune = await (openai as any).fineTuning.jobs.create({
        training_file: params.training_file,
        model: params.model,
        suffix: params.suffix,
        hyperparameters: params.hyperparameters,
        ...(params.method && { method: params.method })
      });
      return fineTune;
    } catch (error) {
      console.error('Error creating fine-tuning job:', error);
      throw error;
    }
  }

  /**
   * Get the status of a fine-tuning job
   * @param jobId ID of the fine-tuning job
   * @returns Response from the OpenAI API
   */
  async getFineTuningJob(jobId: string): Promise<any> {
    try {
      const job = await (openai as any).fineTuning.jobs.retrieve(jobId);
      return job;
    } catch (error) {
      console.error(`Error retrieving fine-tuning job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a fine-tuning job
   * @param jobId ID of the fine-tuning job to cancel
   * @returns Response from the OpenAI API
   */
  async cancelFineTuningJob(jobId: string): Promise<any> {
    try {
      const job = await (openai as any).fineTuning.jobs.cancel(jobId);
      return job;
    } catch (error) {
      console.error(`Error cancelling fine-tuning job ${jobId}:`, error);
      throw error;
    }
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
      }

      // For non-stream responses, avoid using namespace
      const nonStreamCompletion = completion as any;
      const response = nonStreamCompletion.choices[0]?.message?.content || '';
      
      return new Response(JSON.stringify({
        id: nonStreamCompletion.id,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        status: 'complete',
        metadata: {
          model,
          tokens: {
            prompt: nonStreamCompletion.usage?.prompt_tokens || 0,
            completion: nonStreamCompletion.usage?.completion_tokens || 0,
            total: nonStreamCompletion.usage?.total_tokens || 0,
          }
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
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

  /**
   * Generate a response using OpenAI Responses API with streaming support
   * This is the new API for streaming that supports progress reporting during RAG processing
   */
  async generateStreamingResponse(
    query: string,
    documents: any[],
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
      processingStatusCallback?: (status: string) => void;
      metadataCallback?: (metadata: any) => void;
    } = {}
  ): Promise<ReadableStream> {
    const {
      model = 'gpt-4-turbo-preview',
      temperature = 0.7,
      systemPrompt = 'You are a helpful AI assistant. You analyze data and provide insights.'
    } = options;

    try {
      // Create a transform stream to process the data
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Process the chunk if needed
          try {
            const text = new TextDecoder().decode(chunk);
            // Do any additional processing here
            
            if (text.includes('data:')) {
              try {
                // Try to extract JSON content
                const jsonStr = text.replace('data: ', '').trim();
                if (jsonStr && jsonStr !== '[DONE]') {
                  const jsonData = JSON.parse(jsonStr);
                  // Do something with the JSON data if needed
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
            
            // Pass through the chunk
            controller.enqueue(chunk);
          } catch (error) {
            console.error('Error transforming chunk:', error);
            controller.enqueue(chunk); // Still pass through even on error
          }
        }
      });

      // Prepare OpenAI-compatible messages
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ];

      // Create a TextEncoder for the ReadableStream
      const encoder = new TextEncoder();
      
      // Create a readable stream for the response
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Use any type assertion to avoid TypeScript errors with stream option
            const chatCompletionOptions = {
              model,
              messages,
              temperature,
              stream: true
            };
            
            // Create the OpenAI chat completion with streaming
            const openaiResponse = await (openai.chat.completions.create as any)(chatCompletionOptions);
            
            // Process each chunk from the stream
            for await (const chunk of openaiResponse) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                // Format as SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
              }
            }
            
            // Close the stream when done
            controller.close();
          } catch (error) {
            console.error('Error in streaming response:', error);
            // Send error to client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: true, 
              message: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`));
            controller.close();
          }
        }
      });
      
      // Return the stream with transformation
      return stream.pipeThrough(transformStream);
    } catch (error) {
      console.error('Error generating streaming response:', error);
      
      // Create an error stream
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`));
          controller.close();
        }
      });
      
      return errorStream;
    }
  }
}

export { openai }; 