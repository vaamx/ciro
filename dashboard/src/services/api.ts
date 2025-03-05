import type { ChatMessage, ChatSettings } from '../components/Chat/types';

export interface ChatSession {
  id: string;
  title: string;
  last_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  organization_id: number;
  dashboard_id: string;
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

export interface ChatContext {
  organizationId?: number;
  dashboardId?: string;
}

export interface ApiService {
  getChatSessions: (context?: ChatContext) => Promise<ChatSession[]>;
  createChatSession: (title?: string, context?: ChatContext) => Promise<ChatSession>;
  updateChatSession: (sessionId: string, title: string) => Promise<ChatSession>;
  deleteChatSession: (sessionId: string, context?: ChatContext) => Promise<void>;
  getChatHistory: (sessionId: string, context?: ChatContext) => Promise<ChatMessage[]>;
  saveChatHistory: (sessionId: string, messages: ChatMessage[], context?: ChatContext) => Promise<void>;
  sendMessage: (sessionId: string, message: string, context?: ChatContext) => Promise<ChatResponse>;
  regenerateMessage: (messageId: string) => Promise<{ content: string; metadata?: ChatMetadata }>;
  cancelGeneration?: () => Promise<void>;
  generateChatCompletion: (messages: ChatMessage[], options?: ChatSettings) => Promise<Response>;
  streamChatCompletion: (messages: ChatMessage[], options?: ChatSettings) => Promise<Response>;
  getDashboards: () => Promise<Dashboard[]>;
  createDashboard: (dashboard: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>) => Promise<Dashboard>;
  updateDashboard: (id: string, dashboard: Partial<Dashboard>) => Promise<Dashboard>;
  deleteDashboard: (id: string) => Promise<void>;
  updateDashboardWidgets: (dashboardId: string, widgets: Partial<Widget>[]) => Promise<Widget[]>;
}

class ApiServiceImpl implements ApiService {
  private baseUrl: string;

  constructor() {
    // Use the backend server URL instead of a relative path
    this.baseUrl = 'http://localhost:3001';
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
    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      const error = await response.json().catch(() => ({ message: 'Authentication failed' }));
      localStorage.removeItem('auth_token');
      throw new Error(error.message || 'Authentication failed');
    }

    // For 400 Bad Request errors, provide more detailed error information
    if (response.status === 400) {
      try {
        const errorData = await response.json();
        console.warn('Bad Request Error:', errorData);
        throw new Error(errorData.message || errorData.error || `Bad Request: ${response.statusText}`);
      } catch (jsonError) {
        // If we can't parse the JSON, just use the status text
        throw new Error(`Bad Request: ${response.statusText}`);
      }
    }

    // For other non-OK responses
    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.message || error.error || `Server error: ${response.status} ${response.statusText}`);
      } catch (jsonError) {
        // If we can't parse the JSON, just use the status
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
    }
    
    // Handle authentication token in response headers
    const authHeader = response.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      localStorage.setItem('auth_token', token);
    }
    
    return response;
  }

  async getChatSessions(context?: ChatContext): Promise<ChatSession[]> {
    const params = new URLSearchParams();
    if (context?.organizationId) {
      params.append('organization_id', context.organizationId.toString());
    }
    if (context?.dashboardId) {
      params.append('dashboard_id', context.dashboardId);
    }
    
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions?${params.toString()}`);
    return response.json();
  }

  async createChatSession(title?: string, context?: ChatContext): Promise<ChatSession> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        organization_id: context?.organizationId,
        dashboard_id: context?.dashboardId,
      })
    });
    return response.json();
  }

  async updateChatSession(sessionId: string, title: string): Promise<ChatSession> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify({ title })
    });
    return response.json();
  }

  async deleteChatSession(sessionId: string, context?: ChatContext): Promise<void> {
    const params = new URLSearchParams();
    if (context?.organizationId) {
      params.append('organization_id', context.organizationId.toString());
    }
    if (context?.dashboardId) {
      params.append('dashboard_id', context.dashboardId);
    }

    await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}?${params.toString()}`, {
      method: 'DELETE'
    });
  }

  async getChatHistory(sessionId: string, context?: ChatContext): Promise<ChatMessage[]> {
    if (!sessionId) {
      console.error('Session ID is required for getChatHistory');
      return [];
    }

    const params = new URLSearchParams();
    if (context?.organizationId) {
      params.append('organization_id', context.organizationId.toString());
    }
    if (context?.dashboardId) {
      params.append('dashboard_id', context.dashboardId);
    }

    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages?${params.toString()}`);
      
      // Check if response is OK before trying to parse JSON
      if (!response.ok) {
        console.error(`Failed to get chat history: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Expected array but got:', typeof data);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      // Return empty array instead of throwing to prevent cascading errors
      return [];
    }
  }

  async saveChatHistory(sessionId: string, messages: ChatMessage[], context?: ChatContext): Promise<void> {
    const params = new URLSearchParams();
    if (context?.organizationId) {
      params.append('organization_id', context.organizationId.toString());
    }
    if (context?.dashboardId) {
      params.append('dashboard_id', context.dashboardId);
    }

    await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}/history?${params.toString()}`, {
      method: 'PUT',
      body: JSON.stringify({ messages })
    });
  }

  async sendMessage(sessionId: string, message: string, context?: ChatContext): Promise<ChatResponse> {
    const params = new URLSearchParams();
    if (context?.organizationId) {
      params.append('organization_id', context.organizationId.toString());
    }
    if (context?.dashboardId) {
      params.append('dashboard_id', context.dashboardId);
    }

    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages?${params.toString()}`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.aiMessage?.content) {
        throw new Error('Invalid response format: missing content');
      }

      return {
        content: data.aiMessage.content,
        metadata: {
          model: data.aiMessage.metadata?.model,
          tokens: data.usage,
          suggestions: data.aiMessage.metadata?.suggestions
        }
      };
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

  async generateChatCompletion(messages: ChatMessage[], options?: ChatSettings): Promise<Response> {
    try {
      const defaultOptions: ChatSettings = {
        model: 'gpt-4',
        temperature: 0.7,
        contextLength: 4096,
        streaming: false
      };

      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/completion`, {
        method: 'POST',
        body: JSON.stringify({ 
          messages,
          ...defaultOptions,
          ...options
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate chat completion: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw error;
    }
  }

  async streamChatCompletion(messages: ChatMessage[], options?: ChatSettings): Promise<Response> {
    try {
      const defaultOptions: ChatSettings = {
        model: 'gpt-4',
        temperature: 0.7,
        contextLength: 4096,
        streaming: true
      };

      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/completion/stream`, {
        method: 'POST',
        body: JSON.stringify({ 
          messages,
          ...defaultOptions,
          ...options
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stream chat completion: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error('Error streaming chat completion:', error);
      throw error;
    }
  }

  async getDashboards(): Promise<Dashboard[]> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards`);
    return response.json();
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>): Promise<Dashboard> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards`, {
      method: 'POST',
      body: JSON.stringify(dashboard)
    });
    return response.json();
  }

  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dashboard)
    });
    return response.json();
  }

  async deleteDashboard(id: string): Promise<void> {
    await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${id}`, {
      method: 'DELETE'
    });
  }

  async updateDashboardWidgets(dashboardId: string, widgets: Partial<Widget>[]): Promise<Widget[]> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${dashboardId}/widgets`, {
      method: 'PUT',
      body: JSON.stringify({ widgets })
    });
    return response.json();
  }
}

export const apiService = new ApiServiceImpl(); 