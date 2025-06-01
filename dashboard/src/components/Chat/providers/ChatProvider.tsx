import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ChatMessage, ChatSettings } from '../types';
import { apiService } from '../../../services/api';
import type { ChatSession } from '../../../services/api';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useDashboard } from '../../../contexts/DashboardContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { ChatContext as ApiChatContext } from '../../../services/api';
import { useDocumentState } from '../hooks/useDocumentState';
import { eventEmitter, EventType } from '../../../services/events';
import { emergencyStorageCleanup } from '../../../services/chat-recovery';

// Constants
// Removed const COMPONENT_NAME = 'ChatProvider';

interface ChatContextType {
  messages: ChatMessage[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  isGenerating: boolean;
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  sendMessage: (content: any, isAssistantMessage?: boolean) => Promise<void>;
  regenerateMessage: (message: ChatMessage) => Promise<void>;
  clearChat: () => void;
  createSession: (title?: string, skipWelcomeMessage?: boolean) => Promise<ChatSession>;
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
  createNewSessionImmediately: (forceCreate?: boolean, skipWelcomeMessage?: boolean) => Promise<ChatSession | null>;
  // Emergency access functions - only for critical recovery
  _emergency: {
    setSessions: (sessions: ChatSession[]) => void;
    setActiveSessionId: (id: string | null) => void;
    setMessages: (messages: ChatMessage[]) => void;
    setIsLoadingSessions: (loading: boolean) => void;
    setIsLoadingMessages: (loading: boolean) => void;
  };
}

export const ChatContext = createContext<ChatContextType>({
  messages: [],
  sessions: [],
  activeSessionId: null,
  isGenerating: false,
  isLoadingSessions: false,
  isLoadingMessages: false,
  error: null,
  sendMessage: async () => { 
    console.error('ChatContext not initialized: sendMessage');
  },
  regenerateMessage: async () => {
    console.error('ChatContext not initialized: regenerateMessage');
  },
  clearChat: () => {
    console.error('ChatContext not initialized: clearChat');
  },
  createSession: async () => {
    console.error('ChatContext not initialized: createSession');
    throw new Error('ChatContext not initialized');
  },
  selectSession: async () => {
    console.error('ChatContext not initialized: selectSession');
  },
  deleteSession: async () => {
    console.error('ChatContext not initialized: deleteSession');
  },
  settings: {
    model: 'gpt-4',
    temperature: 0.7,
    streaming: false,
    systemPrompt: 'You are a helpful AI assistant.'
  },
  updateSettings: () => {
    console.error('ChatContext not initialized: updateSettings');
  },
  retryLoad: async () => {
    console.error('ChatContext not initialized: retryLoad');
  },
  createNewSessionImmediately: async () => {
    console.error('ChatContext not initialized: createNewSessionImmediately');
    return null;
  },
  _emergency: {
    setSessions: () => {
      console.error('ChatContext not initialized: _emergency.setSessions');
    },
    setActiveSessionId: () => {
      console.error('ChatContext not initialized: _emergency.setActiveSessionId');
    },
    setMessages: () => {
      console.error('ChatContext not initialized: _emergency.setMessages');
    },
    setIsLoadingSessions: () => {
      console.error('ChatContext not initialized: _emergency.setIsLoadingSessions');
    },
    setIsLoadingMessages: () => {
      console.error('ChatContext not initialized: _emergency.setIsLoadingMessages');
    }
  }
});

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatContextType['settings']>({
    model: 'gpt-4',
    temperature: 0.7,
    streaming: false,
    systemPrompt: 'You are a helpful AI assistant.'
  });
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [sessionCache, setSessionCache] = useState<Record<string, ChatSession[]>>({});
  const [cacheTimestamp, setCacheTimestamp] = useState<Record<string, number>>({});
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({});
  
  // Track context version for detecting context changes during operations
  const [contextVersion, setContextVersion] = useState(0);
  const documentState = useDocumentState();
  
  // State machine for tracking complex operations
  const [operationState, setOperationState] = useState<{
    type: 'idle' | 'loading-sessions' | 'creating-session' | 'selecting-session' | 'deleting-session' | 'context-switch' | 'message-sending';
    inProgress: boolean;
    operationId?: string;
    startTime: number;
    contextVersionAtStart: number;
  }>({
    type: 'idle',
    inProgress: false,
    startTime: 0,
    contextVersionAtStart: 0
  });
  
  // Track if a session creation is in progress to prevent duplicates (legacy, replacing with mutex)
  const sessionCreationInProgress = useRef(false);
  
  // Constants moved up for visibility and to resolve linter errors
  const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes
  const MIN_LOAD_INTERVAL = 3000; // Reduced from 10 seconds to 3 seconds for better responsiveness
  const MAX_RETRY_COUNT = 3; // Reduced from 5 to 3 for faster failure detection

