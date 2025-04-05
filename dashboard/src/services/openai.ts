import { apiService } from './api';
import type { ChatMessage, ChatSettings } from '../components/Chat/types';

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
    options: ChatSettings = {
      model: 'gpt-4',
      temperature: 0.7,
      contextLength: 4096,
      streaming: false
    },
    onStream?: (chunk: string) => void
  ): Promise<ChatMessage> {
    const {
      model = 'gpt-4',
      temperature = 0.7,
      streaming = false,
      systemPrompt = 'You are a helpful AI assistant.',
      contextLength = 4096
    } = options;

    try {
      if (streaming && onStream) {
        const response = await apiService.streamChatCompletion(messages, {
          model,
          temperature,
          systemPrompt,
          streaming: true,
          contextLength
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
      }

      const response = await apiService.generateChatCompletion(messages, {
        model,
        temperature,
        systemPrompt,
        streaming: false,
        contextLength
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

  async suggestVisualization(data: any): Promise<{ type: string; config: any }> {
    const prompt = `Analyze this data and suggest the most effective visualization: ${JSON.stringify(data)}
    
    Consider these visualization types:
    1. Line Chart - For time series or trend data
    2. Bar Chart - For comparing categories
    3. Pie Chart - For showing composition
    4. Scatter Plot - For correlation analysis
    5. Area Chart - For cumulative values
    6. Radar Chart - For multivariate data
    
    Return a JSON object with:
    1. type: The chosen visualization type
    2. config: A complete Chart.js configuration including:
       - Data structure
       - Colors (using tailwind colors)
       - Animations
       - Responsive settings
       - Tooltips
       - Legends
       - Axes configuration
    
    Make the visualization beautiful and insightful.`;

    try {
      const messages: ChatMessage[] = [
        {
          id: Date.now().toString(),
          role: 'system',
          content: 'You are a data visualization expert.',
          status: 'complete',
          timestamp: Date.now()
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'user',
          content: prompt,
          status: 'complete',
          timestamp: Date.now()
        }
      ];

      const completion = await this.generateChatCompletion(messages, {
        model: 'gpt-4',
        temperature: 0.7,
        streaming: false,
        contextLength: 4096
      });

      // Parse the response
      const responseData = JSON.parse(completion.content);

      // Add default styling if not provided
      if (responseData.config && !responseData.config.style) {
        responseData.config.style = {
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

      return responseData;
    } catch (error) {
      console.error('Error suggesting visualization:', error);
      
      // Return a sensible default visualization
      return {
        type: 'bar',
        config: {
          data: {
            labels: data.data?.labels || [],
            datasets: [{
              label: data.data?.title || 'Data',
              data: data.data?.values || [],
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: data.data?.title || '',
                font: {
                  size: 16,
                  weight: 'bold'
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        }
      };
    }
  }
}

export const openAIService = OpenAIService.getInstance(); 