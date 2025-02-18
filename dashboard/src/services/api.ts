import type { ChatMessage, ChatSettings as ChatOptions } from '../components/Chat/types';

export interface ChatSession {
  id: string;
  title: string;
  last_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMetadata {
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  suggestions?: string[];
}

export interface ChatResponse {
  content: string;
  metadata?: ChatMetadata;
}

export interface ApiService {
  getChatSessions: () => Promise<ChatSession[]>;
  createChatSession: (title?: string) => Promise<ChatSession>;
  updateChatSession: (sessionId: string, title: string) => Promise<ChatSession>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  getChatHistory: (sessionId: string) => Promise<ChatMessage[]>;
  saveChatHistory: (sessionId: string, messages: ChatMessage[]) => Promise<void>;
  sendMessage: (sessionId: string, message: string, dataSource?: string) => Promise<ChatResponse>;
  regenerateMessage: (messageId: string) => Promise<{ content: string; metadata?: ChatMetadata }>;
  cancelGeneration?: () => Promise<void>;
  generateChatCompletion: (messages: ChatMessage[], options?: ChatOptions) => Promise<Response>;
  streamChatCompletion: (messages: ChatMessage[], options?: ChatOptions) => Promise<Response>;
}

class ApiServiceImpl implements ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
  }

  private async handleResponse(response: Response) {
    if (response.status === 401 || response.status === 403) {
      const error = await response.json().catch(() => ({}));
      
      // Clear token if it's invalid
      localStorage.removeItem('auth_token');
      
      throw new Error(error.message || 'Authentication failed');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || `Server error: ${response.status}`);
    }
    
    // Check for new auth token in response headers
    const newToken = response.headers.get('Authorization');
    if (newToken?.startsWith('Bearer ')) {
      const token = newToken.substring(7);
      localStorage.setItem('auth_token', token);
    }
    
    return response;
  }

  async getChatSessions(): Promise<ChatSession[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions`, {
        headers: await this.getAuthHeaders(),
        credentials: 'include'
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      throw error;
    }
  }

  async createChatSession(title?: string): Promise<ChatSession> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ title })
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  async updateChatSession(sessionId: string, title: string): Promise<ChatSession> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ title })
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      console.error('Error updating chat session:', error);
      throw error;
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
        credentials: 'include'
      });
      await this.handleResponse(response);
    } catch (error) {
      console.error('Error deleting chat session:', error);
      throw error;
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
        headers: await this.getAuthHeaders(),
        credentials: 'include'
      });

      // Handle non-OK responses first
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Keep default error message if parsing fails
        }
        throw new Error(errorMessage);
      }

      // For successful responses, parse JSON directly
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Expected array but got:', typeof data);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  }

  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}/history`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ messages })
      });
      await this.handleResponse(response);
    } catch (error) {
      console.error('Error saving chat history:', error);
      throw error;
    }
  }

  async sendMessage(sessionId: string, message: string, dataSource?: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          message,
          dataSource,
        }),
      });
      await this.handleResponse(response);
      return response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async regenerateMessage(messageId: string): Promise<{ content: string; metadata?: ChatMetadata }> {
    const response = await fetch(`${this.baseUrl}/api/chat/message/${messageId}/regenerate`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to regenerate message');
    }

    return response.json();
  }

  async cancelGeneration(): Promise<void> {
    // Implementation
  }

  async generateChatCompletion(messages: ChatMessage[], options?: ChatOptions): Promise<Response> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/completion`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ 
          messages, 
          ...options,
          model: options?.model || 'gpt-4o'  // Set default model
        }),
        credentials: 'include'
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error in generateChatCompletion:', error);
      throw error;
    }
  }

  async streamChatCompletion(
    messages: ChatMessage[],
    options: ChatOptions = { model: 'gpt-4o', temperature: 0.7, streaming: true, contextLength: 4096 }
  ): Promise<Response> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/completion`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ ...options, messages, stream: true }),
        credentials: 'include'
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error in streamChatCompletion:', error);
      throw error;
    }
  }
}

export const apiService = new ApiServiceImpl(); 