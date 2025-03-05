import { ChatService, ChatSettings, MessageMetadata } from '../components/Chat/types';

class ChatServiceImpl implements ChatService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async fetchWithCredentials(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    return fetch(url, { ...defaultOptions, ...options });
  }

  async sendMessage(content: string, settings: ChatSettings): Promise<{
    content: string;
    metadata?: MessageMetadata;
  }> {
    try {
      console.log('ChatService: Sending message with settings:', { content, settings });
      
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/completion`, {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          ...settings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('ChatService: Error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('ChatService: Received response:', data);

      return {
        content: data.content || data.message || '',
        metadata: {
          model: data.model || settings.model,
          ...data.metadata
        },
      };
    } catch (error) {
      console.error('ChatService: Error sending message:', error);
      throw error;
    }
  }
}

export const chatService = new ChatServiceImpl(); 