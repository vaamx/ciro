import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

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
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }

  // Generate chat completion with context
  async generateChatResponse(
    messages: ChatCompletionMessageParam[],
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
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content || '';
  }

  // Generate visualization suggestions
  async suggestVisualization(data: any): Promise<{
    type: string;
    config: any;
  }> {
    const prompt = `Given this data: ${JSON.stringify(data)}
    Suggest the best visualization type (chart, table, etc.) and provide a configuration object.
    Response should be valid JSON with 'type' and 'config' fields.`;

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error parsing visualization suggestion:', error);
      return {
        type: 'table',
        config: { data }
      };
    }
  }

  // Extract structured data from natural language query
  async parseDataQuery(query: string): Promise<{
    dataSource: string;
    operation: string;
    filters?: Record<string, any>;
  }> {
    const prompt = `Parse this query into a structured format: "${query}"
    Return JSON with:
    - dataSource: which data source to query
    - operation: what operation to perform
    - filters: any specific filters mentioned`;

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error parsing query:', error);
      throw new Error('Failed to parse query');
    }
  }
} 