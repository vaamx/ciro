import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { ExtendedOpenAI } from '../ai/openai/types';

type MessageRole = 'user' | 'assistant' | 'system' | 'developer';

interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export class OpenAIService {
  private client: ExtendedOpenAI;
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey
    }) as ExtendedOpenAI;
  }

  // Generate embeddings for vector search
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }

  // Generate chat completion with context
  async generateChatResponse(
    messages: ChatMessage[],
    context?: string
  ): Promise<string> {
    // If context is provided, add it to the system message
    if (context) {
      messages.unshift({
        role: 'system',
        content: `Context: ${context}\n\nRespond based on the above context.`
      });
    }

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 500,
      store: true
    });

    return completion.choices[0].message.content || '';
  }

  // Suggest visualization based on data
  async suggestVisualization(data: any): Promise<{
    type: string;
    config: any;
  }> {
    // Create a prompt for the visualization suggestion
    const dataStr = JSON.stringify(data, null, 2);
    const prompt = `I need a visualization suggestion for the following data:
    
    ${dataStr}
    
    Please suggest a visualization type and configuration that would best represent this data.
    Return your response as a JSON object with the following structure:
    {
      "type": "visualization_type",
      "config": {
        // Configuration for the visualization
      }
    }
    
    Consider the following visualization types:
    - Bar chart
    - Line chart
    - Pie chart
    - Scatter plot
    - Heatmap
    - Area chart
    
    Include in your config:
       - Data mapping
       - Colors
       - Labels
       - Axes configuration
    
    Make the visualization beautiful and insightful.`;

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'developer', content: prompt } as ChatCompletionMessageParam],
      temperature: 0.3,
      max_tokens: 1000,
      store: true
    });

    const content = completion.choices[0].message.content || '';
    
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                        content.match(/```\n([\s\S]*?)\n```/) ||
                        content.match(/{[\s\S]*?}/);
      
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json\n|```\n|```/g, '') : content;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Error parsing visualization suggestion:', error);
      return {
        type: 'bar',
        config: {
          error: 'Failed to parse suggestion',
          rawResponse: content
        }
      };
    }
  }

  // Parse a natural language query into structured data query
  async parseDataQuery(query: string): Promise<{
    dataSource: string;
    operation: string;
    filters?: Record<string, any>;
  }> {
    const prompt = `Parse the following natural language query into a structured data query:
    
    "${query}"
    
    Return a JSON object with the following structure:
    {
      "dataSource": "name of data source",
      "operation": "operation to perform",
      "filters": {
        "field1": "value1",
        "field2": "value2"
      }
    }
    
    Extract the following information:
    - dataSource: which data source to query
    - operation: what operation to perform
    - filters: any specific filters mentioned`;

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'developer', content: prompt } as ChatCompletionMessageParam],
      temperature: 0.3,
      max_tokens: 500,
      store: true
    });

    const content = completion.choices[0].message.content || '';
    
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                        content.match(/```\n([\s\S]*?)\n```/) ||
                        content.match(/{[\s\S]*?}/);
      
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json\n|```\n|```/g, '') : content;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Error parsing data query:', error);
      return {
        dataSource: 'unknown',
        operation: 'query',
        filters: {
          error: 'Failed to parse query',
          rawQuery: query
        }
      };
    }
  }
} 