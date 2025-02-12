import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    visualization?: {
      type: string;
      config: any;
    };
    contextData?: any;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  visualization?: {
    type: string;
    config: any;
  };
  contextData?: any;
}

export const chatApi = {
  // Get chat history for a session
  getChatHistory: async (sessionId: string): Promise<ChatMessage[]> => {
    const response = await api.get(`/chat/history/${sessionId}`);
    return response.data;
  },

  // Send a new message
  sendMessage: async (
    sessionId: string,
    message: string,
    dataSource?: string
  ): Promise<ChatResponse> => {
    const response = await api.post('/chat/message', {
      sessionId,
      message,
      dataSource,
    });
    return response.data;
  },
};

export default api; 