  // Function to check if cache is valid, also moved up
  const isCacheValid = (key: string): boolean => {
    const timestamp = cacheTimestamp[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_EXPIRATION;
  };
  
  // Helper function to generate a unique title for new chat sessions
  const generateUniqueTitle = (): string => {
    return `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
  
  // Create refs for tracking previous organization and dashboard IDs
  const prevOrgId = useRef<number | undefined>(undefined);
  const prevDashboardId = useRef<string | undefined>(undefined);
  
  // Helper functions (not needing useCallback as they don't depend on component scope beyond constants)
  const detectAnalyticalQuery = (query: string): boolean => {
    if (typeof query !== 'string') return false;
    const analyticalKeywords = [
      'analyze', 'analysis', 'calculate', 'computation', 'trend',
      'correlation', 'distribution', 'average', 'mean', 'median',
      'sum', 'total', 'count', 'aggregate', 'group by',
      'filter', 'segment', 'breakdown', 'percentage', 'ratio',
      'metric', 'kpi', 'measure', 'visualize', 'visualization',
      'chart', 'graph', 'plot', 'display', 'compare'
    ];
    const normalizedQuery = query.toLowerCase();
    return analyticalKeywords.some(keyword => normalizedQuery.includes(keyword));
  };

  const { isLoading: isLoadingAuth } = useAuth();
  const { currentOrganization, isLoading: isLoadingOrg } = useOrganization();
  const { currentDashboard } = useDashboard();

  const getChatContext = useCallback((): ApiChatContext => {
    return {
      organization_id: currentOrganization?.id,
      dashboard_id: currentDashboard?.id,
    };
  }, [currentOrganization, currentDashboard]);

  const getActiveDataSourceIds = useCallback((): string[] => {
    console.warn('getActiveDataSourceIds is a placeholder and needs a real implementation.');
    return [];
  }, []);

  const fetchSessions = useCallback(async (orgIdToFetch?: number, dashboardIdToFetch?: string, attempt = 1) => {
    const effectiveOrgId = orgIdToFetch ?? currentOrganization?.id;
    const effectiveDashboardId = dashboardIdToFetch;

    console.log(`[ChatProvider] fetchSessions called for effectiveOrgId: ${effectiveOrgId}, effectiveDashboardId: ${effectiveDashboardId}, attempt: ${attempt}`);
    if (operationState.inProgress && operationState.type === 'loading-sessions') {
      console.warn('[ChatProvider] fetchSessions: Already loading sessions.');
      return;
    }

    if (!effectiveOrgId) {
      console.warn('[ChatProvider] fetchSessions: No organization ID available. Clearing sessions and returning.');
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setIsLoadingSessions(false);
      setError('No organization selected to load chat sessions.');
      return;
    }

    const operationId = `load-sessions-${Date.now()}`;
    setOperationState({ type: 'loading-sessions', inProgress: true, operationId, startTime: Date.now(), contextVersionAtStart: contextVersion });
    setIsLoadingSessions(true);
    setError(null);
    setLastLoadTime(Date.now());

    try {
      const cacheKey = `${effectiveOrgId}-${effectiveDashboardId || 'global'}`;
      if (isCacheValid(cacheKey) && sessionCache[cacheKey]) {
        setSessions(sessionCache[cacheKey]);
        if (sessionCache[cacheKey].length > 0 && !activeSessionId) {
          // await selectSession(sessionCache[cacheKey][0].id); // selectSession will be defined later
        }
        setIsLoadingSessions(false);
        setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });
        console.log(`[ChatProvider] Loaded sessions from cache for key: ${cacheKey}`);
        return;
      }

      const fetchedSessions = await apiService.getChatSessions(getChatContext());
      setSessions(fetchedSessions);
      setSessionCache(prev => ({ ...prev, [cacheKey]: fetchedSessions }));
      setCacheTimestamp(prev => ({ ...prev, [cacheKey]: Date.now() }));

      // Always complete the operation state first to prevent timeouts
      setIsLoadingSessions(false);
      setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });

      // After successfully loading sessions, select the first one if none is active
      if (fetchedSessions.length > 0 && !activeSessionId) {
        try {
          await selectSession(fetchedSessions[0].id);
        } catch (selectError) {
          console.error('Error selecting first session:', selectError);
          // Don't throw here, just log - session loading was successful
        }
      } else if (fetchedSessions.length === 0 && !activeSessionId) {
        try {
          await createNewSessionImmediately(false, false);
        } catch (createError) {
          console.error('Error creating new session:', createError);
          // Don't throw here, just log - session loading was successful
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      if (attempt < MAX_RETRY_COUNT) {
        console.log(`Retrying fetchSessions, attempt ${attempt + 1}`);
        setTimeout(() => fetchSessions(effectiveOrgId, effectiveDashboardId, attempt + 1), 2000 * attempt);
      } else {
        setError(`Failed to load sessions after ${MAX_RETRY_COUNT} attempts.`);
        // Make sure we always clear the loading state even on failure
        setIsLoadingSessions(false);
        setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });
      }
    } finally {
      // Only reset loading state if this was the final attempt or there was no error
      if (attempt >= MAX_RETRY_COUNT || !(error && attempt < MAX_RETRY_COUNT)) {
        setIsLoadingSessions(false);
        setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });
      }
    }
  }, [currentOrganization, currentDashboard, apiService, getChatContext, sessionCache, cacheTimestamp, activeSessionId, contextVersion, error, operationState.inProgress, operationState.type]);

  const selectSession = useCallback(async (sessionId: string) => {
    console.log(`[ChatProvider] selectSession called for sessionId: ${sessionId}`);
    if (operationState.inProgress && operationState.type === 'selecting-session') {
      console.warn('[ChatProvider] selectSession: Already selecting a session.');
      return;
    }
    if (!currentOrganization?.id) {
      console.warn('[ChatProvider] selectSession: No organization ID available.');
      setError('No organization selected to select chat session.');
      return;
    }

    const operationId = `select-session-${Date.now()}`;
    setOperationState({ type: 'selecting-session', inProgress: true, operationId, startTime: Date.now(), contextVersionAtStart: contextVersion });
    setError(null);

    try {
      // Strategy 1: Try memory cache first (instant response)
      if (sessionMessages[sessionId]) {
        console.log(`[ChatProvider] Loaded messages for session ${sessionId} from memory cache (instant)`);
        setMessages(sessionMessages[sessionId]);
        setActiveSessionId(sessionId);
        setIsLoadingMessages(false);
        setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });
        
        // Optional: Refresh from API in background to ensure we have latest messages
        setTimeout(async () => {
          try {
            const freshMessages = await apiService.getChatHistory(sessionId, getChatContext());
            if (freshMessages.length !== sessionMessages[sessionId].length) {
              console.log(`[ChatProvider] Background refresh found ${freshMessages.length - sessionMessages[sessionId].length} new messages`);
              setMessages(freshMessages);
              setSessionMessages(prev => ({ ...prev, [sessionId]: freshMessages }));
              localStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(freshMessages));
            }
          } catch (backgroundError) {
            console.warn('Background message refresh failed:', backgroundError);
          }
        }, 100);
        
        return;
      }

      // Strategy 2: Try localStorage cache (fast response)
      const storedMessages = localStorage.getItem(`chat_messages_${sessionId}`);
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages) as ChatMessage[];
          console.log(`[ChatProvider] Loaded messages for session ${sessionId} from localStorage (fast)`);
          setMessages(parsedMessages);
          setSessionMessages(prev => ({ ...prev, [sessionId]: parsedMessages }));
          setActiveSessionId(sessionId);
          setIsLoadingMessages(false);
          setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });
          
          // Fetch fresh messages from API in background to sync any new messages
          setTimeout(async () => {
            try {
              console.log(`[ChatProvider] Background syncing messages for session ${sessionId}`);
              const freshMessages = await apiService.getChatHistory(sessionId, getChatContext());
              if (freshMessages.length > parsedMessages.length) {
                console.log(`[ChatProvider] Background sync found ${freshMessages.length - parsedMessages.length} new messages`);
                setMessages(freshMessages);
                setSessionMessages(prev => ({ ...prev, [sessionId]: freshMessages }));
                localStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(freshMessages));
              }
            } catch (backgroundError) {
              console.warn('Background message sync failed:', backgroundError);
            }
          }, 200);
          
          return;
        } catch (parseError) {
          console.error(`Error parsing cached messages for session ${sessionId}:`, parseError);
          localStorage.removeItem(`chat_messages_${sessionId}`);
        }
      }

      // Strategy 3: No cache available, show loading and fetch from API
      console.log(`[ChatProvider] No cache available for session ${sessionId}, fetching from API`);
      setIsLoadingMessages(true);
      setActiveSessionId(sessionId); // Set session ID immediately to show UI response
      setMessages([]); // Clear messages while loading
      
      const fetchedMessages = await apiService.getChatHistory(sessionId, getChatContext());
      console.log(`[ChatProvider] Fetched ${fetchedMessages.length} messages for session ${sessionId} from API`);
      
      setMessages(fetchedMessages);
      setSessionMessages(prev => ({ ...prev, [sessionId]: fetchedMessages }));
      
      try {
        localStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(fetchedMessages));
      } catch (storageError) {
        console.error(`Error saving messages to localStorage for session ${sessionId}:`, storageError);
      }
      
    } catch (err) {
      console.error('Error selecting session or fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages for the session.');
    } finally {
      setIsLoadingMessages(false);
      setOperationState({ type: 'idle', inProgress: false, startTime: 0, contextVersionAtStart: contextVersion });
    }
  }, [currentOrganization, getChatContext, apiService, contextVersion, operationState.inProgress, operationState.type, sessionMessages]);
  
  const createNewSessionImmediately = useCallback(async (forceCreate: boolean = false, skipWelcomeMessage: boolean = false): Promise<ChatSession | null> => {
    console.log(`[ChatProvider] createNewSessionImmediately called. forceCreate: ${forceCreate}, skipWelcomeMessage: ${skipWelcomeMessage}`);
    if (!currentOrganization?.id) {
      console.error('[ChatProvider] createNewSessionImmediately: No organization selected.');
      setError('No organization selected. Please select an organization to create a new chat session.');
      return null;
    }
    const dashboardIdForSession = currentDashboard?.id;

    if (sessionCreationInProgress.current && !forceCreate) {
        console.warn('[ChatProvider] createNewSessionImmediately: Session creation already in progress and not forcing.');
        return null;
    }

    const title = generateUniqueTitle();
    console.log(`Creating chat session with title "${title}" (immediately)`);

    const contextApiChat: ApiChatContext = {
      organization_id: currentOrganization.id,
      dashboard_id: dashboardIdForSession,
    };
    const dataSourceIds = getActiveDataSourceIds();
    const sessionData = {
      title,
      organization_id: contextApiChat.organization_id,
      dashboard_id: contextApiChat.dashboard_id,
      dataSourceIds: dataSourceIds,
    };

    const originalSessionCreationInProgress = sessionCreationInProgress.current;
    sessionCreationInProgress.current = true;
    setIsLoadingSessions(true); // Should be true during creation

    try {
      const newSession = await apiService.createChatSession(sessionData);
      console.log(`Successfully created session (immediately) with ID: ${newSession.id}`);
      
      localStorage.setItem(`chat_session_${newSession.id}`, JSON.stringify(newSession));
      setSessions(prevSessions => [newSession, ...prevSessions]);
      setSessionCache(prev => ({...prev, [`${currentOrganization.id}-${dashboardIdForSession || 'global'}`]: [newSession, ...(prev[`${currentOrganization.id}-${dashboardIdForSession || 'global'}`] || [])]}));

      if (!skipWelcomeMessage) {
        const welcomeMessage: ChatMessage = {
          id: `welcome-${newSession.id}-${Date.now()}`,
          role: 'assistant',
          content: 'Welcome! How can I help you today?',
          timestamp: Date.now(),
          status: 'complete',
          metadata: { model: settings.model, welcome: true }
        };
        setMessages([welcomeMessage]);
        localStorage.setItem(`chat_messages_${newSession.id}`, JSON.stringify([welcomeMessage]));
        setSessionMessages(prevState => ({ ...prevState, [newSession.id]: [welcomeMessage] }));
      } else {
          setMessages([]); // Clear messages if skipping welcome
          localStorage.removeItem(`chat_messages_${newSession.id}`);
          setSessionMessages(prevState => ({ ...prevState, [newSession.id]: [] }));
      }
      
      setActiveSessionId(newSession.id);
      return newSession;
    } catch (error) {
      console.error('Error creating session (immediately):', error);
      setError(error instanceof Error ? error.message : 'Failed to create session immediately');
      return null;
    } finally {
      setIsLoadingSessions(false); // Reset loading state
      if (forceCreate || !originalSessionCreationInProgress) {
        sessionCreationInProgress.current = false;
      }
    }
  }, [currentOrganization, currentDashboard, apiService, settings.model, getActiveDataSourceIds, generateUniqueTitle, contextVersion, setSessionMessages, setSessionCache]);

  const createSession = useCallback(async (title?: string, skipWelcomeMessage: boolean = false): Promise<ChatSession> => {
    console.log(`[ChatProvider] createSession called with title: ${title}, skipWelcomeMessage: ${skipWelcomeMessage}`);
    
    if (!currentOrganization?.id) {
      console.error('[ChatProvider] createSession: No organization selected.');
      setError('No organization selected. Please select an organization to create a new chat session.');
      throw new Error('No organization selected. Please select an organization first.');
    }
    const dashboardIdForSession = currentDashboard?.id;
    
    if (sessionCreationInProgress.current) {
      console.log('Session creation in progress, calling createNewSessionImmediately with force: true');
      const newSession = await createNewSessionImmediately(true, skipWelcomeMessage);
      if (!newSession) {
        throw new Error('Failed to create new session when another was in progress');
      }
      return newSession;
    }
    
    if (!title) {
      title = generateUniqueTitle();
    }
    
    console.log(`Creating chat session with title "${title}"`);
    
    const contextApiChat: ApiChatContext = {
      organization_id: currentOrganization.id,
      dashboard_id: dashboardIdForSession
    };
    
    const dataSourceIds = getActiveDataSourceIds();
    
    const sessionData = {
      title,
      organization_id: contextApiChat.organization_id,
      dashboard_id: contextApiChat.dashboard_id,
      dataSourceIds: dataSourceIds
    };
    
    sessionCreationInProgress.current = true;
    setIsLoadingSessions(true);
    
    try {
      console.log('Session create payload:', sessionData);
      
      const newSession = await apiService.createChatSession(sessionData);
      console.log(`Successfully created session with ID: ${newSession.id}`);
      
      try {
        localStorage.setItem(`chat_session_${newSession.id}`, JSON.stringify(newSession));
      } catch (storageError) {
        if (storageError instanceof DOMException && 
            (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
          console.warn('Storage full when creating session. Attempting cleanup...');
          emergencyStorageCleanup();
        }
        console.error(`Error saving session to localStorage: ${storageError}`);
      }
      
      setSessions(prevSessions => [newSession, ...prevSessions]);
      setSessionCache(prev => ({...prev, [`${currentOrganization.id}-${dashboardIdForSession || 'global'}`]: [newSession, ...(prev[`${currentOrganization.id}-${dashboardIdForSession || 'global'}`] || [])]}));
      
      if (!skipWelcomeMessage) {
        const welcomeMessage: ChatMessage = {
          id: `welcome-${newSession.id}-${Date.now()}`,
          role: 'assistant',
          content: 'Welcome! How can I help you today?',
          timestamp: Date.now(),
          status: 'complete',
          metadata: {
            model: settings.model,
            welcome: true,
          }
        };
        setMessages([welcomeMessage]);
        try {
          localStorage.setItem(`chat_messages_${newSession.id}`, JSON.stringify([welcomeMessage]));
        } catch (storageError) {
          console.error(`Error saving welcome message to localStorage: ${storageError}`);
        }
        setSessionMessages(prevState => ({
          ...prevState,
          [newSession.id]: [welcomeMessage]
        }));
      } else {
        setMessages([]);
        localStorage.removeItem(`chat_messages_${newSession.id}`);
        setSessionMessages(prevState => ({ ...prevState, [newSession.id]: [] }));
      }
      setActiveSessionId(newSession.id);
      return newSession;
    } catch (error) {
      console.error('Error creating session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create session');
      throw error;
    } finally {
      setIsLoadingSessions(false);
      sessionCreationInProgress.current = false;
    }
  }, [currentOrganization, currentDashboard, apiService, settings.model, getActiveDataSourceIds, generateUniqueTitle, contextVersion, createNewSessionImmediately, setSessionMessages, setSessionCache]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiService.deleteChatSession(sessionId, getChatContext());
      
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      const cacheKey = `${currentOrganization?.id}-${currentDashboard?.id || 'global'}`;
      setSessionCache(prev => ({ ...prev, [cacheKey]: (prev[cacheKey] || []).filter(s => s.id !== sessionId)}));
      setSessionMessages(prev => { const newState = {...prev}; delete newState[sessionId]; return newState; });
      localStorage.removeItem(`chat_messages_${sessionId}`);
      localStorage.removeItem(`chat_session_${sessionId}`);
      
      const remainingSessions = sessions.filter(session => session.id !== sessionId);
      
      if (sessionId === activeSessionId) {
        if (remainingSessions.length > 0) {
          await selectSession(remainingSessions[0].id);
          if (window.notificationContext) {
            window.notificationContext.showNotification({
              type: 'success',
              message: 'Chat deleted successfully'
            });
          }
        } else {
          setActiveSessionId(null);
          setMessages([]);
          if (sessionCreationInProgress.current) {
            console.log("Session creation already in progress, skipping duplicate creation after delete");
            return;
          }
          try {
            const newSession = await createNewSessionImmediately(false, true); // Create new, non-forced, skip welcome
            if (newSession) {
              console.log("Created new session after deleting last session:", newSession.id);
              if (window.notificationContext) {
                window.notificationContext.showNotification({
                  type: 'success',
                  message: 'Chat deleted. Created a new chat for you.'
                });
              }
            }
          } catch (err) {
            console.error("Failed to create new session after deletion:", err);
          }
        }
      } else {
        if (window.notificationContext) {
          window.notificationContext.showNotification({
            type: 'success',
            message: 'Chat deleted successfully'
          });
        }
      }
      documentState.clearDocumentStateForSession(sessionId);
    } catch (error) {
      console.error('Error deleting chat session:', error);
      if (window.notificationContext) {
        window.notificationContext.showNotification({
          type: 'error',
          message: 'Failed to delete chat. Please try again.'
        });
      }
    }
  }, [sessions, activeSessionId, selectSession, getChatContext, createNewSessionImmediately, documentState, currentOrganization, currentDashboard, setSessionCache, setSessionMessages]);

  const sendMessage = useCallback(
    async (content: any, isAssistantMessage = false) => {
      setError(null);
      
    let currentActiveSessionId = activeSessionId; // Capture activeSessionId at the start
    if (!currentActiveSessionId) {
        try {
          const newSession = await createNewSessionImmediately(true, true);
          if (!newSession) {
            setError('Failed to create a new chat session to send the message.');
            return;
          }
          currentActiveSessionId = newSession.id; // Update if new session was created
        } catch (error) {
          console.error('Error creating session for message:', error);
          setError('Failed to create a new chat session');
          return;
        }
      }
      // Ensure we use the potentially updated currentActiveSessionId
      const finalActiveSessionId = currentActiveSessionId;
      if (!finalActiveSessionId) {
        setError('No active session ID available to send message.');
        return;
      }
      
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: typeof content === 'string' ? content : JSON.stringify(content),
        timestamp: Date.now(),
        status: 'complete'
      };

      setMessages(prev => [...prev, userMessage]);
      setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: [...(prev[finalActiveSessionId] || []), userMessage]}));
      
      // Always create a loading message immediately to show feedback to the user
      const loadingMessageId = `assistant-${Date.now()}`;
      const loadingMessage: ChatMessage = {
        id: loadingMessageId,
        role: 'assistant',
        content: "I'm analyzing your data and preparing a response...",
        timestamp: Date.now(),
        status: 'loading',
        metadata: {}
      };
      
      console.log('[ChatProvider] Creating initial loading message:', loadingMessageId);
      setMessages(prev => [...prev, loadingMessage]);
      setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: [...(prev[finalActiveSessionId] || []), loadingMessage]}));
      
      try {
        setIsGenerating(true);
        const isAnalyticalQuery = detectAnalyticalQuery(typeof content === 'string' ? content : '');
        let response: any;
        
        if (isAnalyticalQuery) {
          console.log('Detected analytical query, using dual-path API');
          const activeDataSourceIds = getActiveDataSourceIds();
          const options = {
            dataVisualization: true,
            includeGeneratedCode: true,
            streaming: settings.streaming
          };
          
          try {
            if (settings.streaming) {
              const streamResponse = await apiService.streamDualPathQuery(content, activeDataSourceIds, options);
              const reader = streamResponse.body?.getReader();
              if (reader) {
                const assistantMessageId = `assistant-${Date.now()}`;
                const initialAssistantMessage: ChatMessage = {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: '',
                  timestamp: Date.now(),
                  status: 'loading',
                  metadata: {
                    isDualPathResponse: true,
                    isStreaming: true
                  }
                };
                setMessages(prev => [...prev, initialAssistantMessage]);
                setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: [...(prev[finalActiveSessionId] || []), initialAssistantMessage]}));
                
                let accumulatedContent = '';
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = new TextDecoder().decode(value);
                    accumulatedContent += chunk;
                    const updatedMessage: ChatMessage = {
                      ...initialAssistantMessage,
                      content: accumulatedContent,
                      status: 'loading'
                    };
                    setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? updatedMessage : msg));
                    setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: prev[finalActiveSessionId].map(m => m.id === assistantMessageId ? updatedMessage : m)}));
                  }
                  const finalMessage: ChatMessage = {
                    ...initialAssistantMessage,
                    content: accumulatedContent,
                    status: 'complete'
                  };
                  setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? finalMessage : msg));
                  setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: prev[finalActiveSessionId].map(m => m.id === assistantMessageId ? finalMessage : m)}));
                } catch (streamError) {
                  console.error('Error processing stream:', streamError);
                  const errorMessage: ChatMessage = {
                    ...initialAssistantMessage,
                    content: 'Error processing response stream',
                    status: 'error'
                  };
                  setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? errorMessage : msg));
                  setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: prev[finalActiveSessionId].map(m => m.id === assistantMessageId ? errorMessage : m)}));
                } finally {
                  reader.releaseLock();
                }
              }
            } else {
              response = await apiService.processDualPathQuery(content, activeDataSourceIds, options);
              const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: JSON.stringify(response),
                timestamp: Date.now(),
                status: 'complete',
                metadata: {
                  isDualPathResponse: true,
                  routingPath: response.routing.path,
                  routingConfidence: response.routing.confidence
                }
              };
              setMessages(prev => [...prev, assistantMessage]);
              setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: [...(prev[finalActiveSessionId] || []), assistantMessage]}));
            }
          } catch (dualPathError) {
            // Fallback to regular ChatService if dual-path fails
            console.warn('Dual-path API failed, falling back to ChatSessions endpoint using fetch', dualPathError);
            showToast({
              title: 'Fallback Active',
              description: 'Using standard chat session endpoint (via fetch) due to a dual-path API issue.',
              status: 'warning',
              duration: 5000,
            });

            // Construct the payload for AddMessagesToHistoryDto
            const addMessagesDto: { messages: ChatMessage[] } = { messages: [userMessage] };
            let aiMessageContent: string | null = null;

            try {
              // Get the auth token for the fallback request
              const token = localStorage.getItem('auth_token');
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
              };
              
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }

              const response = await fetch(
                `/api/chat/sessions/${finalActiveSessionId}/messages`, // Assuming /api is the base
                {
                  method: 'POST',
                  headers,
                  credentials: 'include', // Include credentials for CORS
                  body: JSON.stringify(addMessagesDto),
                }
              );

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Fallback API request failed with status ${response.status}: ${errorText}`);
              }

