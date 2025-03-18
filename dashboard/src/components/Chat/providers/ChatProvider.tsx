import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ChatMessage, MessageRole, MessageMetadata } from '../types';
import { apiService } from '../../../services/api';
import type { ChatSettings } from '../types';
import type { ChatSession } from '../../../services/api';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useDashboard } from '../../../contexts/DashboardContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useDocumentState } from '../hooks/useDocumentState';

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
  
  // Context version tracking to detect changes
  const [contextVersion, setContextVersion] = useState(0);
  
  // State machine for tracking complex operations
  const [operationState, setOperationState] = useState<{
    type: 'idle' | 'loading-sessions' | 'creating-session' | 'selecting-session' | 'deleting-session' | 'context-switch';
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
  
  // Track if a session creation is in progress to prevent duplicates
  const sessionCreationInProgress = useRef(false);
  
  // Create refs for tracking previous organization and dashboard IDs
  const prevOrgId = useRef<number | undefined>(undefined);
  const prevDashboardId = useRef<string | undefined>(undefined);
  
  // Mutex mechanism for operations
  const operationMutex = useRef<{
    locked: boolean;
    queue: Array<() => Promise<void>>;
    currentOperation: string | null;
  }>({
    locked: false,
    queue: [],
    currentOperation: null
  });
  
  // Helper to acquire the mutex for an operation
  const acquireMutex = useCallback(async (operationName: string): Promise<boolean> => {
    if (operationMutex.current.locked) {
      console.log(`Mutex locked by ${operationMutex.current.currentOperation}, ${operationName} is waiting...`);
      return false;
    }
    
    operationMutex.current.locked = true;
    operationMutex.current.currentOperation = operationName;
    console.log(`Mutex acquired for ${operationName}`);
    return true;
  }, []);
  
  // Helper to release the mutex
  const releaseMutex = useCallback(() => {
    const prevOp = operationMutex.current.currentOperation;
    operationMutex.current.locked = false;
    operationMutex.current.currentOperation = null;
    console.log(`Mutex released from ${prevOp}`);
    
    // Process next operation in queue if any
    if (operationMutex.current.queue.length > 0) {
      const nextOperation = operationMutex.current.queue.shift();
      if (nextOperation) {
        console.log(`Processing next operation from queue (${operationMutex.current.queue.length} remaining)`);
        nextOperation();
      }
    }
  }, []);
  
  // Helper to run an operation with mutex protection
  const runWithMutex = useCallback(async <T,>(
    operationName: string, 
    operation: () => Promise<T>, 
    timeout: number = 10000
  ): Promise<T> => {
    // Check if mutex is already locked
    if (operationMutex.current.locked) {
      // Create a promise that will resolve when the operation completes
      return new Promise((resolve, reject) => {
        console.log(`Queuing ${operationName} (mutex locked by ${operationMutex.current.currentOperation})`);
        
        // Add this operation to the queue
        operationMutex.current.queue.push(async () => {
          try {
            // Set a timeout to prevent deadlocks
            const timeoutId = setTimeout(() => {
              console.error(`Operation ${operationName} timed out after ${timeout}ms`);
              releaseMutex();
              reject(new Error(`Operation ${operationName} timed out`));
            }, timeout);
            
            // Acquire mutex and run operation
            operationMutex.current.locked = true;
            operationMutex.current.currentOperation = operationName;
            
            try {
              const result = await operation();
              clearTimeout(timeoutId);
              resolve(result);
            } catch (error) {
              clearTimeout(timeoutId);
              reject(error);
            } finally {
              releaseMutex();
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    // If mutex is not locked, acquire it and run operation immediately
    try {
      // Set a timeout to prevent deadlocks
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation ${operationName} timed out after ${timeout}ms`));
        }, timeout);
      });
      
      // Acquire mutex
      operationMutex.current.locked = true;
      operationMutex.current.currentOperation = operationName;
      
      // Run operation with timeout protection
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      console.error(`Error in ${operationName}:`, error);
      throw error;
    } finally {
      releaseMutex();
    }
  }, [releaseMutex]);
  
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
  
  // Unified context validation function
  const validateSessionContext = useCallback((session: ChatSession | null): boolean => {
    if (!session) return false;
    
    const context = getChatContext();
    
    // Always validate organization ID
    const validOrg = session.organization_id === context.organization_id;
    
    // Only validate dashboard ID if it's specified in the current context
    const validDashboard = !context.dashboard_id || session.dashboard_id === context.dashboard_id;
    
    if (!validOrg || !validDashboard) {
      console.warn(`Session ${session.id} has invalid context: ` + 
        `org=${session.organization_id} (expected ${context.organization_id}), ` + 
        `dashboard=${session.dashboard_id} (expected ${context.dashboard_id || 'any'})`);
      return false;
    }
    
    return true;
  }, [getChatContext]);
  
  // Utility function to filter sessions by current context
  const filterSessionsByContext = useCallback((sessionsToFilter: ChatSession[]): ChatSession[] => {
    const context = getChatContext();
    
    return sessionsToFilter.filter(session => {
      const validOrg = session.organization_id === context.organization_id;
      const validDashboard = !context.dashboard_id || session.dashboard_id === context.dashboard_id;
      
      if (!validOrg || !validDashboard) {
        console.warn(`Filtering out session ${session.id} with mismatched context - ` +
          `org: ${session.organization_id}, dashboard: ${session.dashboard_id}`);
        return false;
      }
      return true;
    });
  }, [getChatContext]);

  // Load messages for a specific session
  const loadMessagesForSession = async (
    session: ChatSession, 
    useLocalStorageOnly = false,
    skipWelcomeMessage = false
  ): Promise<void> => {
    try {
      // Set loading state
      setIsLoadingMessages(true);
      
      // Set the active session ID, which we need for other operations
      setActiveSessionId(session.id);
      
      // Initialize local storage key for this session
      const localStorageKey = `chat_messages_${session.id}`;
      
      // Try to load from localStorage first for faster loading
      let localStorageMessages: ChatMessage[] = [];
      if (!useLocalStorageOnly) {
        try {
          const storedMessages = localStorage.getItem(localStorageKey);
          if (storedMessages) {
            localStorageMessages = JSON.parse(storedMessages) as ChatMessage[];
            console.log(`Loaded ${localStorageMessages.length} messages from localStorage for session ${session.id}`);
            
            // Set messages from localStorage immediately for faster UI response
            if (localStorageMessages.length > 0) {
              setMessages(localStorageMessages);
              
              // Also update the caches
              setSessionMessages(prev => ({
                ...prev,
                [session.id]: localStorageMessages
              }));
            }
          }
        } catch (error) {
          console.error(`Error parsing stored messages for session ${session.id}:`, error);
        }
      }
      
      // Then fetch from the server to ensure we have the latest
      if (!useLocalStorageOnly) {
        try {
          // Get the current context
          const context = getChatContext();
          
          // Fetch messages from the API
          const history = await apiService.getChatHistory(session.id, context);
          
          // If we got messages from the server, use them
          if (history && history.length > 0) {
            console.log(`Loaded ${history.length} messages from server for session ${session.id}`);
            
            // Update the messages state
            setMessages(history);
            
            // Update the caches
            setSessionMessages(prev => ({
              ...prev,
              [session.id]: history
            }));
            
            // Also save to localStorage for future use
            localStorage.setItem(localStorageKey, JSON.stringify(history));
          } else if ((localStorageMessages.length === 0 && messages.length === 0) && !skipWelcomeMessage) {
            // If no messages were found and we're not skipping welcome message, create one
            const welcomeMessage: ChatMessage = {
              id: `welcome-${session.id}-${Date.now()}`,
              role: 'assistant' as MessageRole,
              content: 'Welcome! How can I help you today?',
              timestamp: Date.now(),
              status: 'complete',
              metadata: {
                sessionId: session.id,
                isWelcomeMessage: true,
                isSimpleWelcome: true // Flag to indicate this is a simple welcome message
              }
            };
            
            // Update the messages state
            setMessages([welcomeMessage]);
            
            // Update the caches
            setSessionMessages(prev => ({
              ...prev,
              [session.id]: [welcomeMessage]
            }));
            
            // Save the welcome message to localStorage
            localStorage.setItem(localStorageKey, JSON.stringify([welcomeMessage]));
          } else if (skipWelcomeMessage) {
            // If we're skipping welcome message, ensure messages array is empty
            setMessages([]);
            
            // Update the caches
            setSessionMessages(prev => ({
              ...prev,
              [session.id]: []
            }));
          }
        } catch (error) {
          console.error(`Error loading messages from server for session ${session.id}:`, error);
          
          // If we failed to load from server but have localStorage messages, keep using those
          if (localStorageMessages.length > 0) {
            console.log(`Using ${localStorageMessages.length} localStorage messages as fallback`);
            
            // Update the messages state
            setMessages(localStorageMessages);
            
            // Update the caches
            setSessionMessages(prev => ({
              ...prev,
              [session.id]: localStorageMessages
            }));
          } else if (!skipWelcomeMessage) {
            // If no messages were found and we're not skipping welcome message, create a welcome message
            const welcomeMessage: ChatMessage = {
              id: `welcome-${session.id}-${Date.now()}`,
              role: 'assistant' as MessageRole,
              content: 'Welcome! How can I help you today?',
              timestamp: Date.now(),
              status: 'complete',
              metadata: {
                sessionId: session.id,
                isWelcomeMessage: true,
                isSimpleWelcome: true // Flag to indicate this is a simple welcome message
              }
            };
            
            // Update the messages state
            setMessages([welcomeMessage]);
            
            // Update the caches
            setSessionMessages(prev => ({
              ...prev,
              [session.id]: [welcomeMessage]
            }));
            
            // Save the welcome message to localStorage
            localStorage.setItem(localStorageKey, JSON.stringify([welcomeMessage]));
          }
        }
      }
    } catch (error) {
      console.error(`Error selecting session ${session.id}:`, error);
      setError(`Failed to select chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Create a new chat session immediately, bypassing normal initialization flow
  const createNewSessionImmediately = useCallback(async (forceCreate: boolean = false, skipWelcomeMessage: boolean = false): Promise<ChatSession | null> => {
    // Use mutex to protect session creation
    return runWithMutex('createSession', async () => {
      // Update operation state
      setOperationState({
        type: 'creating-session',
        inProgress: true,
        startTime: Date.now(),
        contextVersionAtStart: contextVersion
      });
      
      // Capture current context version
      const operationContextVersion = contextVersion;
      
      try {
        // Check if we're changing data sources, in which case we should NOT create a new session
        const changingDataSource = localStorage.getItem('changing_data_source') === 'true';
        if (changingDataSource) {
          console.log('Data source change in progress - preventing new session creation');
          
          // If we're preserving the welcome screen, ensure messages are empty
          const preserveWelcomeScreen = localStorage.getItem('preserve_welcome_screen') === 'true';
          if (preserveWelcomeScreen && activeSessionId) {
            console.log('Preserving welcome screen during data source switch');
            setMessages([]);
          }
          
          setOperationState(prev => ({...prev, inProgress: false}));
          return null;
        }
        
        // Check if we already have an active session
        if (!forceCreate && activeSessionId && sessions.some(s => s.id === activeSessionId)) {
          const activeSession = sessions.find(s => s.id === activeSessionId);
          
          // Validate if session matches current context
          if (activeSession && validateSessionContext(activeSession)) {
            console.log(`Already have active valid session ${activeSessionId}, skipping creation`);
            setOperationState(prev => ({...prev, inProgress: false}));
            return activeSession || null;
          } else {
            console.log(`Active session ${activeSessionId} exists but doesn't match current context, will create new one`);
          }
        }
        
        // If context has changed during operation, abort
        if (contextVersion !== operationContextVersion) {
          console.log(`Context changed during session creation preparation (v${operationContextVersion} -> v${contextVersion}), aborting operation`);
          setOperationState(prev => ({...prev, inProgress: false}));
          return null;
        }
        
        // Get the current context
        const context = getChatContext();
        
        // Validate context
        if (!context.organization_id) {
          console.error('Missing organization_id in context, cannot create session');
          setOperationState(prev => ({...prev, inProgress: false}));
          return null;
        }
        
        // Clear messages immediately to prevent old messages from being displayed
        setMessages([]);
        
        // Generate a unique title for the new session
        const sessionTitle = `New Chat ${new Date().toLocaleTimeString()}`;
        
        // Create a new session
        console.log(`Creating new session with title "${sessionTitle}" and context: org=${context.organization_id}, dashboard=${context.dashboard_id || 'none'}`);
        const newSession = await apiService.createChatSession(sessionTitle, context);
        console.log(`Created immediate new session: ${newSession.id} with org=${newSession.organization_id}, dashboard=${newSession.dashboard_id}`);
        
        // If context has changed during API call, abort
        if (contextVersion !== operationContextVersion) {
          console.log(`Context changed during session creation API call (v${operationContextVersion} -> v${contextVersion}), discarding result`);
          setOperationState(prev => ({...prev, inProgress: false}));
          return null;
        }
        
        // Verify the session was created with the expected organization/dashboard
        if (newSession.organization_id !== context.organization_id) {
          console.warn(`Session created with wrong organization. Expected: ${context.organization_id}, Got: ${newSession.organization_id}`);
        }
        
        if (context.dashboard_id && newSession.dashboard_id !== context.dashboard_id) {
          console.warn(`Session created with wrong dashboard. Expected: ${context.dashboard_id}, Got: ${newSession.dashboard_id}`);
        }
        
        // Verify this session doesn't already exist in our list
        // Use functional update to prevent stale state issues
        let sessionExists = false;
        setSessions(prev => {
          sessionExists = prev.some(s => s.id === newSession.id);
          
          // Add to our sessions list if it doesn't already exist
          if (!sessionExists) {
            return [newSession, ...prev];
          }
          console.log(`Session ${newSession.id} already exists in sessions list, not adding again`);
          return prev;
        });
        
        // Set as active session
        setActiveSessionId(newSession.id);
        
        if (skipWelcomeMessage) {
          // For a new session, ensure no messages are carried over from previous sessions
          // Clear the session messages cache for the new session
          setSessionMessages(prev => ({
            ...prev,
            [newSession.id]: []
          }));
        } else {
          // Add welcome message for new session
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
          
          // Update the session messages cache
          setSessionMessages(prev => ({
            ...prev,
            [newSession.id]: [welcomeMessage]
          }));
        }
        
        return newSession;
      } catch (error) {
        console.error('Error creating new session immediately:', error);
        return null;
      } finally {
        // Reset the operation state
        setOperationState(prev => ({...prev, inProgress: false}));
      }
    });
  }, [
    activeSessionId, 
    sessions, 
    getChatContext, 
    apiService, 
    setMessages, 
    contextVersion,
    runWithMutex,
    validateSessionContext
  ]);

  // Load sessions from the server
  const loadSessions = useCallback(async () => {
    // Skip if not authenticated
    if (!isAuthenticated || !user) {
      console.log('Skipping session loading - user not authenticated');
      return;
    }
    
    // Execute session loading with mutex protection
    return runWithMutex('loadSessions', async () => {
      // Update operation state
      setOperationState({
        type: 'loading-sessions',
        inProgress: true,
        startTime: Date.now(),
        contextVersionAtStart: contextVersion
      });
      
      // Capture current context version at start of operation
      const operationContextVersion = contextVersion;
      
      // Check if we're in a rate-limited state
      const now = Date.now();
      const timeSinceLastRetry = now - lastRetryTime;
      const backoffTime = Math.min(30000, 1000 * Math.pow(2, retryCount));
      
      if (retryCount > 0 && timeSinceLastRetry < backoffTime) {
        console.log(`Skipping session load - in backoff period. Waiting ${(backoffTime - timeSinceLastRetry) / 1000}s`);
        setOperationState(prev => ({...prev, inProgress: false}));
        return;
      }
      
      // Debounce: prevent loading too frequently
      const timeSinceLastLoad = now - lastLoadTime;
      if (timeSinceLastLoad < MIN_LOAD_INTERVAL) {
        console.log(`Debouncing session load - last load was ${timeSinceLastLoad / 1000}s ago`);
        setOperationState(prev => ({...prev, inProgress: false}));
        return;
      }
      
      // Update last load time
      setLastLoadTime(now);
      
      // Get current context using the helper function
      const context = getChatContext();
      const contextKey = `org=${context.organization_id},dash=${context.dashboard_id || 'none'}`;
      console.log(`Loading sessions with context: ${contextKey}`);
      
      // If context has changed since operation started, abort
      if (contextVersion !== operationContextVersion) {
        console.log(`Context changed during session loading (v${operationContextVersion} -> v${contextVersion}), aborting operation`);
        setOperationState(prev => ({...prev, inProgress: false}));
        return;
      }
      
      // Set loading state
      setIsLoadingSessions(true);
      
      try {
        // Check if we have a valid cache for all sessions
        const cacheKey = `sessions_${JSON.stringify(context)}`;
        if (isCacheValid(cacheKey) && sessionCache[cacheKey]) {
          console.log(`Using cached sessions from ${(now - cacheTimestamp[cacheKey]) / 1000}s ago`);
          
          // Apply context filter to cached sessions to be safe
          const validSessions = filterSessionsByContext(sessionCache[cacheKey]);
          
          // Update with a functional update to avoid stale state
          setSessions(validSessions);
          setIsLoadingSessions(false);
          
          // Verify if active session is still valid in this context
          if (activeSessionId) {
            const validSession = validSessions.find(s => s.id === activeSessionId);
            if (!validSession) {
              console.log(`Active session ${activeSessionId} is not valid in current context, clearing it`);
              setActiveSessionId(null);
              setMessages([]);
            }
          }
          
          setOperationState(prev => ({...prev, inProgress: false}));
          return;
        }
        
        // Fetch sessions from the server
        const fetchedSessions = await apiService.getChatSessions(context);
        console.log(`Successfully fetched ${fetchedSessions.length} chat sessions for context: ${contextKey}`);
        
        // Check if context has changed during fetch
        if (contextVersion !== operationContextVersion) {
          console.log(`Context changed during fetch (v${operationContextVersion} -> v${contextVersion}), discarding results`);
          setOperationState(prev => ({...prev, inProgress: false}));
          return;
        }
        
        // Reset retry count on success
        if (retryCount > 0) {
          setRetryCount(0);
          setLastRetryTime(0);
        }
        
        // Verify each session has correct context using our validation function
        const validSessions = filterSessionsByContext(fetchedSessions);
        
        if (validSessions.length !== fetchedSessions.length) {
          console.warn(`Filtered out ${fetchedSessions.length - validSessions.length} sessions with invalid context`);
        }
        
        // Cache filtered sessions
        setSessionCache(prev => ({ ...prev, [cacheKey]: validSessions }));
        setCacheTimestamp(prev => ({ ...prev, [cacheKey]: Date.now() }));
        
        // Create a map for quick lookup
        const sessionsMap: Record<string, ChatSession> = {};
        validSessions.forEach(session => {
          sessionsMap[session.id] = session;
        });
        
        // Update state with functional updates
        setSessions(validSessions);
        
        // If we have an active session, check if it's still valid
        if (activeSessionId && sessionsMap[activeSessionId]) {
          // The active session is still valid in the new context, load its messages
          await loadMessagesForSession(sessionsMap[activeSessionId]);
        } else if (validSessions.length > 0 && !activeSessionId) {
          // If no active session but we have sessions, select the most recent one
          const mostRecent = validSessions.sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0];
          
          console.log(`No active session, selecting most recent: ${mostRecent.id}`);
          setActiveSessionId(mostRecent.id);
          await loadMessagesForSession(mostRecent);
        } else if (validSessions.length === 0) {
          // If no sessions exist for this context, create a new one
          console.log('No sessions exist for this context, creating a new one');
          
          // Clear any existing active session first
          if (activeSessionId) {
            setActiveSessionId(null);
            setMessages([]);
          }
          
          // Create a new session with current context
          await createNewSessionImmediately(true, true);
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
            
            // Filter sessions by current context using our validation function
            const filteredSessions = filterSessionsByContext(parsedSessions);
            
            console.log(`Filtered to ${filteredSessions.length} sessions matching current context`);
            setSessions(filteredSessions);
            
            // If we have an active session, verify it's valid in current context
            if (activeSessionId) {
              const activeSession = filteredSessions.find(s => s.id === activeSessionId);
              if (activeSession) {
                await loadMessagesForSession(activeSession, true);
              } else {
                // Clear invalid active session
                setActiveSessionId(null);
                setMessages([]);
                
                // Select another valid session if available
                if (filteredSessions.length > 0) {
                  setActiveSessionId(filteredSessions[0].id);
                  await loadMessagesForSession(filteredSessions[0], true);
                }
              }
            }
          }
        } catch (localStorageError) {
          console.error('Error loading sessions from localStorage:', localStorageError);
        }
        
        setError('Failed to load chat sessions. Please try again later.');
      } finally {
        setIsLoadingSessions(false);
        setOperationState(prev => ({...prev, inProgress: false}));
      }
    });
  }, [
    activeSessionId,
    isAuthenticated,
    user,
    retryCount,
    lastRetryTime,
    lastLoadTime,
    sessionCache,
    cacheTimestamp,
    getChatContext,
    loadMessagesForSession,
    createNewSessionImmediately,
    contextVersion,
    runWithMutex,
    filterSessionsByContext,
    isCacheValid
  ]);

  // Document state for persistence between sessions
  const documentState = useDocumentState();

  // Add a cleanup effect to detect and fix stale operation states
  useEffect(() => {
    // Only run cleanup if an operation is in progress
    if (!operationState.inProgress) return;
    
    // Maximum duration for various operations
    const maxDurations: Record<string, number> = {
      'loading-sessions': 30000, // 30 seconds
      'creating-session': 15000, // 15 seconds
      'selecting-session': 10000, // 10 seconds
      'deleting-session': 10000, // 10 seconds
      'context-switch': 20000, // 20 seconds
      'idle': 10000 // Default for idle (shouldn't happen, but just in case)
    };
    
    // Set a timeout to detect stale operations
    const timeoutId = setTimeout(() => {
      const now = Date.now();
      const operationDuration = now - operationState.startTime;
      const maxDuration = maxDurations[operationState.type] || 10000;
      
      if (operationDuration > maxDuration) {
        console.warn(`Operation ${operationState.type} has been running for ${operationDuration}ms, exceeding max duration of ${maxDuration}ms. Forcing cleanup.`);
        
        // Force reset operation state
        setOperationState({
          type: 'idle',
          inProgress: false,
          startTime: 0,
          contextVersionAtStart: contextVersion
        });
        
        // Release mutex if it's locked
        if (operationMutex.current.locked) {
          console.warn(`Mutex locked by ${operationMutex.current.currentOperation}, forcing release`);
          operationMutex.current.locked = false;
          operationMutex.current.currentOperation = null;
          
          // Process any queued operations
          if (operationMutex.current.queue.length > 0) {
            console.log(`Processing next operation from queue after forced cleanup (${operationMutex.current.queue.length} remaining)`);
            const nextOperation = operationMutex.current.queue.shift();
            if (nextOperation) nextOperation();
          }
        }
        
        // Force loading state to false
        setIsLoadingSessions(false);
        setIsLoadingMessages(false);
        
        // Reset session creation flag
        sessionCreationInProgress.current = false;
      }
    }, maxDurations[operationState.type] || 10000);
    
    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId);
  }, [operationState, contextVersion]);

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

  // Prepare the context value
  const value: ChatContextType = {
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
    <ChatContext.Provider value={value}>
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

const selectSession = useCallback(async (sessionId: string): Promise<void> => {
  return runWithMutex('selectSession', async () => {
    // Update operation state
    setOperationState({
      type: 'selecting-session',
      inProgress: true,
      operationId: sessionId,
      startTime: Date.now(),
      contextVersionAtStart: contextVersion
    });
    
    // Capture current context version
    const operationContextVersion = contextVersion;
    
    try {
      console.log(`Attempting to select session: ${sessionId}`);
      
      // Find the session in our current sessions list using functional update
      // to avoid stale state references
      let selectedSession: ChatSession | undefined;
      
      // Use a safer approach to find the session
      selectedSession = sessions.find(s => s.id === sessionId);
      
      // If session not found, try looking in the cache
      if (!selectedSession) {
        for (const [key, cachedSessions] of Object.entries(sessionCache)) {
          if (isCacheValid(key)) {
            const cachedSession = cachedSessions.find(s => s.id === sessionId);
            if (cachedSession) {
              selectedSession = cachedSession;
              break;
            }
          }
        }
      }
      
      if (!selectedSession) {
        console.error(`Session ${sessionId} not found in current sessions list or cache`);
        throw new Error('Session not found in the current context');
      }
      
      // Check if context has changed during operation
      if (contextVersion !== operationContextVersion) {
        console.log(`Context changed during session selection (v${operationContextVersion} -> v${contextVersion}), aborting operation`);
        setOperationState(prev => ({...prev, inProgress: false}));
        return;
      }
      
      // Use our unified validation function to check if session can be selected in current context
      if (!validateSessionContext(selectedSession)) {
        console.error(`Session ${sessionId} is not valid in the current context`);
        throw new Error(`This chat session belongs to a different context and cannot be selected`);
      }
      
      // Set loading state
      setIsLoadingMessages(true);
      setError(null);
      
      // Load messages for this session
      await loadMessagesForSession(selectedSession);
      
      console.log(`Successfully loaded messages for session ${sessionId}`);
    } catch (error) {
      console.error('Error selecting chat session:', error);
      setError(error instanceof Error ? error.message : 'Failed to select chat session');
      
      // If selection fails, try to create a new session instead
      console.log('Creating a new fallback session');
      try {
        await createSession("New Chat", true);
      } catch (createError) {
        console.error('Error creating fallback session:', createError);
      }
    } finally {
      setIsLoadingMessages(false);
      setOperationState(prev => ({...prev, inProgress: false}));
    }
  });
}, [
  sessions, 
  sessionCache, 
  loadMessagesForSession, 
  createSession, 
  validateSessionContext, 
  contextVersion, 
  runWithMutex,
  isCacheValid
]); 