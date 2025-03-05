import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { apiService } from '../../../services/api';
import type { ChatSettings } from '../types';
import type { ChatSession, ChatContext } from '../../../services/api';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useDashboard } from '../../../contexts/DashboardContext';

interface ChatContextType {
  messages: ChatMessage[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  isGenerating: boolean;
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  sendMessage: (content: string, isAssistantMessage?: boolean) => Promise<void>;
  regenerateMessage: (message: ChatMessage) => Promise<void>;
  clearChat: () => void;
  createSession: (title?: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  settings: {
    model: ChatSettings['model'];
    temperature: number;
    streaming: boolean;
    systemPrompt: string;
  };
  updateSettings: (settings: Partial<ChatContextType['settings']>) => void;
  retryLoad: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatContextType['settings']>({
    model: 'gpt-4',
    temperature: 0.7,
    streaming: false,
    systemPrompt: 'You are a helpful AI assistant.'
  });

  const { currentOrganization } = useOrganization();
  const { currentDashboard } = useDashboard();
  const prevOrgId = useRef<number | undefined>();
  const prevDashId = useRef<string | undefined>();

  const getChatContext = useCallback((): ChatContext => ({
    organizationId: currentOrganization?.id,
    dashboardId: currentDashboard?.id,
  }), [currentOrganization?.id, currentDashboard?.id]);

  // Debounced session loading to prevent rate limiting
  const loadSessions = useCallback(async () => {
    try {
      const context = getChatContext();
      
      // Only reload if organization or dashboard has changed
      if (prevOrgId.current === context.organizationId && 
          prevDashId.current === context.dashboardId) {
        return;
      }

      // Clear state when switching dashboards or organizations
      setMessages([]);
      setActiveSessionId(null);
      setSessions([]);
      
      if (!context.organizationId || !context.dashboardId) {
        setIsLoadingSessions(false);
        return;
      }

      setIsLoadingSessions(true);
      setError(null);
      
      try {
        const loadedSessions = await apiService.getChatSessions(context);
        setSessions(loadedSessions);
        
        // Only select a session if we have sessions
        if (loadedSessions && loadedSessions.length > 0) {
          const firstSession = loadedSessions[0];
          
          // Set the active session ID first and wait for state update
          setActiveSessionId(firstSession.id);
          
          // Use a timeout to ensure state is updated before loading history
          setTimeout(async () => {
            try {
              if (firstSession.id) {
                const history = await apiService.getChatHistory(firstSession.id, context);
                setMessages(history);
              }
            } catch (historyError) {
              console.warn('Error loading chat history for session', firstSession.id, historyError);
              setMessages([]);
            }
          }, 100);
        } else {
          // If no sessions exist, create a new one
          try {
            const newSession = await apiService.createChatSession('New Chat', context);
            setSessions([newSession]);
            setActiveSessionId(newSession.id);
            setMessages([]);
          } catch (createError) {
            console.error('Failed to create new session:', createError);
            setError('Failed to create a new chat session');
          }
        }
      } catch (sessionsError) {
        console.error('Error loading chat sessions:', sessionsError);
        setError(sessionsError instanceof Error ? sessionsError.message : 'Failed to load sessions');
      }

      // Update refs
      prevOrgId.current = context.organizationId;
      prevDashId.current = context.dashboardId;
    } catch (error) {
      console.error('Error in loadSessions:', error);
      setError(error instanceof Error ? error.message : 'Failed to load sessions');
      // Clear state on error
      setMessages([]);
      setActiveSessionId(null);
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [getChatContext]);

  // Load sessions when dashboard or organization changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSessions();
    }, 300); // Add 300ms debounce

    return () => clearTimeout(timer);
  }, [currentOrganization?.id, currentDashboard?.id, loadSessions]);

