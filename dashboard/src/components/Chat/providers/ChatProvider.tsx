import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { openAIService } from '../../../services/openai';
import { apiService } from '../../../services/api';
import type { ChatOptions } from '../../../services/openai';
import type { ChatSession } from '../../../services/api';

interface ChatContextType {
  messages: ChatMessage[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  isGenerating: boolean;
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  regenerateMessage: (message: ChatMessage) => Promise<void>;
  clearChat: () => void;
  createSession: (title?: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  settings: {
    model: ChatOptions['model'];
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
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    streaming: false,
    systemPrompt: 'You are a helpful AI assistant.'
  });

  const selectSession = useCallback(async (sessionId: string) => {
    try {
      setIsLoadingMessages(true);
      setError(null);
      const history = await apiService.getChatHistory(sessionId);
      setMessages(history);
      setActiveSessionId(sessionId);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError(error instanceof Error ? error.message : 'Failed to load chat history');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const createSession = useCallback(async (title?: string) => {
    try {
      setIsLoadingMessages(true);
      setError(null);
      const newSession = await apiService.createChatSession(title);
      setSessions(prev => [newSession, ...prev]);
      await selectSession(newSession.id);
    } catch (error) {
      console.error('Error creating chat session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chat session');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectSession]);

  // Handle restored messages from localStorage
  const handleMessageRestore = useCallback((restoredMessages: ChatMessage[]) => {
    setMessages(restoredMessages);
    // Create a new session with the restored messages
    createSession('Restored Chat').then(() => {
      // Save the restored messages to the new session
      if (activeSessionId) {
        apiService.saveChatHistory(activeSessionId, restoredMessages).catch((error: Error) => {
          console.error('Error saving restored messages:', error);
        });
      }
    });
  }, [createSession, activeSessionId]);

  // Load chat sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoadingSessions(true);
        setError(null);
        const loadedSessions = await apiService.getChatSessions();
        setSessions(loadedSessions);
        
        // If there are sessions and no active session, select the most recent one
        if (loadedSessions.length > 0 && !activeSessionId) {
          await selectSession(loadedSessions[0].id);
        } else if (loadedSessions.length === 0) {
          // If no sessions exist, create a new one
          await createSession('New Chat');
        }
      } catch (error) {
        console.error('Error loading chat sessions:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sessions');
        
        // If we can't load sessions, try to restore from localStorage
        const savedMessages = localStorage.getItem('chatMessages');
        if (savedMessages) {
          try {
            const parsedMessages = JSON.parse(savedMessages);
            if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
              handleMessageRestore(parsedMessages);
            }
          } catch (e) {
            console.error('Error restoring messages from localStorage:', e);
          }
        }
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
  }, []);

  // Refresh sessions periodically
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (!isGenerating && !isLoadingMessages) {  // Don't refresh while generating or loading
        try {
          const loadedSessions = await apiService.getChatSessions();
          setSessions(loadedSessions);
        } catch (error) {
          console.error('Error refreshing chat sessions:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isGenerating, isLoadingMessages]);

  const retryLoad = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      setError(null);
      const loadedSessions = await apiService.getChatSessions();
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
  }, [selectSession]);

  // Save messages to localStorage as backup
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('chatMessages', JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving messages to localStorage:', error);
      }
    }
  }, [messages]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiService.deleteChatSession(sessionId);
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
  }, [sessions, activeSessionId, selectSession]);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeSessionId) {
      // Create a new session if none exists
      await createSession('New Chat');
      if (!activeSessionId) return; // Safety check
    }

    try {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        status: 'complete',
        timestamp: Date.now()
      };
      
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsGenerating(true);

      // Send message to backend
      const response = await apiService.sendMessage(activeSessionId, content);

      // Add assistant's response
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: response.content,
        status: 'complete',
        timestamp: Date.now(),
        metadata: response.metadata ? {
          ...response.metadata,
          tokens: response.metadata.tokens?.total || 0
        } : undefined
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Save messages to server
      await apiService.saveChatHistory(activeSessionId, finalMessages);

      // Update sessions list with latest message
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? { 
              ...session, 
              last_message: assistantMessage.content,
              message_count: finalMessages.length,
              updated_at: new Date().toISOString()
            }
          : session
      ));

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'error',
          content: error instanceof Error ? error.message : 'Failed to send message',
          status: 'error',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [activeSessionId, messages, sessions, createSession]);

  const regenerateMessage = useCallback(async (message: ChatMessage) => {
    if (!activeSessionId) return;

    try {
      setIsGenerating(true);
      const currentMessages = messages;
      const messageIndex = currentMessages.findIndex((m: ChatMessage) => m.id === message.id);
      if (messageIndex === -1) return;

      // Get all messages up to the one being regenerated
      const previousMessages = currentMessages.slice(0, messageIndex);
      
      const response = await openAIService.generateChatCompletion(
        previousMessages,
        {
          model: settings.model,
          temperature: settings.temperature,
          stream: settings.streaming,
          systemPrompt: settings.systemPrompt
        }
      );

      setMessages(prev => [
        ...prev.slice(0, messageIndex),
        response
      ]);

      // Update session
      setSessions(prev => prev.map(session => 
        session.id === activeSessionId 
          ? { 
              ...session, 
              last_message: response.content,
              updated_at: new Date().toISOString()
            }
          : session
      ));
    } catch (error) {
      console.error('Error regenerating message:', error);
      const messageIndex = messages.findIndex((m: ChatMessage) => m.id === message.id);
      
      setMessages(prev => [
        ...prev.slice(0, messageIndex),
        {
          id: Date.now().toString(),
          role: 'error',
          content: 'Sorry, there was an error regenerating the message. Please try again.',
          status: 'error',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [messages, settings, activeSessionId]);

  const clearChat = useCallback(async () => {
    if (activeSessionId) {
      await createSession('New Chat');
    }
  }, [activeSessionId, createSession]);

  const updateSettings = useCallback((newSettings: Partial<ChatContextType['settings']>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessions,
        activeSessionId,
        isGenerating,
        isLoadingSessions,
        isLoadingMessages,
        error,
        sendMessage,
        regenerateMessage,
        clearChat,
        createSession,
        selectSession,
        deleteSession,
        settings,
        updateSettings,
        retryLoad
      }}
    >
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