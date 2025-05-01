import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ChatMessage, MessageRole } from '../types';
import { apiService } from '../../../services/api';
import type { ChatSettings } from '../types';
import type { ChatSession } from '../../../services/api';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useDashboard } from '../../../contexts/DashboardContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { ChatContext as ApiChatContext } from '../../../services/api';
import { useDocumentState } from '../hooks/useDocumentState';
import { eventEmitter, EventType } from '../../../services/events';
import { cleanupOldChatSessions, emergencyStorageCleanup } from '../../../services/chat-recovery';

// Constants

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
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [sessionCache, setSessionCache] = useState<Record<string, ChatSession[]>>({});
  const [cacheTimestamp, setCacheTimestamp] = useState<Record<string, number>>({});
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({});
  
  // Track context version for detecting context changes during operations
  const [contextVersion, setContextVersion] = useState(0);
  
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
  
  // Helper function to generate a unique title for new chat sessions
  const generateUniqueTitle = (): string => {
    return `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
  
  // Create refs for tracking previous organization and dashboard IDs
  const prevOrgId = useRef<number | undefined>(undefined);
  const prevDashboardId = useRef<string | undefined>(undefined);
  
  // Mutex mechanism for operations - currently unused but keeping for future use
  // const operationMutex = useRef<{
  //   locked: boolean;
  //   queue: Array<() => Promise<void>>;
  //   currentOperation: string | null;
  // }>({
  //   locked: false,
  //   queue: [],
  //   currentOperation: null
  // });
  
  // Helper to release the mutex - currently unused but keeping for future use
  // const releaseMutex = useCallback(() => {
  //   const prevOp = operationMutex.current.currentOperation;
  //   operationMutex.current.locked = false;
  //   operationMutex.current.currentOperation = null;
  //   console.log(`Mutex released from ${prevOp}`);
  //   
  //   // Process next operation in queue if any
  //   if (operationMutex.current.queue.length > 0) {
  //     const nextOperation = operationMutex.current.queue.shift();
  //     if (nextOperation) {
  //       console.log(`Processing next operation from queue (${operationMutex.current.queue.length} remaining)`);
  //       nextOperation();
  //     }
  //   }
  // }, []);
  
  // Cache expiration time - 5 minutes
  const CACHE_EXPIRATION = 5 * 60 * 1000;
  // Minimum time between session loads - 10 seconds
  const MIN_LOAD_INTERVAL = 10000;
  // Maximum retry count before giving up
  const MAX_RETRY_COUNT = 5;
  
  // Function to check if cache is valid
  const isCacheValid = (key: string): boolean => {
    const timestamp = cacheTimestamp[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_EXPIRATION;
  };
  
  const { currentOrganization } = useOrganization();
  const { currentDashboard } = useDashboard();
  const { isAuthenticated, user } = useAuth();
  
  // Update context version when organization or dashboard changes
  useEffect(() => {
    // Increment context version whenever organization or dashboard changes
    setContextVersion(prev => prev + 1);
    console.log(`Context changed: incrementing context version to ${contextVersion + 1}`);
    
    // Update previous values for comparison
    prevOrgId.current = currentOrganization?.id;
    prevDashboardId.current = currentDashboard?.id;
  }, [currentOrganization?.id, currentDashboard?.id]);

  const getChatContext = useCallback((): { organization_id: number, dashboard_id?: string } => {
    // Get organization ID from context
    const organizationId = currentOrganization?.id || 1;
    
    // Get dashboard ID from context if available
    const dashboardId = currentDashboard?.id;
    
    // Return properly formatted context object
    return {
      organization_id: organizationId,
      dashboard_id: dashboardId
    };
  }, [currentOrganization, currentDashboard]);
  
  // Function to load messages for a specific session
  const loadMessagesForSession = useCallback(async (session: ChatSession, useLocalStorageFallback = false) => {
    // Skip if no session provided
    if (!session || !session.id) {
      console.warn('No session provided to loadMessagesForSession');
      return;
    }
    
    setIsLoadingMessages(true);
    
    try {
      console.log(`Loading messages for session: ${session.id}`);
      
      // Check if we already have messages for this session in memory
      if (sessionMessages[session.id]) {
        console.log(`Using cached messages for session ${session.id}`);
        
        // Use in-memory cache
        setMessages(sessionMessages[session.id]);
        setIsLoadingMessages(false);
        return;
      }
      
      // Prepare context for API call
      const context: ApiChatContext = {
        organization_id: currentOrganization?.id,
        dashboard_id: currentDashboard?.id
      };
      
      // Fetch messages from server
      console.log(`Fetching messages from API for session ${session.id}`);
      const fetchedMessages = await apiService.getChatHistory(session.id, context);
      console.log(`Received ${fetchedMessages.length} messages from API`);
      
      // If there are messages, set them and update cache
      if (fetchedMessages && fetchedMessages.length > 0) {
        setMessages(fetchedMessages);
        
        // Store messages in session cache
        setSessionMessages(prev => ({ ...prev, [session.id]: fetchedMessages }));
        
        // Store in localStorage too (with expiration)
        const localStorageKey = `chat_messages_${session.id}`;
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(fetchedMessages));
        } catch (storageError) {
          // If storage quota exceeded, prune messages to fit
          if (storageError instanceof DOMException && 
              (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
            console.warn(`Storage quota exceeded when storing fetched messages. Pruning for session ${session.id}`);
            
            // Prune messages to fit in storage
            const prunedMessages = pruneMessagesToFitStorage(fetchedMessages);
            
            // Try saving pruned messages
            localStorage.setItem(localStorageKey, JSON.stringify(prunedMessages));
            console.log(`Successfully saved ${prunedMessages.length} pruned messages to localStorage`);
          } else {
            // For other errors, just log it - we already have messages in memory
            console.error(`Error saving fetched messages to localStorage: ${storageError}`);
          }
        }
        
        // Update cache timestamp
        const cacheTimestampKey = `chat_cache_${session.id}`;
        setCacheTimestamp(prev => ({ ...prev, [cacheTimestampKey]: Date.now() }));
      } else if (fetchedMessages && fetchedMessages.length === 0) {
        // If the session exists but has no messages, create a welcome message
        console.log(`No messages for session ${session.id}, creating welcome message`);
        
        const welcomeMessage: ChatMessage = {
          id: `welcome-${session.id}-${Date.now()}`,
          role: 'assistant',
          content: 'Welcome! How can I help you today?',
          timestamp: Date.now(),
          status: 'complete',
          metadata: {
            model: settings.model,
            welcome: true,
            isWelcomeMessage: true
          }
        };
        
        // Set welcome message as the only message
        setMessages([welcomeMessage]);
        
        // Update cache with welcome message
        setSessionMessages(prev => ({ ...prev, [session.id]: [welcomeMessage] }));
        
        // Store in localStorage
        const localStorageKey = `chat_messages_${session.id}`;
        try {
          localStorage.setItem(localStorageKey, JSON.stringify([welcomeMessage]));
        } catch (storageError) {
          console.error(`Error saving welcome message to localStorage: ${storageError}`);
          // Non-critical error, we can continue without persisting the welcome message
        }
      }
    } catch (error) {
      console.error(`Error loading messages for session ${session.id}:`, error);
      
      if (useLocalStorageFallback) {
        // Try to load from localStorage
        try {
          const localStorageKey = `chat_messages_${session.id}`;
          const storedMessages = localStorage.getItem(localStorageKey);
          
          if (storedMessages) {
            const parsedMessages = JSON.parse(storedMessages) as ChatMessage[];
            console.log(`Loaded ${parsedMessages.length} messages from localStorage fallback`);
            setMessages(parsedMessages);
          } else {
            // Check compact backup as a last resort
            const compactKey = `chat_compact_${session.id}`;
            const compactMessages = localStorage.getItem(compactKey);
            
            if (compactMessages) {
              const parsedCompactMessages = JSON.parse(compactMessages) as ChatMessage[];
              console.log(`Loaded ${parsedCompactMessages.length} messages from compact backup`);
              setMessages(parsedCompactMessages);
            } else {
              // If no messages in localStorage, create a welcome message
              const welcomeMessage: ChatMessage = {
                id: `welcome-${session.id}-${Date.now()}`,
                role: 'assistant',
                content: 'Welcome! How can I help you today?',
                timestamp: Date.now(),
                status: 'complete',
                metadata: {
                  model: settings.model,
                  welcome: true,
                  isWelcomeMessage: true
                }
              };
              
              setMessages([welcomeMessage]);
            }
          }
        } catch (fallbackError) {
          console.error('Error loading messages from localStorage:', fallbackError);
          setMessages([]);
        }
      } else {
        // Show error message
        setError('Failed to load chat messages. Please try again later.');
        setMessages([]);
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [apiService, currentDashboard?.id, currentOrganization?.id, settings.model, isCacheValid, sessionMessages]);

  // Function that creates a new session immediately without waiting for any pending operations
  const createNewSessionImmediately = useCallback(async (
    forceCreate = false,
    skipWelcomeMessage = false
  ): Promise<ChatSession | null> => {
    if (!currentOrganization?.id) {
      throw new Error('No organization selected');
    }

    try {
      console.log('Creating new session immediately, force:', forceCreate);
      sessionCreationInProgress.current = true;
      
      // Try to create a session via API first
      const title = generateUniqueTitle();
      console.log(`Creating API session with title: ${title}`);
      
      const sessionPayload = {
        title,
        organization_id: currentOrganization.id,
        dashboard_id: currentDashboard?.id || undefined
      };
      console.log('Session create payload:', sessionPayload);
      
      const session = await apiService.createChatSession(sessionPayload);
      console.log(`Successfully created session with ID: ${session.id}`);
      
      try {
        // Try to save to localStorage
        localStorage.setItem(`chat_session_${session.id}`, JSON.stringify(session));
      } catch (storageError) {
        if (storageError instanceof DOMException && 
            (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
          console.warn('Storage full when creating session. Attempting cleanup...');
          
          // Try emergency cleanup and retry
          emergencyStorageCleanup();
        }
        
        console.error(`Error saving session to localStorage: ${storageError}`);
        // Continue even if we fail to save to localStorage
      }
      
      // Add session to our list
      setSessions(prev => [session, ...prev]);
      
      // Set as active session
      setActiveSessionId(session.id);
      
      // Only create welcome message if not skipped
      if (!skipWelcomeMessage) {
        const welcomeMessage: ChatMessage = {
          id: `welcome-${session.id}-${Date.now()}`,
          role: 'assistant' as MessageRole,
          content: 'Welcome! How can I help you today?',
          timestamp: Date.now(),
          status: 'complete',
          metadata: {
            model: settings.model,
            welcome: true,
          }
        };
        
        // Save welcome message to state and local storage
        setMessages([welcomeMessage]);
        
        // Try to save to localStorage, but continue even if it fails due to quota
        try {
          const localStorageKey = `chat_messages_${session.id}`;
          localStorage.setItem(localStorageKey, JSON.stringify([welcomeMessage]));
        } catch (storageError) {
          console.error('Failed to save welcome message to localStorage:', storageError);
        }
      } else {
        // Set empty messages for this session
        setMessages([]);
        
        // Try to save to localStorage, but continue even if it fails due to quota
        try {
          localStorage.setItem(`chat_messages_${session.id}`, JSON.stringify([]));
        } catch (storageError) {
          console.error('Failed to save empty message array to localStorage:', storageError);
        }
      }
      
      // Return for use by other functions
      console.log(`Created immediate new session: ${session.id}`);
      return session;
      
    } catch (error) {
      setError('Failed to create a new chat session. Please try again.');
      console.error(`Error creating session: ${error}`);
      return null;
    } finally {
      sessionCreationInProgress.current = false;
    }
  }, [apiService, currentDashboard?.id, currentOrganization?.id, settings.model]);

  // Load sessions from the server
  const loadSessions = useCallback(async () => {
    // Skip if not authenticated
    if (!isAuthenticated || !user) {
      console.log('Skipping session loading - user not authenticated');
      return;
    }
    
    // Check if we're in a rate-limited state
    const now = Date.now();
    const timeSinceLastRetry = now - lastRetryTime;
    const backoffTime = Math.min(30000, 1000 * Math.pow(2, retryCount));
    
    if (retryCount > 0 && timeSinceLastRetry < backoffTime) {
      console.log(`Skipping session load - in backoff period. Waiting ${(backoffTime - timeSinceLastRetry) / 1000}s`);
      return;
    }
    
    // Debounce: prevent loading too frequently
    const timeSinceLastLoad = now - lastLoadTime;
    if (timeSinceLastLoad < MIN_LOAD_INTERVAL) {
      console.log(`Debouncing session load - last load was ${timeSinceLastLoad / 1000}s ago`);
      return;
    }
    
    // Update last load time
    setLastLoadTime(now);
    
    // Prepare context for API call
    const context: ApiChatContext = {
      organization_id: currentOrganization?.id,
      dashboard_id: currentDashboard?.id
    };
    
    // Check if we have a valid cache for all sessions
    const cacheKey = `sessions_${JSON.stringify(context)}`;
    if (isCacheValid(cacheKey) && sessionCache[cacheKey]) {
      console.log(`Using cached sessions from ${(now - cacheTimestamp[cacheKey]) / 1000}s ago`);
      setSessions(sessionCache[cacheKey]);
      setIsLoadingSessions(false);
      return;
    }
    
    // If we have an active session, prioritize loading that one
    if (activeSessionId) {
      // Look for the active session in all cached session arrays
      for (const [key, sessions] of Object.entries(sessionCache)) {
        if (isCacheValid(key)) {
          const cachedSession = sessions.find(s => s.id === activeSessionId);
          if (cachedSession) {
            console.log(`Using cached session ${activeSessionId} from cache key ${key}`);
            // Load messages for this session
            await loadMessagesForSession(cachedSession);
            return;
          }
        }
      }
    }
    
    // If we get here, we need to load from the server
    setIsLoadingSessions(true);
    
    try {
      // Fetch sessions from the server
      const fetchedSessions = await apiService.getChatSessions(context);
      console.log(`Successfully fetched ${fetchedSessions.length} chat sessions`);
      
      // Reset retry count on success
      if (retryCount > 0) {
        setRetryCount(0);
        setLastRetryTime(0);
      }
      
      // Cache all sessions
      setSessionCache(prev => ({ ...prev, [cacheKey]: fetchedSessions }));
      setCacheTimestamp(prev => ({ ...prev, [cacheKey]: Date.now() }));
      
      // Create a map for quick lookup
      const sessionsMap: Record<string, ChatSession> = {};
      fetchedSessions.forEach(session => {
        sessionsMap[session.id] = session;
      });
      
      // Update state
      setSessions(fetchedSessions);
      
      // If we have an active session, load its messages
      if (activeSessionId && sessionsMap[activeSessionId]) {
        await loadMessagesForSession(sessionsMap[activeSessionId]);
      } else if (fetchedSessions.length > 0 && !activeSessionId) {
        // If no active session but we have sessions, select the most recent one
        const mostRecent = fetchedSessions.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        
        setActiveSessionId(mostRecent.id);
        await loadMessagesForSession(mostRecent);
      } else if (fetchedSessions.length === 0) {
        // If no sessions exist, create a new one
        const newSession = await createNewSessionImmediately(true, true);
        
        // If we successfully created a new session, add a simple welcome message
        if (newSession) {
          const welcomeMessage: ChatMessage = {
            id: `welcome-${newSession.id}-${Date.now()}`,
            role: 'assistant' as MessageRole,
            content: 'Welcome! How can I help you today?',
            timestamp: Date.now(),
            status: 'complete',
            metadata: {
              sessionId: newSession.id,
              isWelcomeMessage: true,
              isSimpleWelcome: true
            }
          };
          
          // Set the welcome message
          setMessages([welcomeMessage]);
          
          // Save to localStorage
          const localStorageKey = `chat_messages_${newSession.id}`;
          localStorage.setItem(localStorageKey, JSON.stringify([welcomeMessage]));
          
          // Update the messages cache
          setSessionMessages(prev => ({
            ...prev,
            [newSession.id]: [welcomeMessage]
          }));
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      
      // Increment retry count and set last retry time
      setRetryCount(prev => Math.min(MAX_RETRY_COUNT, prev + 1));
      setLastRetryTime(now);
      
      // Try to load from localStorage as fallback
      try {
        const storedSessions = localStorage.getItem('chat_sessions');
        if (storedSessions) {
          const parsedSessions = JSON.parse(storedSessions) as ChatSession[];
          console.log(`Loaded ${parsedSessions.length} sessions from localStorage fallback`);
          setSessions(parsedSessions);
          
          // If we have an active session, try to load its messages from localStorage
          if (activeSessionId) {
            const activeSession = parsedSessions.find(s => s.id === activeSessionId);
            if (activeSession) {
              await loadMessagesForSession(activeSession, true);
            }
          }
        }
      } catch (localStorageError) {
        console.error('Error loading sessions from localStorage:', localStorageError);
      }
      
      setError('Failed to load chat sessions. Please try again later.');
    } finally {
      setIsLoadingSessions(false);
    }
  }, [
    activeSessionId,
    isAuthenticated,
    user,
    retryCount,
    lastRetryTime,
    lastLoadTime,
    currentDashboard,
    sessionCache,
    cacheTimestamp
  ]);

  // Add a utility function to estimate the size of a string in bytes
  const getStringSizeInBytes = (str: string): number => {
    return new Blob([str]).size;
  };

  // Add a utility function to limit messages to fit within localStorage
  const pruneMessagesToFitStorage = (messages: ChatMessage[], maxSizeInBytes = 4 * 1024 * 1024): ChatMessage[] => {
    // Start with complete messages
    let prunedMessages = [...messages];
    let jsonString = JSON.stringify(prunedMessages);
    let currentSize = getStringSizeInBytes(jsonString);
    
    // If already under threshold, return as is
    if (currentSize <= maxSizeInBytes) {
      return prunedMessages;
    }
    
    console.log(`Messages size (${currentSize} bytes) exceeds limit (${maxSizeInBytes} bytes). Pruning...`);
    
    // First, make a compact version of the messages by trimming unnecessary metadata
    prunedMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      status: msg.status,
      metadata: msg.metadata ? { model: msg.metadata.model } : undefined
    }));
    
    jsonString = JSON.stringify(prunedMessages);
    currentSize = getStringSizeInBytes(jsonString);
    
    // If compacting metadata worked, return result
    if (currentSize <= maxSizeInBytes) {
      console.log(`Reduced message size to ${currentSize} bytes by compacting metadata`);
      return prunedMessages;
    }
    
    // If still too large, start removing oldest messages
    while (prunedMessages.length > 0 && currentSize > maxSizeInBytes) {
      // Remove the oldest message (messages are typically in chronological order)
      prunedMessages.shift();
      
      // Recalculate size
      jsonString = JSON.stringify(prunedMessages);
      currentSize = getStringSizeInBytes(jsonString);
    }
    
    console.log(`Reduced to ${prunedMessages.length} messages (${currentSize} bytes) to fit storage quota`);
    return prunedMessages;
  };

  // Add a new effect to save messages to localStorage whenever they change
  useEffect(() => {
    // Only save if we have an active session and messages
    if (activeSessionId && messages.length > 0) {
      try {
        // Save to localStorage
        const localStorageKey = `chat_messages_${activeSessionId}`;
        
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(messages));
        } catch (storageError) {
          // If storage quota exceeded, try to clean up old sessions first
          if (storageError instanceof DOMException && 
              (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
            console.warn(`Storage quota exceeded. Attempting cleanup for session ${activeSessionId}`);
            
            // Try to clean up old sessions first
            try {
              // Start with standard cleanup
              const cleanedUpCount = cleanupOldChatSessions();
              
              if (cleanedUpCount > 0) {
                // If we cleaned up items, try again with original messages
                try {
                  localStorage.setItem(localStorageKey, JSON.stringify(messages));
                  console.log(`Successfully saved messages after cleaning up ${cleanedUpCount} old items`);
                  return; // Exit early if successful
                } catch (retryError) {
                  console.log(`Still insufficient space after standard cleanup, trying emergency cleanup`);
                }
              }
              
              // If standard cleanup didn't work, try emergency cleanup
              if (emergencyStorageCleanup()) {
                try {
                  localStorage.setItem(localStorageKey, JSON.stringify(messages));
                  console.log(`Successfully saved messages after emergency cleanup`);
                  return; // Exit early if successful
                } catch (emergencyRetryError) {
                  // If still failing, try to save a minimal version
                  console.log(`Emergency cleanup insufficient, attempting to save minimal data`);
                  
                  // Try to save just the last message
                  if (messages.length > 0) {
                    try {
                      const lastMessage = messages[messages.length - 1];
                      localStorage.setItem(`chat_lastmsg_${activeSessionId}`, JSON.stringify(lastMessage));
                      console.log(`Saved only the last message as a fallback`);
                    } catch (lastMsgError) {
                      console.error(`Failed to save even the last message: ${lastMsgError}`);
                    }
                  }
                }
              }
              
              // If we're here, all cleanup attempts failed
              throw storageError;
            } catch (cleanupError) {
              console.error(`Error during storage cleanup:`, cleanupError);
              throw storageError; // Re-throw original error for default handling
            }
          } else {
            throw storageError; // Re-throw non-quota errors
          }
        }
        
        // Also save to the server
        const context = getChatContext();
        apiService.saveChatHistory(activeSessionId, messages, context).catch(error => {
          console.error(`Error saving chat history to server for session ${activeSessionId}:`, error);
          
          // If server save fails, ensure we have a reliable local backup
          try {
            // Create a backup with timestamp
            const backupKey = `chat_messages_backup_${activeSessionId}_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(messages));
            console.log(`Created backup of messages at ${backupKey}`);
          } catch (backupError) {
            console.error(`Failed to create backup of messages: ${backupError}`);
          }
        });
      } catch (error) {
        console.error(`Error saving messages to localStorage for session ${activeSessionId}:`, error);
        
        // Try an alternative approach if standard localStorage fails
        try {
          // Use a more compact representation for storage
          const compactMessages = messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            status: m.status
          }));
          
          const compactKey = `chat_compact_${activeSessionId}`;
          localStorage.setItem(compactKey, JSON.stringify(compactMessages));
          console.log(`Saved compact message backup to ${compactKey}`);
        } catch (compactError) {
          console.error(`All attempts to save messages failed: ${compactError}`);
          
          // Alert the user that local storage is full
          if (!localStorage.getItem('storage_warning_shown')) {
            alert('Browser storage is full. Please clear some browser data or history to continue using chat. Your messages may not be saved locally.');
            localStorage.setItem('storage_warning_shown', 'true');
          }
        }
      }
    }
  }, [activeSessionId, messages, getChatContext]);

  // Reset state when switching between chats
  useEffect(() => {
    if (activeSessionId) {
      console.log('Active session changed in provider:', activeSessionId);
      
      // Reset error state
      setError(null);
      
      // Reset generating state
      setIsGenerating(false);
    }
  }, [activeSessionId]);

  // Load sessions when component mounts or when authentication/organization changes
  useEffect(() => {
    // Only attempt to load sessions if the user is authenticated
    if (isAuthenticated && user) {
      // Add a small delay to allow context values to stabilize
      const timer = setTimeout(() => {
        console.log('Loading sessions after authentication with context:',
          { org: currentOrganization?.id, dashboard: currentDashboard?.id });
        loadSessions();
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      console.log('Skipping session loading - user not authenticated');
      setSessions([]);
    }
  }, [isAuthenticated, user, currentOrganization?.id, currentDashboard?.id]);

  // Add a recovery mechanism for cases where context switching may have failed
  useEffect(() => {
    // Create an interval to check for missed context changes
    const intervalId = setInterval(() => {
      // Skip if not authenticated
      if (!isAuthenticated || !user) return;
      
      // Check if our stored previous values match current ones
      const orgMismatch = prevOrgId.current !== currentOrganization?.id;
      const dashboardMismatch = prevDashboardId.current !== currentDashboard?.id;
      
      if (orgMismatch || dashboardMismatch) {
        console.warn('Detected missed context change:', 
          { prevOrg: prevOrgId.current, currentOrg: currentOrganization?.id,
            prevDashboard: prevDashboardId.current, currentDashboard: currentDashboard?.id });
          
        // Force update context version
        setContextVersion(prev => prev + 1);
        
        // Update stored values
        prevOrgId.current = currentOrganization?.id;
        prevDashboardId.current = currentDashboard?.id;
        
        // Reload sessions with the correct context
        loadSessions();
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [isAuthenticated, user, currentOrganization?.id, currentDashboard?.id, loadSessions]);

  // Document state for persistence between sessions
  const documentState = useDocumentState();

  // Effect to handle context changes (organization or dashboard)
  useEffect(() => {
    const handleContextChange = async () => {
      // Check if organization or dashboard has changed
      const contextChanged = 
        (prevOrgId.current !== undefined && prevOrgId.current !== currentOrganization?.id) ||
        (prevDashboardId.current !== undefined && prevDashboardId.current !== currentDashboard?.id);
      
      // Skip if first load or no change
      if (prevOrgId.current === undefined || !contextChanged) {
        // Still update the refs for first-time initialization
        prevOrgId.current = currentOrganization?.id;
        prevDashboardId.current = currentDashboard?.id;
        return;
      }
      
      console.log(`Context changed: Org ${prevOrgId.current} -> ${currentOrganization?.id}, Dashboard ${prevDashboardId.current} -> ${currentDashboard?.id}`);
      
      // Reset error
      setError(null);
      
      // Update operation state
      setOperationState({
        type: 'context-switch',
        inProgress: true,
        operationId: `context-switch-${Date.now()}`,
        startTime: Date.now(),
        contextVersionAtStart: contextVersion
      });
      
      try {
        // Get new context
        const newContext = getChatContext();
        console.log(`New context: org=${newContext.organization_id}, dashboard=${newContext.dashboard_id || 'global'}`);
        
        // FIXED: More permissive validation for active session
        if (activeSessionId) {
          const activeSession = sessions.find(s => s.id === activeSessionId);
          if (activeSession) {
            // Check if session is still valid in the new context
            const validOrg = activeSession.organization_id === newContext.organization_id;
            const validDashboard = 
              !activeSession.dashboard_id || // Global session (no dashboard) is always valid
              !newContext.dashboard_id || // When in global view, all sessions are valid
              activeSession.dashboard_id === newContext.dashboard_id; // In dashboard view, session must match dashboard
            
            // If not valid in new context, clear it
            if (!validOrg || !validDashboard) {
              console.log(`Active session ${activeSessionId} is not valid in new context. Clearing.`);
              setActiveSessionId(null);
              setMessages([]);
            } else {
              console.log(`Active session ${activeSessionId} is valid in new context. Keeping.`);
            }
          }
        }
        
        // FIXED: More permissive filtering for sessions list
        const validSessions = sessions.filter(session => {
          const validOrg = session.organization_id === newContext.organization_id;
          const validDashboard = 
            !session.dashboard_id || // Global session (no dashboard) is always valid
            !newContext.dashboard_id || // When in global view, all sessions are valid
            session.dashboard_id === newContext.dashboard_id; // In dashboard view, session must match dashboard
          
          if (!validOrg || !validDashboard) {
            console.log(`Session ${session.id} is not valid in new context - filtering out`);
            return false;
          }
          
          return true;
        });
        
        // Update sessions list with only valid sessions
        setSessions(validSessions);
        
        // Filter session messages to only include those from valid sessions
        const validSessionMessages: Record<string, ChatMessage[]> = {};
        for (const [sessionId, messages] of Object.entries(sessionMessages)) {
          const session = validSessions.find(s => s.id === sessionId);
          if (session) {
            validSessionMessages[sessionId] = messages;
          }
        }
        
        // Update session messages
        setSessionMessages(validSessionMessages);
        
        // Update previous context refs
        prevOrgId.current = currentOrganization?.id;
        prevDashboardId.current = currentDashboard?.id;
        
        // Add a delay before loading sessions to ensure all state updates are processed
        // This helps prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reload sessions for the new context
        loadSessions();
      } catch (error) {
        console.error('Error handling context change:', error);
      } finally {
        // Always update operation state
        setOperationState({
          type: 'idle',
          inProgress: false,
          startTime: 0,
          contextVersionAtStart: contextVersion
        });
      }
    };
    
    // Execute the handler
    handleContextChange();
  }, [currentOrganization?.id, currentDashboard?.id, loadSessions, activeSessionId, sessions, sessionMessages, contextVersion, getChatContext]);

  // Function to select a session
  const selectSession = useCallback(async (sessionId: string): Promise<void> => {
    console.log(`Selecting session: ${sessionId}`);
    
    // Set the active session ID
    setActiveSessionId(sessionId);
    
    // Find the session in the sessions list
    const sessionToSelect = sessions.find(s => s.id === sessionId);
    
    if (sessionToSelect) {
      // Load messages for this session
      await loadMessagesForSession(sessionToSelect);
    } else {
      console.error(`Session ${sessionId} not found in sessions list`);
      setError('Session not found. Please refresh the page.');
    }
  }, [sessions, loadMessagesForSession]);

  // Helper function to get active data source IDs
  const getActiveDataSourceIds = (): string[] => {
    // This should be replaced with your actual implementation
    // Typically, you would get this from a context or state
    // For now, return a placeholder value
    return ['default_data_source'];
  };

  /**
   * Create a new chat session
   * This is the main public API for creating sessions that should be used by components
   */
  const createSession = useCallback(async (
    title?: string,
    skipWelcomeMessage = false
  ): Promise<ChatSession> => {
    // Block if another session creation is in progress
    if (sessionCreationInProgress.current) {
      console.log('Creating new session immediately, force: true');
      // If a creation is in progress, force a new one
      const newSession = await createNewSessionImmediately(true, skipWelcomeMessage);
      if (!newSession) {
        throw new Error('Failed to create new session');
      }
      return newSession;
    }
    
    // If auto-titling, generate a unique title
    if (!title) {
      title = generateUniqueTitle();
    }
    
    console.log(`Creating chat session with title "${title}"`);
    
    // Make sure we have context
    if (!currentOrganization) {
      const error = new Error('No organization selected');
      console.error(error);
      setError(error.message);
      throw error;
    }
    
    const context: ApiChatContext = {
      organization_id: currentOrganization.id,
      dashboard_id: currentDashboard?.id
    };
    
    // Get the current state of data sources
    const dataSourceIds = getActiveDataSourceIds();
    
    // Prepare session data
    const sessionData = {
      title,
      organization_id: context.organization_id,
      dashboard_id: context.dashboard_id,
      dataSourceIds: dataSourceIds
    };
    
    // Block multiple creations
    sessionCreationInProgress.current = true;
    setIsLoadingSessions(true);
    
    try {
      console.log('Session create payload:', sessionData);
      
      // Create the session
      const newSession = await apiService.createChatSession(sessionData);
      console.log(`Successfully created session with ID: ${newSession.id}`);
      
      try {
        // Try to save to localStorage
        localStorage.setItem(`chat_session_${newSession.id}`, JSON.stringify(newSession));
      } catch (storageError) {
        if (storageError instanceof DOMException && 
            (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
          console.warn('Storage full when creating session. Attempting cleanup...');
          
          // Try emergency cleanup and retry
          emergencyStorageCleanup();
        }
        
        console.error(`Error saving session to localStorage: ${storageError}`);
        // Continue even if we fail to save to localStorage
      }
      
      // If successful, add to our sessions list
      setSessions(prevSessions => [newSession, ...prevSessions]);
      
      // Create an initial welcome message
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
        
        // Only set if we're selecting this session
        setMessages([welcomeMessage]);
        
        // Try to save to localStorage
        try {
          localStorage.setItem(`chat_messages_${newSession.id}`, JSON.stringify([welcomeMessage]));
        } catch (storageError) {
          console.error(`Error saving welcome message to localStorage: ${storageError}`);
          // Continue even if localStorage fails
        }
        
        // Record in session messages cache
        setSessionMessages(prevState => ({
          ...prevState,
          [newSession.id]: [welcomeMessage]
        }));
      }
      
      // Set as the active session
      setActiveSessionId(newSession.id);
      
      // Return the session
      return newSession;
    } catch (error) {
      console.error('Error creating session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create session');
      throw error;
    } finally {
      setIsLoadingSessions(false);
      sessionCreationInProgress.current = false;
    }
  }, [
    apiService, 
    currentDashboard?.id, 
    currentOrganization, 
    getActiveDataSourceIds,
    settings.model, 
    createNewSessionImmediately
  ]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiService.deleteChatSession(sessionId, getChatContext());
      
      // Update the sessions list
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // Get the updated list of sessions
      const remainingSessions = sessions.filter(session => session.id !== sessionId);
      
      // If the deleted session was active
      if (sessionId === activeSessionId) {
        if (remainingSessions.length > 0) {
          // If we have other sessions, select the first one
          await selectSession(remainingSessions[0].id);
          
          // Show success notification
          if (window.notificationContext) {
            window.notificationContext.showNotification({
              type: 'success',
              message: 'Chat deleted successfully'
            });
          }
        } else {
          // If no sessions left, clear active session
          setActiveSessionId(null);
          setMessages([]);
          
          // Prevent multiple session creations
          if (sessionCreationInProgress.current) {
            console.log("Session creation already in progress, skipping duplicate creation");
            return;
          }
          
          // Set flag to prevent multiple creations
          sessionCreationInProgress.current = true;
          
          // Create a new session automatically
          try {
            const newSession = await createSession("New Chat", true);
            console.log("Created new session after deleting last session:", newSession.id);
            
            // Show notification
            if (window.notificationContext) {
              window.notificationContext.showNotification({
                type: 'success',
                message: 'Chat deleted. Created a new chat for you.'
              });
            }
          } catch (err) {
            console.error("Failed to create new session after deletion:", err);
          } finally {
            // Reset the flag
            sessionCreationInProgress.current = false;
          }
        }
      } else {
        // If we deleted a non-active session
        if (window.notificationContext) {
          window.notificationContext.showNotification({
            type: 'success',
            message: 'Chat deleted successfully'
          });
        }
      }
      
      // Clear document state for this session
      documentState.clearDocumentStateForSession(sessionId);
    } catch (error) {
      console.error('Error deleting chat session:', error);
      
      // Show error notification
      if (window.notificationContext) {
        window.notificationContext.showNotification({
          type: 'error',
          message: 'Failed to delete chat. Please try again.'
        });
      }
    }
  }, [sessions, activeSessionId, selectSession, getChatContext, createSession, documentState]);

  // Update sendMessage to integrate dual-path functionality
  const sendMessage = useCallback(
    async (content: any, isAssistantMessage = false) => {
      // Reset error state
      setError(null);
      
    if (!activeSessionId) {
        // If no active session, create one
        try {
          const newSession = await createNewSessionImmediately(true, true);
          if (!newSession) {
            // If we couldn't create a session, exit
      return;
    }
        } catch (error) {
          console.error('Error creating session for message:', error);
          setError('Failed to create a new chat session');
          return;
        }
      }
      
      try {
        // Set generating state
        setIsGenerating(true);
        
        // Determine if this is likely an analytical query
        const isAnalyticalQuery = detectAnalyticalQuery(content);
        
        let response: any;
        
        // Choose between regular message API or dual-path API based on query type
        if (isAnalyticalQuery) {
          console.log('Detected analytical query, using dual-path API');
          
          // Get active data sources from knowledge context - replace with your actual method
          // This would normally be available through a context or prop
          const activeDataSourceIds = getActiveDataSourceIds();
          
          // Set options for visualization
          const options = {
            dataVisualization: true,
            includeGeneratedCode: true,
            streaming: settings.streaming
          };
          
          // Process through dual-path API
          if (settings.streaming) {
            // Handle streaming response
            const streamResponse = await apiService.streamDualPathQuery(content, activeDataSourceIds, options);
            
            // Process the stream response
            // This is placeholder code - you would implement proper stream handling
            const reader = streamResponse.body?.getReader();
            if (reader) {
              // Create a new assistant message that will be updated with streaming content
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
              
              // Add the initial message
              setMessages(prev => [...prev, initialAssistantMessage]);
              
              // Process the stream
              let accumulatedContent = '';
              
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  // Decode and process chunks
                  const chunk = new TextDecoder().decode(value);
                  accumulatedContent += chunk;
                  
                  // Update the message with accumulated content
                  const updatedMessage: ChatMessage = {
                    ...initialAssistantMessage,
                    content: accumulatedContent,
                    status: 'loading'
                  };
                  
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessageId ? updatedMessage : msg
                    )
                  );
                }
                
                // Final message update when stream is complete
                const finalMessage: ChatMessage = {
                  ...initialAssistantMessage,
                  content: accumulatedContent,
                  status: 'complete'
                };
                
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessageId ? finalMessage : msg
                  )
                );
              } catch (streamError) {
                console.error('Error processing stream:', streamError);
                
                // Update message with error status
                const errorMessage: ChatMessage = {
                  ...initialAssistantMessage,
                  content: 'Error processing response stream',
                  status: 'error'
                };
                
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessageId ? errorMessage : msg
                  )
                );
              } finally {
                reader.releaseLock();
              }
            }
          } else {
            // Non-streaming dual-path response
            response = await apiService.processDualPathQuery(content, activeDataSourceIds, options);
            
            // Create assistant message with dual-path response
            const assistantMessage: ChatMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: JSON.stringify(response), // Store the entire response
              timestamp: Date.now(),
            status: 'complete',
            metadata: {
                isDualPathResponse: true,
                routingPath: response.routing.path,
                routingConfidence: response.routing.confidence
              }
            };
            
            // Add the message
            setMessages(prev => [...prev, assistantMessage]);
          }
        } else {
          // Standard message handling for non-analytical queries
          response = await apiService.sendMessage(
            activeSessionId as string,
            typeof content === 'string' ? content : JSON.stringify(content),
            getChatContext(),
            {
              streaming: settings.streaming,
              role: isAssistantMessage ? 'assistant' : 'user'
            }
          );
          
          // Create a new assistant message
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.content,
            timestamp: Date.now(),
            status: 'complete',
            metadata: response.metadata
          };
          
          // Add the message
          setMessages(prev => [...prev, assistantMessage]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message. Please try again later.');
        
        // Add an error message to the chat
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: 'Failed to send message. Please try again later.',
          timestamp: Date.now(),
          status: 'error'
        };
        
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        // Set generating state to false
          setIsGenerating(false);
        }
    },
    [activeSessionId, createNewSessionImmediately, apiService, getChatContext, settings]
  );
  
  // Helper function to detect if a query is analytical
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
    
    // Check if the query contains any analytical keywords
    return analyticalKeywords.some(keyword => normalizedQuery.includes(keyword));
  };
  
  // Regenerate message function - needed for UI interactions
  const regenerateMessage = useCallback(async (message: ChatMessage) => {
    if (!activeSessionId) {
      console.error('Cannot regenerate message: No active session');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Check if this is a dual-path response
      if (message.metadata?.isDualPathResponse) {
        // For dual-path messages, we need to re-run the query
        // Extract the original query from the previous user message
        const messageIndex = messages.findIndex(m => m.id === message.id);
        if (messageIndex <= 0) {
          throw new Error('Cannot find original query for regeneration');
        }
        
        // Get the user message that preceded this assistant message
        const userMessage = messages[messageIndex - 1];
        if (userMessage.role !== 'user') {
          throw new Error('Expected user message before assistant message');
        }
        
        // Re-send the user query
        await sendMessage(userMessage.content);
      } else {
        // For standard messages, use the regular regeneration
      // Logic to regenerate the message
      console.log(`Regenerating message ${message.id} for session ${activeSessionId}`);
      
      // Replace the message with loading message
      setMessages(prev => {
        const updated = [...prev];
        const index = updated.findIndex(m => m.id === message.id);
        if (index !== -1) {
            updated[index] = { 
              ...updated[index], 
              content: 'Regenerating...', 
              status: 'loading' 
            };
        }
        return updated;
      });
      
        try {
          // Call the API to regenerate the message
          const response = await apiService.regenerateMessage(message.id);
          
          // Update the message with the new content
        setMessages(prev => {
          const updated = [...prev];
          const index = updated.findIndex(m => m.id === message.id);
          if (index !== -1) {
            updated[index] = { 
              ...updated[index], 
                content: response.content,
                status: 'complete',
                metadata: {
                  ...updated[index].metadata,
                  ...response.metadata
                }
            };
          }
          return updated;
        });
        } catch (regenerateError) {
          console.error('Error calling regenerate API:', regenerateError);
          
          // Update message to show error
          setMessages(prev => {
            const updated = [...prev];
            const index = updated.findIndex(m => m.id === message.id);
            if (index !== -1) {
              updated[index] = { 
                ...updated[index], 
                content: 'Error regenerating message',
                status: 'error'
              };
            }
            return updated;
          });
          
          throw regenerateError;
        }
      }
    } catch (error: any) {
      console.error('Error regenerating message:', error);
      setError(`Error regenerating message: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [activeSessionId, apiService, messages, sendMessage]);

  // Listen for logout events and cancel any pending operations
  useEffect(() => {
    const handleUserLogout = () => {
      console.log('User logged out - cleaning up chat provider state');
      
      // Clear any messages from memory
      setMessages([]);
      
      // Cancel any pending operations
      setOperationState({
        type: 'idle',
        inProgress: false,
        startTime: 0,
        contextVersionAtStart: contextVersion
      });
      
      // Reset loading states
      setIsLoadingSessions(false);
      setIsLoadingMessages(false);
      setIsGenerating(false);
      sessionCreationInProgress.current = false;
      
      // Clear active session
      setActiveSessionId(null);
      
      // Clear sessions list
      setSessions([]);
      
      // Clear error states
      setError(null);
    };
    
    // Subscribe to logout events
    eventEmitter.on(EventType.USER_LOGGED_OUT, handleUserLogout);
    
    // Clean up subscription when component unmounts
    return () => {
      eventEmitter.off(EventType.USER_LOGGED_OUT, handleUserLogout);
    };
  }, [contextVersion]);

  // Add global emergency reset command
  useEffect(() => {
    // Add a global command to force reset the loading state
    (window as any).forceResetChatLoadingState = () => {
      console.log('Resetting chat loading state');
      
      // Force loading state to false
      setIsLoadingSessions(false);
      setIsLoadingMessages(false);
      
      // Reset any error states
      setError(null);
    };
    
    // Clean up the global function when component unmounts
    return () => {
      delete (window as any).forceResetChatLoadingState;
    };
  }, []);

  // Cleanup effect to handle stale operation states
  useEffect(() => {
    // Only run if an operation is in progress
    if (!operationState.inProgress) return;
    
    // Define maximum durations for operations in milliseconds
    const maxDurations: Record<string, number> = {
      'idle': 10000,
      'loading-sessions': 30000,
      'creating-session': 15000,
      'selecting-session': 10000,
      'deleting-session': 10000,
      'context-switch': 20000,
      'message-sending': 30000
    };
    
    // Set a timeout to detect if an operation exceeds its maximum duration
    const timeoutId = setTimeout(() => {
      const elapsedTime = Date.now() - operationState.startTime;
      const maxDuration = maxDurations[operationState.type] || 10000;
      
      if (elapsedTime > maxDuration) {
        console.warn(`Operation ${operationState.type} (${operationState.operationId}) exceeded maximum duration (${elapsedTime}ms > ${maxDuration}ms). Forcing cleanup.`);
        
        // Force reset of operation state
        setOperationState({
          type: 'idle',
          inProgress: false,
          startTime: 0,
          contextVersionAtStart: contextVersion
        });
        
        // Reset loading states to ensure UI remains responsive
        setIsLoadingSessions(false);
        setIsLoadingMessages(false);
        sessionCreationInProgress.current = false;
      }
    }, maxDurations[operationState.type] || 10000);
    
    // Cleanup timeout when component unmounts or operation changes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [operationState, contextVersion]);

  // Add persistence for organization and dashboard IDs
  useEffect(() => {
    // Save active organization ID to localStorage whenever it changes
    if (currentOrganization?.id) {
      localStorage.setItem('last_active_organization_id', currentOrganization.id.toString());
      console.log(`Saved organization ID ${currentOrganization.id} to localStorage`);
    }
    
    // Save active dashboard ID to localStorage whenever it changes
    if (currentDashboard?.id) {
      localStorage.setItem('last_active_dashboard_id', currentDashboard.id);
      console.log(`Saved dashboard ID ${currentDashboard.id} to localStorage`);
    } else if (currentDashboard === null) {
      // If dashboard is explicitly null (global view), clear stored dashboard
      localStorage.removeItem('last_active_dashboard_id');
      console.log('Cleared dashboard ID in localStorage (global view)');
    }
  }, [currentOrganization?.id, currentDashboard?.id]);

  // Filter sessions to only show those valid in the current context
  useEffect(() => {
    // Skip if no sessions or if still loading
    if (!sessions.length || isLoadingSessions) return;
    
    const context = getChatContext();
    
    // Filter sessions to only include those valid in current context
    const validSessions = sessions.filter(session => {
      const validOrg = session.organization_id === context.organization_id;
      const validDashboard = 
        !session.dashboard_id || // Global session (no dashboard) is always valid
        !context.dashboard_id || // When in global view, all sessions are valid
        session.dashboard_id === context.dashboard_id; // In dashboard view, session must match dashboard
      
      return validOrg && validDashboard;
    });
    
    // Only update if there's a difference
    if (validSessions.length !== sessions.length) {
      console.log(`Filtered sessions from ${sessions.length} to ${validSessions.length} based on current context`);
      setSessions(validSessions);
    }
  }, [sessions, currentOrganization?.id, currentDashboard?.id, getChatContext, isLoadingSessions]);

  // Add event listener for auth state changes
  useEffect(() => {
    const handleAuthEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.authenticated) {
        console.log('Auth event received in ChatProvider - user is authenticated:', customEvent.detail.user);
        // Force a sessions reload
        setTimeout(() => {
          console.log('Forcing sessions reload after auth event');
          loadSessions();
        }, 500);
      }
    };

    window.addEventListener('auth-state-changed', handleAuthEvent);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthEvent);
    };
  }, [loadSessions]);

  // Update context value with all the state and functions
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
      // Clear the active session to trigger welcome screen display
      setActiveSessionId(null);
      // Also clear localStorage for any related messages
      if (activeSessionId) {
        const localStorageKey = `chat_messages_${activeSessionId}`;
        localStorage.removeItem(localStorageKey);
      }
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
        
        if (loadedSessions.length > 0) {
          await selectSession(loadedSessions[0].id);
        }
      } catch (error) {
        console.error('Error retrying session load:', error);
        setError(error instanceof Error ? error.message : 'Failed to load sessions');
      } finally {
        setIsLoadingSessions(false);
      }
    },
    createNewSessionImmediately,
    _emergency: {
      setSessions,
      setActiveSessionId,
      setMessages,
      setIsLoadingSessions,
      setIsLoadingMessages
    }
  };

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