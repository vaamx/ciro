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

export interface Widget {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string;
  size: string;
  settings: Record<string, any>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  created_by: string;
  team: string;
  category: string;
  created_at: string;
  updated_at: string;
  widgets: Widget[];
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
  getDashboards: () => Promise<Dashboard[]>;
  createDashboard: (dashboard: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>) => Promise<Dashboard>;
  updateDashboard: (id: string, dashboard: Partial<Dashboard>) => Promise<Dashboard>;
  deleteDashboard: (id: string) => Promise<void>;
  updateDashboardWidgets: (dashboardId: string, widgets: Partial<Widget>[]) => Promise<Widget[]>;
}

class ApiServiceImpl implements ApiService {
  private baseUrl: string;

  constructor() {
    // Use relative path since we're using Vite's proxy
    this.baseUrl = '';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Origin': window.location.origin
    };
  }

  private async fetchWithCredentials(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
      credentials: 'include',
      mode: 'cors',
      headers: await this.getAuthHeaders()
    };

    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    });

    return this.handleResponse(response);
  }

  private async handleResponse(response: Response) {
    if (response.status === 401 || response.status === 403) {
      const error = await response.json().catch(() => ({}));
      localStorage.removeItem('auth_token');
      throw new Error(error.message || 'Authentication failed');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || `Server error: ${response.status}`);
    }
    
    const authHeader = response.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      localStorage.setItem('auth_token', token);
    }
    
    return response;
  }

  async getChatSessions(): Promise<ChatSession[]> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions`);
      return response.json();
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      throw error;
    }
  }

  async createChatSession(title?: string): Promise<ChatSession> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions`, {
        method: 'POST',
        body: JSON.stringify({ title })
      });
      return response.json();
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  async updateChatSession(sessionId: string, title: string): Promise<ChatSession> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ title })
      });
      return response.json();
    } catch (error) {
      console.error('Error updating chat session:', error);
      throw error;
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting chat session:', error);
      throw error;
    }
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}`);
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
      await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}/history`, {
        method: 'PUT',
        body: JSON.stringify({ messages })
      });
    } catch (error) {
      console.error('Error saving chat history:', error);
      throw error;
    }
  }

  async sendMessage(sessionId: string, message: string, dataSource?: string): Promise<ChatResponse> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message,
          dataSource,
        }),
      });
      return response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async regenerateMessage(messageId: string): Promise<{ content: string; metadata?: ChatMetadata }> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/message/${messageId}/regenerate`);

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
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/completion`, {
        method: 'POST',
        body: JSON.stringify({ 
          messages, 
          ...options,
          model: options?.model || 'gpt-4o'  // Set default model
        }),
      });

      return response;
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
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/completion`, {
        method: 'POST',
        body: JSON.stringify({ ...options, messages, stream: true }),
      });

      return response;
    } catch (error) {
      console.error('Error in streamChatCompletion:', error);
      throw error;
    }
  }

  async getDashboards(): Promise<Dashboard[]> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards`);
      return response.json();
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      throw error;
    }
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>): Promise<Dashboard> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards`, {
        method: 'POST',
        body: JSON.stringify(dashboard)
      });
      return response.json();
    } catch (error) {
      console.error('Error creating dashboard:', error);
      throw error;
    }
  }

  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dashboard)
      });
      return response.json();
    } catch (error) {
      console.error('Error updating dashboard:', error);
      throw error;
    }
  }

  async deleteDashboard(id: string): Promise<void> {
    try {
      await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      throw error;
    }
  }

  async updateDashboardWidgets(dashboardId: string, widgets: Partial<Widget>[]): Promise<Widget[]> {
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${dashboardId}/widgets`, {
        method: 'PUT',
        body: JSON.stringify({ widgets })
      });
      return response.json();
    } catch (error) {
      console.error('Error updating dashboard widgets:', error);
      throw error;
    }
  }
}

export const apiService = new ApiServiceImpl(); 