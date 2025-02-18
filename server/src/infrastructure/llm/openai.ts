import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

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

  // Generate visualization suggestions
  async suggestVisualization(data: any): Promise<{
    type: string;
    config: any;
  }> {
    const prompt = `Analyze this data and suggest the most effective visualization: ${JSON.stringify(data)}
    
    Consider these visualization types:
    1. Line Chart - For time series or trend data
    2. Bar Chart - For comparing categories
    3. Pie Chart - For showing composition
    4. Table - For detailed data viewing
    5. Area Chart - For cumulative values
    6. Scatter Plot - For correlation analysis
    7. Radar Chart - For multivariate data
    8. Heatmap - For density or correlation matrices
    
    Return a JSON object with:
    1. type: The chosen visualization type
    2. config: A complete configuration including:
       - Data structure
       - Colors (using tailwind colors)
       - Animations
       - Responsive settings
       - Tooltips
       - Legends
       - Axes configuration
    
    Make the visualization beautiful and insightful.`;

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'developer', content: prompt } as ChatCompletionMessageParam],
      temperature: 0.3,
      max_tokens: 1000,
      store: true
    });

    try {
      const suggestion = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Add default styling if not provided
      if (suggestion.config && !suggestion.config.style) {
        suggestion.config.style = {
          backgroundColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12,
          textColor: 'rgb(75, 85, 99)',
          animation: {
            duration: 750,
            easing: 'easeInOutQuart'
          }
        };
      }
      
      return suggestion;
    } catch (error) {
      console.error('Error parsing visualization suggestion:', error);
      return {
        type: 'table',
        config: {
          data,
          style: {
            backgroundColor: 'transparent',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 12,
            textColor: 'rgb(75, 85, 99)'
          }
        }
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
      model: 'gpt-4o',
      messages: [{ role: 'developer', content: prompt } as ChatCompletionMessageParam],
      temperature: 0.3,
      max_tokens: 500,
      store: true
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error parsing query:', error);
      throw new Error('Failed to parse query');
    }
  }
} 