              const sessionData = await response.json(); // Parse JSON response
              console.log('[ChatProvider] Fallback response received:', sessionData);

              if (sessionData && sessionData.metadata && Array.isArray(sessionData.metadata.messages) && sessionData.metadata.messages.length > 0) {
                console.log('[ChatProvider] Messages in response:', sessionData.metadata.messages);
                const lastMessage = sessionData.metadata.messages[sessionData.metadata.messages.length - 1];
                console.log('[ChatProvider] Last message:', lastMessage);
                if (lastMessage && lastMessage.role === 'assistant') {
                  aiMessageContent = lastMessage.content;
                  console.log('[ChatProvider] Extracted AI content:', aiMessageContent);
                } else {
                  console.error("Last message not from assistant or malformed in fallback response:", lastMessage, sessionData.metadata.messages);
                  aiMessageContent = "Error: Could not retrieve valid AI response from fallback.";
                }
              } else {
                console.error("Invalid or empty messages array in fallback response:", sessionData);
                aiMessageContent = "Error: Invalid response data from server in fallback.";
              }
            } catch (fetchError) {
              console.error("Error during fallback fetch operation:", fetchError);
              aiMessageContent = "Error: Network request failed during fallback.";
            }

            // Create assistant message from fallback response - but only if we have content
            if (aiMessageContent && aiMessageContent.trim().length > 0) {
              console.log('[ChatProvider] Creating assistant message with content:', aiMessageContent);
              
              // Update the existing loading message instead of creating a new one
              setMessages(prev => {
                const existingLoadingIndex = prev.findIndex(m => 
                  m.role === 'assistant' && m.status === 'loading' && m.id === loadingMessageId
                );
                
                if (existingLoadingIndex !== -1) {
                  console.log('[ChatProvider] Updating existing loading message with fallback response:', loadingMessageId);
                  const updatedMessage: ChatMessage = {
                    ...prev[existingLoadingIndex],
                    content: aiMessageContent,
                    status: 'complete',
                    metadata: { isFallbackResponse: true }
                  };
                  const newMessages = [...prev];
                  newMessages[existingLoadingIndex] = updatedMessage;
                  return newMessages;
                } else {
                  console.log('[ChatProvider] Loading message not found, appending fallback message');
                  const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: aiMessageContent,
                    timestamp: Date.now(),
                    status: 'complete',
                    metadata: { isFallbackResponse: true }
                  };
                  return [...prev, assistantMessage];
                }
              });
              
              setSessionMessages(prev => {
                const sessionMsgs = prev[finalActiveSessionId] || [];
                const existingLoadingIndex = sessionMsgs.findIndex(m => 
                  m.role === 'assistant' && m.status === 'loading' && m.id === loadingMessageId
                );
                
                if (existingLoadingIndex !== -1) {
                  const updatedMessage: ChatMessage = {
                    ...sessionMsgs[existingLoadingIndex],
                    content: aiMessageContent,
                    status: 'complete',
                    metadata: { isFallbackResponse: true }
                  };
                  const newSessionMessages = [...sessionMsgs];
                  newSessionMessages[existingLoadingIndex] = updatedMessage;
                  return { ...prev, [finalActiveSessionId]: newSessionMessages };
                } else {
                  const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: aiMessageContent,
                    timestamp: Date.now(),
                    status: 'complete',
                    metadata: { isFallbackResponse: true }
                  };
                  return { 
                    ...prev, 
                    [finalActiveSessionId]: [...sessionMsgs, assistantMessage]
                  };
                }
              });
            } else {
              console.error('[ChatProvider] No valid AI content to create message with. aiMessageContent:', aiMessageContent);
              // Update loading message to show error
              setMessages(prev => {
                const existingLoadingIndex = prev.findIndex(m => 
                  m.role === 'assistant' && m.status === 'loading' && m.id === loadingMessageId
                );
                
                if (existingLoadingIndex !== -1) {
                  const errorMessage: ChatMessage = {
                    ...prev[existingLoadingIndex],
                    content: 'Error: No valid response received from server',
                    status: 'error',
                    metadata: { isFallbackResponse: true, error: true }
                  };
                  const newMessages = [...prev];
                  newMessages[existingLoadingIndex] = errorMessage;
                  return newMessages;
                }
                return prev;
              });
            }
          }
        } else {
          response = await apiService.sendMessage(
            finalActiveSessionId,
            typeof content === 'string' ? content : JSON.stringify(content),
            getChatContext(),
            {
              streaming: settings.streaming,
              role: isAssistantMessage ? 'assistant' : 'user'
            }
          );
          
          console.log('[ChatProvider] API response received:', response);
          
          // Check if response has valid content
          if (!response || !response.content || response.content.trim() === '') {
            console.warn('[ChatProvider] Empty or invalid response received:', response);
            
            // Update loading message to show error
            setMessages(prev => {
              const existingLoadingIndex = prev.findIndex(m => 
                m.role === 'assistant' && m.status === 'loading' && m.id === loadingMessageId
              );
              
              if (existingLoadingIndex !== -1) {
                const errorMessage: ChatMessage = {
                  ...prev[existingLoadingIndex],
                  content: 'Error: Empty response received from server',
                  status: 'error',
                  metadata: { error: true, emptyResponse: true }
                };
                const newMessages = [...prev];
                newMessages[existingLoadingIndex] = errorMessage;
                return newMessages;
              }
              return prev;
            });
            return;
          }
          
          // Update the existing loading message instead of creating a new one
          setMessages(prev => {
            const existingLoadingIndex = prev.findIndex(m => 
              m.role === 'assistant' && m.status === 'loading' && m.id === loadingMessageId
            );
            
            if (existingLoadingIndex !== -1) {
              console.log('[ChatProvider] Updating existing loading message:', loadingMessageId);
              const updatedMessage: ChatMessage = {
                ...prev[existingLoadingIndex],
                content: response.content || '',
                status: 'complete',
                metadata: response.metadata || {}
              };
              const newMessages = [...prev];
              newMessages[existingLoadingIndex] = updatedMessage;
              return newMessages;
            } else {
              console.log('[ChatProvider] Loading message not found, appending new message');
              const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.content || '',
                timestamp: Date.now(),
                status: 'complete',
                metadata: response.metadata || {}
              };
              return [...prev, assistantMessage];
            }
          });
          
          setSessionMessages(prev => {
            const sessionMsgs = prev[finalActiveSessionId] || [];
            const existingLoadingIndex = sessionMsgs.findIndex(m => 
              m.role === 'assistant' && m.status === 'loading' && m.id === loadingMessageId
            );
            
            if (existingLoadingIndex !== -1) {
              const updatedMessage: ChatMessage = {
                ...sessionMsgs[existingLoadingIndex],
                content: response.content || '',
                status: 'complete',
                metadata: response.metadata || {}
              };
              const newSessionMessages = [...sessionMsgs];
              newSessionMessages[existingLoadingIndex] = updatedMessage;
              return { ...prev, [finalActiveSessionId]: newSessionMessages };
            } else {
              const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.content || '',
                timestamp: Date.now(),
                status: 'complete',
                metadata: response.metadata || {}
              };
              return { 
                ...prev, 
                [finalActiveSessionId]: [...sessionMsgs, assistantMessage]
              };
            }
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message. Please try again later.');
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: 'Failed to send message. Please try again later.',
          timestamp: Date.now(),
          status: 'error'
        };
        setMessages(prev => [...prev, errorMessage]);
        setSessionMessages(prev => ({ ...prev, [finalActiveSessionId]: [...(prev[finalActiveSessionId] || []), errorMessage]}));
      } finally {
          setIsGenerating(false);
        }
    },
    [activeSessionId, createNewSessionImmediately, apiService, getChatContext, settings, getActiveDataSourceIds, sessionMessages, setSessionMessages]
  );
  
  const regenerateMessage = useCallback(async (message: ChatMessage) => {
    if (!activeSessionId) {
      console.error('Cannot regenerate message: No active session');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      const currentMessages = sessionMessages[activeSessionId] || messages;
      
      if (message.metadata?.isDualPathResponse) {
        const messageIndex = currentMessages.findIndex(m => m.id === message.id);
        if (messageIndex <= 0) {
          throw new Error('Cannot find original query for regeneration');
        }
        const userMessage = currentMessages[messageIndex - 1];
        if (userMessage.role !== 'user') {
          throw new Error('Expected user message before assistant message');
        }
        // Remove the message being regenerated and any subsequent messages before re-sending
        const messagesUpToUserQuery = currentMessages.slice(0, messageIndex -1);
        setMessages(messagesUpToUserQuery);
        setSessionMessages(prev => ({ ...prev, [activeSessionId]: messagesUpToUserQuery }));
        await sendMessage(userMessage.content);
      } else {
        console.log(`Regenerating message ${message.id} for session ${activeSessionId}`);
        const loadingMessage = { ...message, content: 'Regenerating...', status: 'loading' as 'loading' }; // Ensure type correctness
        
        const updatedMessagesLoading = currentMessages.map(m => m.id === message.id ? loadingMessage : m);
        setMessages(updatedMessagesLoading);
        setSessionMessages(prev => ({ ...prev, [activeSessionId]: updatedMessagesLoading }));

        try {
          // regenerateMessage in api.ts only takes messageId
          const response = await apiService.regenerateMessage(message.id); 
          const regeneratedMessageContent = { 
            ...message, 
            content: response.content, 
            status: 'complete' as 'complete', // Ensure type correctness
            metadata: { ...(message.metadata || {}), ...(response.metadata || {}) }
          };
          const finalMessages = currentMessages.map(m => m.id === message.id ? regeneratedMessageContent : m);
          setMessages(finalMessages);
          setSessionMessages(prev => ({ ...prev, [activeSessionId]: finalMessages }));
        } catch (regenerateError) {
          console.error('Error calling regenerate API:', regenerateError);
          const errorMessageContent = { ...message, content: 'Error regenerating message', status: 'error' as 'error' }; // Ensure type correctness
          const errorMessages = currentMessages.map(m => m.id === message.id ? errorMessageContent : m);
          setMessages(errorMessages);
          setSessionMessages(prev => ({ ...prev, [activeSessionId]: errorMessages }));
          throw regenerateError;
        }
      }
    } catch (error: any) {
      console.error('Error regenerating message:', error);
      setError(`Error regenerating message: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [activeSessionId, apiService, messages, sendMessage, sessionMessages, setSessionMessages]);

  useEffect(() => {
    const handleUserLogout = () => {
      console.log('User logged out - cleaning up chat provider state');
      setMessages([]);
      setOperationState({
        type: 'idle',
        inProgress: false,
        startTime: 0,
        contextVersionAtStart: contextVersion
      });
      setIsLoadingSessions(false);
      setIsLoadingMessages(false);
      setIsGenerating(false);
      sessionCreationInProgress.current = false;
      setActiveSessionId(null);
      setSessions([]);
      setSessionCache({});
      setCacheTimestamp({});
      setSessionMessages({});
      setError(null);
    };
    eventEmitter.on(EventType.USER_LOGGED_OUT, handleUserLogout);
    return () => {
      eventEmitter.off(EventType.USER_LOGGED_OUT, handleUserLogout);
    };
  }, [contextVersion]);

  useEffect(() => {
    (window as any).forceResetChatLoadingState = () => {
      console.log('Resetting chat loading state');
      setIsLoadingSessions(false);
      setIsLoadingMessages(false);
      setError(null);
    };
    return () => {
      delete (window as any).forceResetChatLoadingState;
    };
  }, []);

  // Auto-save session messages to localStorage when they change
  useEffect(() => {
    if (activeSessionId && sessionMessages[activeSessionId]) {
      try {
        localStorage.setItem(`chat_messages_${activeSessionId}`, JSON.stringify(sessionMessages[activeSessionId]));
      } catch (e) {
        console.error("Failed to save session messages to localStorage", e);
      }
    }
  }, [sessionMessages, activeSessionId]);

  // Operation timeout detection - improved to avoid false positives
  useEffect(() => {
    if (!operationState.inProgress) {
      return; // No timeout needed for idle operations
    }

    const maxDurations: Record<string, number> = {
      'idle': 5000,         // Reduced from 10000
      'loading-sessions': 15000,  // Reduced from 30000
      'creating-session': 10000,  // Reduced from 15000
      'selecting-session': 5000,  // Reduced from 10000
      'deleting-session': 5000,   // Reduced from 10000
      'context-switch': 10000,    // Reduced from 20000
      'message-sending': 20000    // Reduced from 30000
    };
    
    const maxDuration = maxDurations[operationState.type] || 5000;
    const operationId = operationState.operationId;
    const startTime = operationState.startTime;
    
    const timeoutId = setTimeout(() => {
      // Create a closure to capture current state at timeout execution
      // Check if the same operation is still in progress
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;
      
      // Multiple safety checks to prevent false timeouts
      if (!operationState.inProgress) {
        console.log(`Operation ${operationState.type} completed successfully before timeout`);
        return; // Operation completed successfully
      }
      
      if (operationState.operationId !== operationId) {
        console.log(`Operation ID changed from ${operationId} to ${operationState.operationId}, different operation`);
        return; // Different operation is now running
      }
      
      if (elapsedTime < maxDuration) {
        console.log(`Operation ${operationState.type} is still within time limit (${elapsedTime}ms < ${maxDuration}ms)`);
        return; // Still within time limit somehow
      }
      
      console.warn(`Operation ${operationState.type} (${operationId}) exceeded maximum duration (${elapsedTime}ms > ${maxDuration}ms). Forcing cleanup.`);
      
      // Only force cleanup if the operation is actually stuck
      setOperationState({
        type: 'idle',
        inProgress: false,
        startTime: 0,
        contextVersionAtStart: contextVersion
      });
      setIsLoadingSessions(false);
      setIsLoadingMessages(false);
      sessionCreationInProgress.current = false;
      
      // Set a specific error message for timeout
      setError('Operation timed out. Please try refreshing the page.');
    }, maxDuration);
    
    // Return cleanup function to clear timeout
    return () => {
      clearTimeout(timeoutId);
    };
  }, [operationState.inProgress, operationState.type, operationState.operationId, operationState.startTime, contextVersion]);

  useEffect(() => {
    if (currentOrganization?.id) {
      localStorage.setItem('last_active_organization_id', currentOrganization.id.toString());
      console.log(`Saved organization ID ${currentOrganization.id} to localStorage`);
    }
    if (currentDashboard?.id) {
      localStorage.setItem('last_active_dashboard_id', currentDashboard.id);
      console.log(`Saved dashboard ID ${currentDashboard.id} to localStorage`);
    } else if (currentDashboard === null) {
      localStorage.removeItem('last_active_dashboard_id');
      console.log('Cleared dashboard ID in localStorage (global view)');
    }
  }, [currentOrganization?.id, currentDashboard?.id]);

  useEffect(() => {
    if (!sessions.length || isLoadingSessions) return;
    const contextApiChat = getChatContext();
    const validSessions = sessions.filter(session => {
      const validOrg = session.organization_id === contextApiChat.organization_id;
      const validDashboard = 
        !session.dashboard_id || 
        !contextApiChat.dashboard_id || 
        session.dashboard_id === contextApiChat.dashboard_id;
      return validOrg && validDashboard;
    });
    if (validSessions.length !== sessions.length || 
        (activeSessionId && !validSessions.find(s => s.id === activeSessionId))) {
      console.log(`Context changed or active session became invalid. Filtered sessions from ${sessions.length} to ${validSessions.length}.`);
      setSessions(validSessions);
      if (validSessions.length > 0) {
        if (!activeSessionId || !validSessions.find(s => s.id === activeSessionId)) {
          selectSession(validSessions[0].id);
        }
      } else {
        setActiveSessionId(null);
        setMessages([]);
        // Consider creating a new session if none are valid and autoCreateOnEmpty is true
        // createNewSessionImmediately(false, false);
      }
    }
  }, [sessions, currentOrganization?.id, currentDashboard?.id, getChatContext, isLoadingSessions, activeSessionId, selectSession]);

  const loadSessions = useCallback(() => {
    console.log('[ChatProvider] loadSessions called. Checking conditions...');
    console.log('- currentOrganization?.id:', currentOrganization?.id);
    console.log('- lastLoadTime:', lastLoadTime);
    console.log('- Date.now() - lastLoadTime:', Date.now() - lastLoadTime);
    console.log('- MIN_LOAD_INTERVAL:', MIN_LOAD_INTERVAL);
    console.log('- isLoadingSessions:', isLoadingSessions);
    console.log('- operationState.inProgress:', operationState.inProgress);
    
    if (!currentOrganization?.id) {
      console.warn("[ChatProvider] loadSessions: Cannot load, no current organization ID.");
      return;
    }
    
    if (isLoadingSessions || operationState.inProgress) {
      console.log("[ChatProvider] loadSessions: Already loading or operation in progress, skipping");
      return;
    }
    
    if (Date.now() - lastLoadTime < MIN_LOAD_INTERVAL) {
      console.log("[ChatProvider] loadSessions: Too soon since last load, debouncing");
      return;
    }
    
    console.log('[ChatProvider] loadSessions: All conditions met, calling fetchSessions');
    fetchSessions(currentOrganization.id, currentDashboard?.id);
  }, [fetchSessions, currentOrganization, currentDashboard, lastLoadTime, isLoadingSessions, operationState.inProgress]);

  useEffect(() => {
    const handleAuthEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.authenticated) {
        console.log('Auth event received in ChatProvider - user is authenticated:', customEvent.detail.user);
        
        // Wait longer for organization context to be available and add better checks
        setTimeout(() => {
          console.log('Attempting to reload sessions after auth event');
          console.log('Current organization at auth event time:', currentOrganization?.id);
          
          // Only try to load sessions if we have organization context
          if (currentOrganization?.id) {
            console.log('Organization available, loading sessions');
            loadSessions();
          } else {
            console.log('No organization available yet, will load when organization is set');
            // Don't try to load sessions without organization context
            // The main useEffect will handle this when organization becomes available
          }
        }, 1000); // Increased from 500ms to 1000ms to give more time for organization context
      }
    };
    window.addEventListener('auth-state-changed' , handleAuthEvent);
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthEvent);
    };
  }, [loadSessions, currentOrganization?.id]); // Added currentOrganization?.id as dependency

  useEffect(() => {
    console.log(`[ChatProvider] Main session loading useEffect triggered. Org: ${currentOrganization?.id}, AuthLoading: ${isLoadingAuth}, OrgLoading: ${isLoadingOrg}`);

    if (isLoadingAuth || isLoadingOrg) {
      console.log('[ChatProvider] Still loading auth or organization context. Aborting session load for now.');
      return;
    }

    if (currentOrganization?.id) {
      console.log(`[ChatProvider] Organization selected: ${currentOrganization.id}. Checking if sessions need to be fetched or context updated.`);
      if (currentOrganization.id !== prevOrgId.current || (currentDashboard?.id ?? null) !== (prevDashboardId.current ?? null)) {
        console.log(`[ChatProvider] Context change detected (Org or Dashboard). PrevOrg: ${prevOrgId.current}, NewOrg: ${currentOrganization.id}, PrevDash: ${prevDashboardId.current}, NewDash: ${currentDashboard?.id}. Fetching sessions.`);
        setContextVersion(v => v + 1); 
        fetchSessions(currentOrganization.id, currentDashboard?.id);
      } else if (!sessions.length && !isLoadingSessions && !error && (Date.now() - lastLoadTime > MIN_LOAD_INTERVAL)) {
        console.log('[ChatProvider] Sessions array is empty, not loading, no error. Attempting to fetch sessions as a fallback.');
        fetchSessions(currentOrganization.id, currentDashboard?.id);
      } else {
        console.log('[ChatProvider] Organization and dashboard context appear stable, and sessions might already be loaded or loading.');
      }
    } else {
      console.warn('[ChatProvider] No organization selected after auth/org context loaded. Clearing sessions and setting error.');
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setIsLoadingSessions(false);
      setError('Please select an organization to access chat features.');
    }

    prevOrgId.current = currentOrganization?.id;
    prevDashboardId.current = currentDashboard?.id;

  }, [currentOrganization, currentDashboard, isLoadingAuth, isLoadingOrg, fetchSessions, error, sessions.length, isLoadingSessions, lastLoadTime]);

  const contextValue: ChatContextType = {
    messages,
    sessions,
    activeSessionId,
    isGenerating,
    isLoadingSessions,
    isLoadingMessages,
    error,
    sendMessage,
    regenerateMessage,
    clearChat: () => {
      setMessages([]);
      if (activeSessionId) {
        const localStorageKey = `chat_messages_${activeSessionId}`;
        localStorage.removeItem(localStorageKey);
        setSessionMessages(prev => { const newState = {...prev}; delete newState[activeSessionId]; return newState;});
      }
      // Do not clear activeSessionId here, let ThreadsPage handle if it needs to create new one
      // setActiveSessionId(null); 
    },
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
        setSessionCache(prev => ({ ...prev, [`${currentOrganization?.id}-${currentDashboard?.id || 'global'}`]: loadedSessions }));
        
        if (loadedSessions.length > 0) {
          await selectSession(loadedSessions[0].id);
        } else {
          // If no sessions after retry, create one
           await createNewSessionImmediately(false, false);
        }
      } catch (error) {
        console.error('Error retrying session load:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sessions');
      } finally {
        setIsLoadingSessions(false);
      }
    },
    createNewSessionImmediately: createNewSessionImmediately,
    _emergency: {
      setSessions,
      setActiveSessionId,
      setMessages,
      setIsLoadingSessions,
      setIsLoadingMessages
    }
  };

  const testFetchMessages = useCallback(async () => {
    if (!activeSessionId) return;
    
    console.log('[ChatProvider] TEST: Fetching messages for session', activeSessionId);
    try {
      const response = await fetch(`/api/chat/sessions/${activeSessionId}/messages`);
      const data = await response.json();
      console.log('[ChatProvider] TEST: Raw response:', data);
      console.log('[ChatProvider] TEST: Messages in response:', data?.metadata?.messages);
      
      if (data?.metadata?.messages) {
        data.metadata.messages.forEach((msg: any, index: number) => {
          console.log(`[ChatProvider] TEST: Message ${index}:`, {
            role: msg.role,
            content: msg.content,
            contentLength: msg.content?.length || 0
          });
        });
      }
    } catch (error) {
      console.error('[ChatProvider] TEST: Error fetching messages:', error);
    }
  }, [activeSessionId]);

  // Add to window for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).testFetchMessages = testFetchMessages;
    }
  }, [testFetchMessages]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  
  return context;
};

// Simple toast function for notifications (replacement for useToast)
const showToast = (message: { title: string; description: string; status: string; duration?: number }) => {
  console.warn(`[${message.status.toUpperCase()}] ${message.title}: ${message.description}`);
  // In a real implementation, you might want to use a proper notification system
  // For now, we'll just log to console to avoid the import issue
}; 