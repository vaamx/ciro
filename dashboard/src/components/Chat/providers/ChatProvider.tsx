import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { ChatMessage, MessageRole, MessageMetadata, MessageStatus } from '../types';
import { apiService } from '../../../services/api';
import type { ChatSettings } from '../types';
import type { ChatSession } from '../../../services/api';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useDashboard } from '../../../contexts/DashboardContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { ChatContext as ApiChatContext } from '../../../services/api';
import { useDocumentState } from '../hooks/useDocumentState';
import { eventEmitter, EventType } from '../../../services/events';

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
  const createNewSessionImmediately = useCallback(async (force_create: boolean = false, skipWelcomeMessage: boolean = false): Promise<ChatSession | null> => {
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
      
      return null;
    }
    
    // Prevent multiple simultaneous session creations
    if (sessionCreationInProgress.current) {
      console.log('Session creation already in progress, skipping duplicate request');
      return null;
    }
    
    sessionCreationInProgress.current = true;
    console.log('Creating new session immediately, bypassing loading');
    
    try {
      // Check if we already have an active session
      if (!force_create && activeSessionId && sessions.some(s => s.id === activeSessionId)) {
        console.log(`Already have active session ${activeSessionId}, skipping creation`);
        sessionCreationInProgress.current = false;
        return sessions.find(s => s.id === activeSessionId) || null;
      }
      
      // Get the current context
      const context = getChatContext();
      
      // Clear messages immediately to prevent old messages from being displayed
      setMessages([]);
      
      // Generate a unique title for the new session
      const sessionTitle = `New Chat ${new Date().toLocaleTimeString()}`;
      
      // Create a new session
      const newSession = await apiService.createChatSession(sessionTitle, context);
      console.log(`Created immediate new session: ${newSession.id}`);
      
      // Add to our sessions list first, checking for duplicates
      setSessions(prev => {
        // Check if this session already exists
        const exists = prev.some(s => s.id === newSession.id);
        if (exists) {
          console.log(`Session ${newSession.id} already exists, not adding duplicate`);
          return prev;
        }
        return [newSession, ...prev];
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
      }
      
      return newSession;
    } catch (error) {
      console.error('Error creating new session immediately:', error);
      return null;
    } finally {
      // Reset the flag regardless of success or failure
      sessionCreationInProgress.current = false;
    }
  }, [activeSessionId, sessions, getChatContext, apiService]);

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

  // Add a new effect to save messages to localStorage whenever they change
  useEffect(() => {
    // Only save if we have an active session and messages
    if (activeSessionId && messages.length > 0) {
      try {
        // Save to localStorage
        const localStorageKey = `chat_messages_${activeSessionId}`;
        localStorage.setItem(localStorageKey, JSON.stringify(messages));
        
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

  // Improved selectChatSession with context validation
  const selectChatSession = useCallback(async (sessionId: string): Promise<void> => {
    // Skip if already selected
    if (sessionId === activeSessionId) {
      console.log(`Session ${sessionId} is already active`);
      return;
    }
    
    try {
      // Set loading messages state
      setIsLoadingMessages(true);
      
      // Reset error
      setError(null);
      
      // Update operation state
      setOperationState({
        type: 'selecting-session',
        inProgress: true,
        operationId: `select-session-${Date.now()}`,
        startTime: Date.now(),
        contextVersionAtStart: contextVersion
      });
      
      console.log(`Selecting session ${sessionId}`);
      
      // Find the session in our current list
      const session = sessions.find(s => s.id === sessionId);
      
      // Check if session exists
      if (!session) {
        throw new Error(`Session ${sessionId} not found in current sessions list`);
      }
      
      // Get current context
      const context = getChatContext();
      
      // FIXED: More permissive validation for dashboard_id:
      // - Sessions must belong to the current organization
      // - If the session has a dashboard_id, check if it matches only when context also has a dashboard_id
      // - Allow global sessions (no dashboard_id) to be selected from any dashboard
      const validOrg = session.organization_id === context.organization_id;
      const validDashboard = 
        !session.dashboard_id || // Global session (no dashboard) is always valid
        !context.dashboard_id || // When in global view, all sessions are valid
        session.dashboard_id === context.dashboard_id; // In dashboard view, session must match dashboard
      
      if (!validOrg || !validDashboard) {
        console.warn(`Session ${sessionId} has invalid context for current view:`,
          { sessionContext: { org: session.organization_id, dashboard: session.dashboard_id },
            currentContext: context });
        
        // Create a more user-friendly error message
        let errorMsg = "This chat session is not available in the current view.";
        
        if (!validOrg) {
          errorMsg = "This chat session belongs to a different organization.";
        } else if (!validDashboard) {
          errorMsg = "This chat session belongs to a different dashboard.";
          
          // If the session has a dashboard but we're in global view, provide guidance
          if (session.dashboard_id && !context.dashboard_id) {
            errorMsg = "This chat is associated with a specific dashboard. Please navigate to that dashboard to view it.";
          }
          // If we're in a dashboard but the session is for another dashboard
          else if (session.dashboard_id && context.dashboard_id) {
            errorMsg = `This chat is associated with a different dashboard (${session.dashboard_id}).`;
          }
        }
        
        // Add context check to the sessions list in the UI
        // Update sessions filter to store the available sessions for display
        setSessions(prev => {
          // Mark the filtering operation so UI can detect it
          const filtered = prev.filter(s => {
            const validForCurrentOrg = s.organization_id === context.organization_id;
            const validForCurrentDashboard = 
              !s.dashboard_id || 
              !context.dashboard_id ||
              s.dashboard_id === context.dashboard_id;
            
            return validForCurrentOrg && validForCurrentDashboard;
          });
          
          // Log how many sessions were filtered out
          if (prev.length !== filtered.length) {
            console.log(`Filtered out ${prev.length - filtered.length} sessions that don't match current context.`);
          }
          
          return filtered;
        });
        
        throw new Error(errorMsg);
      }
      
      // Fetch messages or use cache
      if (sessionMessages[sessionId]) {
        console.log(`Using cached messages for session ${sessionId}`);
        setMessages(sessionMessages[sessionId]);
      } else {
        try {
          // Load messages from API
          const fetchedMessages = await apiService.getChatHistory(sessionId, context);
          
          // Check for context change during loading
          if (contextVersion !== operationState.contextVersionAtStart) {
            console.log('Context changed during message loading. Re-validating session in new context.');
            
            // Get the new context after the change
            const newContext = getChatContext();
            
            // Re-validate session in the new context
            const stillValidOrg = session.organization_id === newContext.organization_id;
            const stillValidDashboard = 
              !session.dashboard_id || 
              !newContext.dashboard_id || 
              session.dashboard_id === newContext.dashboard_id;
            
            // If still valid in the new context, use the fetched messages
            if (stillValidOrg && stillValidDashboard) {
              console.log(`Session ${sessionId} is still valid in new context. Proceeding with selection.`);
              setMessages(fetchedMessages);
              setSessionMessages(prev => ({
                ...prev,
                [sessionId]: fetchedMessages
              }));
              
              // Save to local storage as backup
              try {
                localStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(fetchedMessages));
              } catch (error) {
                console.warn('Failed to save messages to localStorage:', error);
              }
            } else {
              // If not valid in the new context, abort with a more specific error
              console.warn(`Session ${sessionId} is no longer valid in new context:`,
                { sessionContext: { org: session.organization_id, dashboard: session.dashboard_id },
                  newContext });
              throw new Error('Session is not valid in the new context after context change');
            }
          } else {
            // No context change, proceed normally
            console.log(`Loaded ${fetchedMessages.length} messages for session ${sessionId}`);
            
            // Update messages state and cache
            setMessages(fetchedMessages);
            setSessionMessages(prev => ({
              ...prev,
              [sessionId]: fetchedMessages
            }));
            
            // Save to local storage as backup
            try {
              localStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(fetchedMessages));
            } catch (error) {
              console.warn('Failed to save messages to localStorage:', error);
            }
          }
        } catch (loadError: unknown) {
          console.error(`Error loading messages for session ${sessionId}:`, loadError);
          
          // If error is not context-related, check if we have localStorage fallback
          if (loadError instanceof Error && loadError.message !== 'Context changed during operation') {
            try {
              const localStorageKey = `chat_messages_${sessionId}`;
              const storedMessages = localStorage.getItem(localStorageKey);
              
              if (storedMessages) {
                console.log(`Using localStorage fallback for session ${sessionId}`);
                const parsedMessages = JSON.parse(storedMessages) as ChatMessage[];
                
                setMessages(parsedMessages);
                setSessionMessages(prev => ({
                  ...prev,
                  [sessionId]: parsedMessages
                }));
              } else {
                // No fallback available, re-throw the original error
                throw loadError;
              }
            } catch (fallbackError) {
              console.error(`Fallback also failed for session ${sessionId}:`, fallbackError);
              throw loadError; // Re-throw the original error
            }
          } else {
            // Re-throw context-related errors
            throw loadError;
          }
        }
      }
      
      // Update active session
      setActiveSessionId(sessionId);
      
      // Update operation state
      setOperationState({
        type: 'idle',
        inProgress: false,
        startTime: 0,
        contextVersionAtStart: contextVersion
      });
    } catch (error) {
      console.error(`Error selecting session ${sessionId}:`, error);
      
      // Create a helpful error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to select session';
      
      setError(errorMessage);
      
      // Update operation state
      setOperationState({
        type: 'idle',
        inProgress: false,
        startTime: 0,
        contextVersionAtStart: contextVersion
      });
    } finally {
      // Always clear loading state
      setIsLoadingMessages(false);
    }
  }, [
    activeSessionId, 
    contextVersion, 
    getChatContext, 
    operationState.contextVersionAtStart, 
    sessionMessages, 
    sessions
  ]);

  const createSession = useCallback(async (title?: string, skipWelcomeMessage: boolean = false): Promise<ChatSession> => {
    try {
      const context = getChatContext();
      if (!context.organization_id || !context.dashboard_id) {
        throw new Error('Organization ID and Dashboard ID are required to create a chat session');
      }

      // Set loading state
      setIsLoadingMessages(true);
      setError(null);
      
      // Generate a default title if none provided
      const sessionTitle = title || `New Chat ${new Date().toLocaleTimeString()}`;
      console.log(`Creating new session with title: ${sessionTitle}`);
      
      // Create the session via API
      const newSession = await apiService.createChatSession(sessionTitle, context);
      console.log(`Successfully created session with ID: ${newSession.id}`);
      
      // Update sessions list with the new session at the beginning
      setSessions(prev => {
        // Check if this session already exists to prevent duplicates
        const exists = prev.some(s => s.id === newSession.id);
        if (exists) {
          console.log(`Session ${newSession.id} already exists, not adding duplicate`);
          return prev;
        }
        return [newSession, ...prev];
      });
      
      // Set the active session ID immediately to update the UI
      setActiveSessionId(newSession.id);
      
      // If skipWelcomeMessage is true, we'll handle loading the session with the flag
      if (skipWelcomeMessage) {
        // Load the session but skip creating a welcome message
        await loadMessagesForSession(newSession, false, true);
      } else {
        // Create a welcome message for the new session
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
        
        // Update the messages state
        setMessages([welcomeMessage]);
        
        // Update the caches
        setSessionMessages(prev => ({
          ...prev,
          [newSession.id]: [welcomeMessage]
        }));
        
        setSessionMessages(prev => ({
          ...prev,
          [newSession.id]: [welcomeMessage]
        }));
        
        // Save the welcome message to localStorage
        const localStorageKey = `chat_messages_${newSession.id}`;
        localStorage.setItem(localStorageKey, JSON.stringify([welcomeMessage]));
      }
      
      return newSession;
    } catch (error) {
      console.error('Error creating chat session:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chat session');
      throw error; // Re-throw to allow proper handling
    } finally {
      setIsLoadingMessages(false);
    }
  }, [getChatContext, loadMessagesForSession]);

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
          await selectChatSession(remainingSessions[0].id);
          
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
  }, [sessions, activeSessionId, selectChatSession, getChatContext, createSession, documentState]);

  // Add a comment to explain why the functions were commented out
  // The functions above (addOrUpdateMessage, saveChatHistory, and updateMessagesForSession)
  // were originally used for message management but are now handled directly in other functions.
  // They've been preserved as reference but commented out to prevent lint warnings.

  const sendMessage = useCallback(async (content: any, isAssistantMessage = false): Promise<void> => {
    if (!activeSessionId) {
      console.error('No active session to send message to');
      setError('No active chat session. Please create a new chat or select an existing one.');
      return;
    }

    // Set operation state to track context version
    setOperationState({
      type: 'message-sending',
      inProgress: true,
      operationId: `send-message-${Date.now()}`,
      startTime: Date.now(),
      contextVersionAtStart: contextVersion
    });

    // Handle both structured (object) and string messages
    let messageContent = '';
    let messageMetadata: MessageMetadata = {};

    if (typeof content === 'object' && content !== null) {
      // Process structured message
      if (content.content) {
        messageContent = content.content;
      } else {
        messageContent = JSON.stringify(content);
      }
      
      if (content.metadata) {
        messageMetadata = { ...content.metadata };
      } else if (content.structuredResponse) {
        // Store structured response in metadata
        messageMetadata.structuredResponse = content.structuredResponse;
      }
    } else {
      // Simple string message
      messageContent = String(content);
    }

    // Create a properly formatted message object
    const messageObj: ChatMessage = {
      id: isAssistantMessage ? `assistant-${Date.now()}` : `user-${Date.now()}`,
      role: isAssistantMessage ? 'assistant' : 'user' as MessageRole,
      content: messageContent,
      timestamp: Date.now(),
      status: 'complete',
      metadata: messageMetadata
    };

    try {
      // Get the current messages
      const currentMessages = sessionMessages[activeSessionId] || messages;
      
      // Add the user message to the current messages
      const messagesWithUserInput = isAssistantMessage 
        ? currentMessages 
        : [...currentMessages, messageObj];
      
      // IMPORTANT: Always update the messages state directly to ensure user message is visible
      setMessages(messagesWithUserInput);
      
      // Also update the session cache
      setSessionMessages(prev => ({
        ...prev,
        [activeSessionId]: messagesWithUserInput
      }));
      
      if (!isAssistantMessage) {
        console.log(`Added user message to chat. Total messages: ${messagesWithUserInput.length}`, 
          messagesWithUserInput.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) })));
      }
      
      // Create placeholder for assistant response
      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: 'Thinking...',
        timestamp: Date.now(),
        status: 'loading',
        metadata: {
          isLoading: true,
          isSimpleLoading: true, // Flag to indicate this is a simple loading message
          suppressVisualization: true, // Flag to prevent visualization
          forceSimpleDisplay: true, // Flag to force simple display
          skipEnhancedVisualization: true // Flag to skip enhanced visualization
        }
      };
      
      // Add loading message to both current view and session cache
      const updatedWithAssistant = [...messagesWithUserInput, assistantMsg];
      
      // IMPORTANT: Always update the messages state directly
      setMessages(updatedWithAssistant);
      
      // Also update the session cache
      setSessionMessages(prev => ({
        ...prev,
        [activeSessionId]: updatedWithAssistant
      }));
      
      console.log(`Added assistant loading message. Total messages: ${updatedWithAssistant.length}`, 
        updatedWithAssistant.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) })));
      
      try {
        setIsGenerating(true);
        setError(null);
        
        // Save the context version at the start
        const contextVersionBeforeSend = contextVersion;
        
        // Call the API service to generate a response
        const response = await apiService.sendMessage(
          activeSessionId,
          messageContent,
          getChatContext(),
          settings
        );
        
        // Check if context changed during the API call
        if (contextVersion !== contextVersionBeforeSend) {
          console.log('Context changed during message generation. Verifying if still valid...');
          
          // Get the current session
          const session = sessions.find(s => s.id === activeSessionId);
          if (!session) {
            throw new Error('Session no longer exists');
          }
          
          // Get the new context
          const newContext = getChatContext();
          
          // Validate session in the new context
          const validOrg = session.organization_id === newContext.organization_id;
          const validDashboard = 
            !session.dashboard_id || 
            !newContext.dashboard_id || 
            session.dashboard_id === newContext.dashboard_id;
          
          if (!validOrg || !validDashboard) {
            console.warn('Session is no longer valid in the new context. Response will not be displayed.');
            throw new Error('Session is not valid in new context after context change');
          }
          
          console.log('Session is still valid in new context. Continuing to display response.');
        }
        
        // Use type guard to check for suppression flag
        if (response && response.metadata && 
            typeof response.metadata === 'object' && 
            'suppressDuplicateDisplay' in response.metadata && 
            response.metadata.suppressDuplicateDisplay === true) {
          console.log('Message has suppressDuplicateDisplay flag, updating message display');
          
          const updatedAssistantMsg: ChatMessage = {
            ...assistantMsg,
            content: response.content,
            status: 'complete',
            metadata: {
              ...assistantMsg.metadata,
              // First apply the original metadata
              ...(response.metadata as MessageMetadata),
              // Ensure these flags are set
              suppressDirectDisplay: true,
              useStructuredDisplay: true
            }
          };
          
          // Save document state if this is a document-related message
          documentState.setDocumentStateForMessage(updatedAssistantMsg, activeSessionId);
          
          // Update messages - ensure we keep the user message
          const finalMessages = updatedWithAssistant.map(m => 
            m.id === assistantMsgId ? updatedAssistantMsg : m
          );
          
          // IMPORTANT: Always update the messages state directly
          setMessages(finalMessages);
          
          // Also update the session cache
          setSessionMessages(prev => ({
            ...prev,
            [activeSessionId]: finalMessages
          }));
          
          console.log(`Updated assistant message with response. Total messages: ${finalMessages.length}`, 
            finalMessages.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) })));
          
          // Update the session with the latest message and count
          try {
            // Find the current session
            const currentSession = sessions.find(s => s.id === activeSessionId);
            if (currentSession) {
              // Get the last message content
              const lastMessageContent = response.content || 'AI response';
              
              // Calculate new message count (user message + assistant response)
              const newMessageCount = (currentSession.message_count || 0) + 2;
              
              // Update the session metadata
              apiService.updateChatSession(
                activeSessionId,
                currentSession.title,
                lastMessageContent,
                newMessageCount,
                getChatContext()
              ).then(() => {
                // Update the sessions list
                setSessions(prev => prev.map(session => 
                  session.id === activeSessionId ? { 
                    ...session, 
                    last_message: lastMessageContent,
                    message_count: newMessageCount
                  } : session
                ));
              }).catch(error => {
                console.error('Error updating session metadata after response:', error);
              });
            }
          } catch (updateError) {
            console.error('Error updating session metadata:', updateError);
          }
          
          setIsGenerating(false);
        } else {
          // Process the response
          const updatedAssistantMsg: ChatMessage = {
            ...assistantMsg,
            content: response.content,
            status: 'complete',
            metadata: {
              ...(response.metadata || {}),
              // Convert tokens format if needed
              tokens: typeof response.metadata?.tokens === 'object' 
                ? response.metadata.tokens.total
                : response.metadata?.tokens
            }
          };
          
          // Save document state if this is a document-related message
          documentState.setDocumentStateForMessage(updatedAssistantMsg, activeSessionId);
          
          // Update messages - ensure we keep the user message
          const finalMessages = updatedWithAssistant.map(m => 
            m.id === assistantMsgId ? updatedAssistantMsg : m
          );
          
          // IMPORTANT: Always update the messages state directly
          setMessages(finalMessages);
          
          // Also update the session cache
          setSessionMessages(prev => ({
            ...prev,
            [activeSessionId]: finalMessages
          }));
          
          console.log(`Updated assistant message with response. Total messages: ${finalMessages.length}`, 
            finalMessages.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) })));
          
          setIsGenerating(false);
        }
      } catch (error: unknown) {
        console.error('Error generating assistant response:', error);
        
        // Create error message
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate response';
        
        // Check if it's a context change error
        const isContextError = error instanceof Error && 
          error.message === 'Session is not valid in new context after context change';
        
        if (isContextError) {
          // For context errors, show specific message
          setError('The organization or dashboard changed while generating a response. Please try again.');
        } else {
          // For other errors
          setError(`Failed to generate a response: ${errorMessage}`);
        }
        
        // Update the loading message to show error
        const finalMessages = updatedWithAssistant.map(m => 
          m.id === assistantMsgId ? {
            ...assistantMsg,
            content: 'Error: ' + errorMessage,
            status: 'error' as MessageStatus,
            metadata: {
              ...assistantMsg.metadata,
              isLoading: false,
              isError: true,
              error: errorMessage
            }
          } : m
        );
        
        setMessages(finalMessages as ChatMessage[]);
        setSessionMessages(prev => ({
          ...prev,
          [activeSessionId]: finalMessages as ChatMessage[]
        }));
        
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // Reset operation state
      setOperationState({
        type: 'idle',
        inProgress: false,
        startTime: 0,
        contextVersionAtStart: contextVersion
      });
    }
  }, [
    activeSessionId, 
    contextVersion, 
    documentState, 
    getChatContext, 
    messages, 
    sessionMessages, 
    sessions,
    settings
  ]);

  const regenerateMessage = useCallback(async (message: ChatMessage) => {
    if (!activeSessionId) {
      console.error('Cannot regenerate message: No active session');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      // Logic to regenerate the message
      console.log(`Regenerating message ${message.id} for session ${activeSessionId}`);
      
      // Replace the message with loading message
      setMessages(prev => {
        const updated = [...prev];
        const index = updated.findIndex(m => m.id === message.id);
        if (index !== -1) {
          updated[index] = { ...updated[index], content: 'Regenerating...' };
        }
        return updated;
      });
      
      // For now, just create a simple regenerated message
      setTimeout(() => {
        setMessages(prev => {
          const updated = [...prev];
          const index = updated.findIndex(m => m.id === message.id);
          if (index !== -1) {
            updated[index] = { 
              ...updated[index], 
              content: `Regenerated at ${new Date().toLocaleTimeString()}`
            };
          }
          return updated;
        });
        setIsGenerating(false);
      }, 1000);
      
    } catch (error: any) {
      console.error('Error regenerating message:', error);
      setError(`Error regenerating message: ${error.message}`);
      setIsGenerating(false);
    }
  }, [activeSessionId]);

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
    selectSession: selectChatSession,
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
          await selectChatSession(loadedSessions[0].id);
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