  const selectSession = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      console.error('Cannot select session: No session ID provided');
      return;
    }

    try {
      const context = getChatContext();
      if (!context.organizationId || !context.dashboardId) {
        throw new Error('Organization ID and Dashboard ID are required to select a chat session');
      }

      // Verify the session exists in our current sessions list and matches the current dashboard
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('Chat session not found');
      }

      if (session.organization_id !== context.organizationId || 
          session.dashboard_id !== context.dashboardId) {
        throw new Error('Chat session belongs to a different dashboard');
      }

      // Set the active session ID first
      setActiveSessionId(sessionId);
      setIsLoadingMessages(true);
      setError(null);
      
      // Use a timeout to ensure state is updated before loading history
      setTimeout(async () => {
        try {
          if (sessionId) {
            const history = await apiService.getChatHistory(sessionId, context);
            setMessages(history);
          }
        } catch (historyError) {
          console.warn('Error loading chat history:', historyError);
          // Keep the active session ID but clear messages
          setMessages([]);
        } finally {
          setIsLoadingMessages(false);
        }
      }, 100);
    } catch (error) {
      console.error('Error selecting chat session:', error);
      setError(error instanceof Error ? error.message : 'Failed to select chat session');
      // Don't clear active session on error
      setIsLoadingMessages(false);
    }
  }, [getChatContext, sessions]);

  const createSession = useCallback(async (title?: string) => {
    try {
      const context = getChatContext();
      if (!context.organizationId || !context.dashboardId) {
        throw new Error('Organization ID and Dashboard ID are required to create a chat session');
      }

      setIsLoadingMessages(true);
      setError(null);
      const newSession = await apiService.createChatSession(title, context);
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating chat session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chat session');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [getChatContext]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiService.deleteChatSession(sessionId, getChatContext());
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // If the deleted session was active, select another one
      if (sessionId === activeSessionId) {
        const remainingSessions = sessions.filter(session => session.id !== sessionId);
        if (remainingSessions.length > 0) {
          await selectSession(remainingSessions[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting chat session:', error);
    }
  }, [sessions, activeSessionId, selectSession, getChatContext]);

  const sendMessage = useCallback(async (content: string, isAssistantMessage?: boolean) => {
    if (!activeSessionId) {
      // Create a new session if none exists
      await createSession('New Chat');
      if (!activeSessionId) return; // Safety check
    }

    try {
      const timestamp = Date.now();
      if (isNaN(timestamp)) {
        throw new Error('Invalid time value');
      }

      if (!isAssistantMessage) {
        // Add user message
        const userMessage: ChatMessage = {
          id: timestamp.toString(),
          role: 'user',
          content,
          status: 'complete',
          timestamp
        };
        
        setMessages(prev => [...prev, userMessage]);
        setIsGenerating(true);
        setError(null);
      } else {
        // Add assistant's response
        const assistantMessage: ChatMessage = {
          id: timestamp.toString(),
          role: 'assistant',
          content,
          status: 'complete',
          timestamp,
          metadata: {
            model: 'gpt-4',
            tokens: 0,
          }
        };

        // Keep existing messages and add the assistant's response
        setMessages(prev => [...prev, assistantMessage]);

        // Save messages to server
        const updatedMessages = [...messages, assistantMessage];
        await apiService.saveChatHistory(activeSessionId, updatedMessages, getChatContext());

        // Update sessions list with latest message
        setSessions(prev => prev.map(session => 
          session.id === activeSessionId 
            ? { 
                ...session, 
                last_message: assistantMessage.content,
                message_count: updatedMessages.length,
                updated_at: new Date().toISOString()
              }
            : session
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorTimestamp = Date.now();
      if (isNaN(errorTimestamp)) {
        throw new Error('Invalid time value');
      }

      setMessages(prev => [
        ...prev,
        {
          id: `${errorTimestamp}-error`,
          role: 'error',
          content: error instanceof Error ? error.message : 'Failed to send message',
          status: 'error',
          timestamp: errorTimestamp
        }
      ]);
    } finally {
      if (isAssistantMessage) {
        setIsGenerating(false);
      }
    }
  }, [activeSessionId, messages, sessions, createSession, getChatContext]);

  const value: ChatContextType = {
    messages,
    sessions,
    activeSessionId,
    isGenerating,
    isLoadingSessions,
    isLoadingMessages,
    error,
    sendMessage,
    regenerateMessage: async () => {}, // Implement if needed
    clearChat: () => setMessages([]),
    createSession,
    selectSession,
    deleteSession,
    settings,
    updateSettings: (newSettings: Partial<ChatContextType['settings']>) => setSettings(prev => ({ ...prev, ...newSettings })),
    retryLoad: async () => {
      try {
        setIsLoadingSessions(true);
        setError(null);
        const loadedSessions = await apiService.getChatSessions(getChatContext());
        setSessions(loadedSessions);
        
        if (loadedSessions.length > 0) {
          await selectSession(loadedSessions[0].id);
        }
      } catch (error) {
        console.error('Error retrying session load:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sessions');
      } finally {
        setIsLoadingSessions(false);
      }
    }
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 