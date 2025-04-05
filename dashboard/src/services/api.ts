import type { ChatMessage, ChatSettings, MessageRole } from '../components/Chat/types';
import { emitApiRateLimit, emitApiError, emitApiSuccess, emitApiRateLimitExceeded } from './events';
import { logger } from '../utils/logger';
// The baseUrl is hardcoded in the constructor so we don't need external API configuration

// Component name for logging
const COMPONENT_NAME = 'api';

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
  } | number;
  suggestions?: string[];
  analyticalResponse?: any;
  isMultiStep?: boolean;
  messageType?: string;
  contentType?: string;
  dataStructure?: string;
  processingType?: string;
  structuredResponse?: any;
  steps?: Array<{
    id: string;
    type: string;
    description: string;
    order: number;
    content?: string;
  }>;
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
  // Use snake_case naming to match backend API requirements
  organization_id?: number;
  dashboard_id?: string;
}

// Legacy support interface for internal usage
interface LegacyChatContext {
  organizationId?: number;
  dashboardId?: string;
}

// Helper function to normalize context with proper naming
function normalizeContext(context?: LegacyChatContext | ChatContext): ChatContext | undefined {
  if (!context) return undefined;
  
  // Create a new context object with proper snake_case naming
  return {
    organization_id: (context as any).organization_id || (context as any).organizationId,
    dashboard_id: (context as any).dashboard_id || (context as any).dashboardId
  };
}

export interface ApiService {
  getChatSessions: (context?: ChatContext) => Promise<ChatSession[]>;
  createChatSession: (title?: string, context?: ChatContext) => Promise<ChatSession>;
  updateChatSession: (sessionId: string, title: string, lastMessage?: string, messageCount?: number, context?: ChatContext) => Promise<ChatSession>;
  deleteChatSession: (sessionId: string, context?: ChatContext) => Promise<void>;
  getChatHistory: (sessionId: string, context?: ChatContext) => Promise<ChatMessage[]>;
  getChatHistoryComplete: (sessionId: string, context?: ChatContext) => Promise<ChatMessage[]>;
  saveChatHistory: (sessionId: string, messages: ChatMessage[], context?: ChatContext) => Promise<void>;
  sendMessage: (sessionId: string, message: string, context?: ChatContext, options?: any) => Promise<ChatResponse>;
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

// Global rate limiting state
const globalRateLimitState = {
  isRateLimited: false,
  rateLimitedUntil: 0,
  retryCount: 0,
  maxRetries: 3,
  baseDelay: 2000, // 2 seconds base delay
  absoluteMaxRetries: 10, // After this many retries, we'll back off completely for a longer time
  backoffComplete: false, // Whether we've backed off completely
  requestQueue: [] as {
    url: string;
    options: RequestInit;
    priority: number;
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }[],
  processingQueue: false
};

// Function to check if we're currently rate limited
function isGloballyRateLimited(): boolean {
  if (!globalRateLimitState.isRateLimited) return false;
  
  const now = Date.now();
  if (now >= globalRateLimitState.rateLimitedUntil) {
    // Reset rate limit state if the time has passed
    globalRateLimitState.isRateLimited = false;
    return false;
  }
  
  return true;
}

// Function to set global rate limit
function setGlobalRateLimit(endpoint: string, retryAfterMs?: number): void {
  globalRateLimitState.isRateLimited = true;
  globalRateLimitState.retryCount++;
  
  // Calculate delay with exponential backoff
  const delay = retryAfterMs || 
    Math.min(30000, globalRateLimitState.baseDelay * Math.pow(2, globalRateLimitState.retryCount - 1));
  
  globalRateLimitState.rateLimitedUntil = Date.now() + delay;
  
  logger.warn(COMPONENT_NAME, `Global rate limit set: waiting ${delay}ms before making more API calls. Retry count: ${globalRateLimitState.retryCount}`);
  
  // Emit event for other components to react
  emitApiRateLimit(endpoint, delay);
  
  // If we've hit the absolute max retries, back off completely for a longer time
  if (globalRateLimitState.retryCount >= globalRateLimitState.absoluteMaxRetries && !globalRateLimitState.backoffComplete) {
    const longBackoffTime = 60000; // 1 minute
    logger.warn(COMPONENT_NAME, `Hit absolute maximum retries (${globalRateLimitState.absoluteMaxRetries}), backing off for ${longBackoffTime / 1000} seconds`);
    globalRateLimitState.rateLimitedUntil = Date.now() + longBackoffTime;
    globalRateLimitState.backoffComplete = true;
    
    // Emit a special event for the UI to show a user-friendly message
    const message = `Rate limit exceeded. The application will pause API calls for ${longBackoffTime / 1000} seconds to prevent further rate limiting.`;
    emitApiRateLimitExceeded(endpoint, longBackoffTime, message);
    
    // Schedule a reset of the rate limit state
    setTimeout(() => {
      logger.log(COMPONENT_NAME, 'Resetting global rate limit state after long backoff');
      globalRateLimitState.retryCount = 0;
      globalRateLimitState.isRateLimited = false;
      globalRateLimitState.backoffComplete = false;
      
      // Process any queued requests
      processRequestQueue();
    }, longBackoffTime);
  }
  
  // Reset retry count after a while if we haven't hit the absolute max
  if (globalRateLimitState.retryCount >= globalRateLimitState.maxRetries && !globalRateLimitState.backoffComplete) {
    setTimeout(() => {
      globalRateLimitState.retryCount = 0;
      logger.log(COMPONENT_NAME, 'Global rate limit retry count reset');
    }, 60000); // Reset after 1 minute
  }
}

// Function to add a request to the queue
function queueRequest(
  url: string, 
  options: RequestInit, 
  priority: number = 1
): Promise<Response> {
  return new Promise((resolve, reject) => {
    // Add the request to the queue
    globalRateLimitState.requestQueue.push({
      url,
      options,
      priority,
      resolve,
      reject,
      timestamp: Date.now()
    });
    
    logger.log(COMPONENT_NAME, `Request to ${url} queued. Queue length: ${globalRateLimitState.requestQueue.length}`);
    
    // Start processing the queue if not already processing
    if (!globalRateLimitState.processingQueue) {
      processRequestQueue();
    }
  });
}

// Function to process the request queue
function processRequestQueue() {
  // If already processing or no requests in queue, return
  if (globalRateLimitState.processingQueue || globalRateLimitState.requestQueue.length === 0) {
    return;
  }
  
  // If globally rate limited, wait until the rate limit expires
  if (isGloballyRateLimited()) {
    const waitTime = globalRateLimitState.rateLimitedUntil - Date.now();
    logger.log(COMPONENT_NAME, `Request queue processing paused due to rate limiting. Resuming in ${waitTime}ms`);
    
    setTimeout(() => {
      processRequestQueue();
    }, waitTime + 100); // Add 100ms buffer
    
    return;
  }
  
  // Set processing flag
  globalRateLimitState.processingQueue = true;
  
  // Sort the queue by priority (higher priority first) and then by timestamp (older first)
  globalRateLimitState.requestQueue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return a.timestamp - b.timestamp; // Older requests first
  });
  
  // Take the first request from the queue
  const request = globalRateLimitState.requestQueue.shift();
  
  if (!request) {
    globalRateLimitState.processingQueue = false;
    return;
  }
  
  logger.log(COMPONENT_NAME, `Processing queued request to ${request.url}`);
  
  // Execute the request
  fetch(request.url, request.options)
    .then(response => {
      // If rate limited, requeue the request and set global rate limit
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        
        logger.warn(COMPONENT_NAME, `Rate limit exceeded (429) for queued request. Requeuing.`);
        setGlobalRateLimit(request.url, delayMs);
        
        // Requeue the request with higher priority
        globalRateLimitState.requestQueue.unshift({
          ...request,
          priority: request.priority + 1 // Increase priority
        });
      } else {
        // Resolve the promise with the response
        request.resolve(response);
      }
    })
    .catch(error => {
      // Reject the promise with the error
      request.reject(error);
    })
    .finally(() => {
      // Reset processing flag and process next request
      globalRateLimitState.processingQueue = false;
      
      // Wait a short time before processing the next request to avoid overwhelming the server
      setTimeout(() => {
        processRequestQueue();
      }, 500);
    });
}

class ApiServiceImpl implements ApiService {
  private baseUrl: string;

  constructor() {
    // Use environment variables if available, otherwise fallback to localhost
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log('🔌 API Service initialized with URL:', this.baseUrl);
  }
  
  /**
   * Helper method to build API URLs with consistent parameters
   * @param endpoint API endpoint path (without leading slash)
   * @param params Additional query parameters 
   * @param context Chat context with organization_id and dashboard_id
   * @returns Fully qualified URL with query parameters
   */
  private buildApiUrl(endpoint: string, context?: ChatContext, params: Record<string, string> = {}): string {
    // Normalize context to ensure we have snake_case keys
    const normalizedContext = normalizeContext(context);
    
    // Create URL params
    const queryParams = new URLSearchParams();
    
    // Add context params
    if (normalizedContext?.organization_id) {
      queryParams.append('organization_id', normalizedContext.organization_id.toString());
    }
    
    if (normalizedContext?.dashboard_id) {
      queryParams.append('dashboard_id', normalizedContext.dashboard_id);
    }
    
    // Add additional params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    // Format the URL
    const queryString = queryParams.toString();
    const url = `${this.baseUrl}/${endpoint}`;
    
    return queryString ? `${url}?${queryString}` : url;
  }

  private getAuthHeaders(): HeadersInit {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Add authentication header if token exists
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        logger.log(COMPONENT_NAME, 'Using authentication token from localStorage:', token.substring(0, 10) + '...');
      } else {
        logger.warn(COMPONENT_NAME, 'No authentication token found in localStorage');
      }
      
      return headers;
    } catch (error) {
      logger.error(COMPONENT_NAME, 'Error getting auth headers:', error);
      return { 'Content-Type': 'application/json' };
    }
  }

  private async fetchWithCredentials(
    url: string,
    options: RequestInit = {},
    additionalOptions: {
      handleAuth?: boolean;
      timeout?: number;
      logRequest?: boolean;
      retryCount?: number;
      retryDelay?: number;
      maxRetries?: number;
      priority?: number;
      useQueue?: boolean;
      ignoreAuthErrors?: boolean;
    } = {}
  ): Promise<Response> {
    // Set defaults
    const handleAuth = additionalOptions.handleAuth !== false;
    const timeout = additionalOptions.timeout || 30000;
    const logRequest = additionalOptions.logRequest !== false;
    const maxRetries = additionalOptions.maxRetries || 2;
    const initialRetryDelay = additionalOptions.retryDelay || 2000;
    const priority = additionalOptions.priority || 1;
    const useQueue = additionalOptions.useQueue !== false;
    const ignoreAuthErrors = additionalOptions.ignoreAuthErrors === true;
    
    // Check if this is a logout operation
    const isLogoutOperation = url.includes('/auth/logout');

    // Always include credentials
    options.credentials = 'include';
    
    // Ensure headers are set
    options.headers = {
      ...this.getAuthHeaders(),
      ...options.headers
    };

    // Check global rate limit before making request
    if (isGloballyRateLimited()) {
      const waitTime = globalRateLimitState.rateLimitedUntil - Date.now();
      logger.warn(COMPONENT_NAME, `Request to ${url} blocked by global rate limit. Waiting ${waitTime}ms before retrying.`);
      
      // If we're using the queue, add the request to the queue
      if (useQueue) {
        logger.log(COMPONENT_NAME, `Adding rate-limited request to ${url} to queue`);
        return queueRequest(url, options, priority);
      }
      
      // Wait for the rate limit to expire
      await new Promise(resolve => setTimeout(resolve, waitTime + 100)); // Add 100ms buffer
    }
    
    // If we're using the queue and not rate limited, add the request to the queue
    if (useQueue && !isGloballyRateLimited()) {
      return queueRequest(url, options, priority);
    }
    
    // Create a timeout promise
    const timeoutPromise = new Promise<Response>((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);
      return () => clearTimeout(timeoutId);
    });
    
    const attemptFetch = async (attempt: number = 1): Promise<Response> => {
      try {
        // Create request options
        const requestOptions: RequestInit = {
          ...options,
          headers: options.headers
        };
        
        if (logRequest) {
          logger.debug(COMPONENT_NAME, `Fetching ${url} with options:`, {
            method: requestOptions.method || 'GET',
            headers: Object.keys(requestOptions.headers || {}),
            body: requestOptions.body ? 'Present' : 'None'
          });
        }
        
        // Perform fetch
        const response = await fetch(url, requestOptions);
        
        // Handle authentication errors consistently
        if (response.status === 401 && handleAuth) {
          // For logout operations, we expect auth issues and can ignore them
          if (isLogoutOperation || ignoreAuthErrors) {
            logger.debug(COMPONENT_NAME, 'Auth error during logout or explicitly ignored', response.status);
            return response; // Return the response and let caller handle it
          }
          
          logger.warn(COMPONENT_NAME, 'Authentication error, clearing token', response.status);
          localStorage.removeItem('auth_token');
          throw new Error('Authentication failed. Please log in again.');
        }
        
        // Handle 404 errors with specific message
        if (response.status === 404) {
          const endpoint = url.split('/').slice(-2).join('/');
          logger.warn(COMPONENT_NAME, `Resource not found at endpoint: ${url}`);
          throw new Error(`404 Not Found: The requested resource '${endpoint}' does not exist`);
        }
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          let delayMs = initialRetryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          
          if (retryAfter) {
            // If server specifies a retry-after header, use that
            delayMs = parseInt(retryAfter, 10) * 1000;
          }
          
          logger.warn(COMPONENT_NAME, `Rate limit exceeded (429). Retrying in ${delayMs}ms. Attempt ${attempt} of ${maxRetries}`);
          
          // Set global rate limit and emit event
          setGlobalRateLimit(url, delayMs);
          
          // If we've reached max retries, throw an error
          if (attempt >= maxRetries) {
            const errorMessage = `Rate limit exceeded. Please try again later.`;
            emitApiError(url, 429, errorMessage);
            throw new Error(errorMessage);
          }
          
          // Wait for the specified delay
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Retry the request
          return attemptFetch(attempt + 1);
        }
        
        // Handle other server errors
        if (response.status >= 400) {
          try {
            const errorData = await response.json();
            logger.error(COMPONENT_NAME, `Server error ${response.status}:`, errorData);
            console.error(`Server error ${response.status}:`, errorData);
            const errorMessage = `Server error: ${response.status} ${response.statusText}`;
            emitApiError(url, response.status, errorMessage);
            throw new Error(errorMessage);
          } catch (jsonError) {
            console.error(`Server error ${response.status}, could not parse response:`, jsonError);
            const errorMessage = `Server error: ${response.status} ${response.statusText}`;
            emitApiError(url, response.status, errorMessage);
            throw new Error(errorMessage);
          }
        }
        
        // Success - emit success event
        emitApiSuccess(url);
        
        return response;
      } catch (error) {
        // For network errors, retry with exponential backoff
        if (error instanceof TypeError && error.message.includes('network') && attempt <= maxRetries) {
          const delayMs = initialRetryDelay * Math.pow(2, attempt - 1);
          console.warn(`Network error. Retrying in ${delayMs}ms. Attempt ${attempt} of ${maxRetries}`);
          
          // Wait for the specified delay
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Retry the request
          return attemptFetch(attempt + 1);
        }
        
        throw error;
      }
    };
    
    // Race between the fetch and the timeout
    return Promise.race([attemptFetch(), timeoutPromise]);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    try {
      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', response.status, errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      // Check content type to determine how to parse
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await response.json() as T;
      } else {
        const text = await response.text();
        
        // Try to parse as JSON even if content type is not set correctly
        try {
          return JSON.parse(text) as T;
        } catch (e) {
          // Return as is if it's not JSON
          return text as unknown as T;
        }
      }
    } catch (error) {
      console.error('Error handling response:', error);
      throw error;
    }
  }

  async getChatSessions(context?: ChatContext): Promise<ChatSession[]> {
    try {
      // Ensure we have a valid context with default organization
      const validContext = this.ensureValidContext(context, true);
      
      console.log(`Fetching chat sessions with context: ${JSON.stringify(validContext)}`);
      
      // Use the makeApiRequest utility for simplified API access
      const sessions = await this.makeApiRequest<ChatSession[]>('api/chat/sessions', validContext);
      
      console.log(`Successfully fetched ${sessions.length} chat sessions`);
      return sessions;
    } catch (error: any) {
      console.error('Error fetching chat sessions:', error);
      
      // If database error, network error or server is unreachable
      if (error.message && (
          error.message.includes('Database error') ||
          error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError')
      )) {
        console.warn('Error encountered, returning empty sessions array:', error.message);
      }
      
      // Return empty array for graceful degradation
      return [];
    }
  }

  async createChatSession(title?: string, context?: ChatContext): Promise<ChatSession> {
    const defaultTitle = title || `Chat ${new Date().toLocaleString()}`;
    
    try {
      console.log(`Creating chat session with title "${defaultTitle}"`);
      const payload = {
        title: defaultTitle,
        ...(context?.organization_id && { organization_id: context.organization_id }),
        ...(context?.dashboard_id && { dashboard_id: context.dashboard_id })
      };
      
      console.log('Session create payload:', payload);
      
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Failed to create session: ${response.status} ${response.statusText}`);
        // Fall back to creating a local-only session if the server fails
        return this.createLocalFallbackSession(defaultTitle, context);
      }
      
      const session = await this.handleResponse<ChatSession>(response);
      console.log(`Successfully created session with ID: ${session.id}`);
      return session;
    } catch (error) {
      console.error('Error creating chat session:', error);
      // Fall back to creating a local-only session if there's an error
      return this.createLocalFallbackSession(defaultTitle, context);
    }
  }
  
  // Create a local session as fallback when server requests fail
  private createLocalFallbackSession(title: string, context?: ChatContext): ChatSession {
    console.log('Creating local fallback session');
    // Generate a unique ID for the local session
    const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const fallbackSession: ChatSession = {
      id: localId,
      title: `${title} (Local)`,
      last_message: '',
      message_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organization_id: context?.organization_id || 0,
      dashboard_id: context?.dashboard_id || ''
    };
    
    console.log('Created local fallback session:', fallbackSession);
    return fallbackSession;
  }

  async updateChatSession(
    sessionId: string, 
    title: string, 
    lastMessage?: string, 
    messageCount?: number,
    context?: ChatContext
  ): Promise<ChatSession> {
    // Ensure we have a valid context with default organization
    const validContext = this.ensureValidContext(context, true);
    
    const payload: any = { 
      title,
      organization_id: validContext.organization_id,
      dashboard_id: validContext.dashboard_id
    };
    
    // Add optional parameters if provided
    if (lastMessage !== undefined) {
      payload.last_message = lastMessage;
    }
    
    if (messageCount !== undefined) {
      payload.message_count = messageCount;
    }
    
    console.log(`Updating chat session ${sessionId} with:`, payload);
    
    try {
      const response = await this.fetchWithCredentials(`${this.baseUrl}/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Error updating chat session ${sessionId}:`, {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Failed to update chat session: ${response.statusText}`);
      }
      
      const updatedSession = await response.json();
      console.log(`Successfully updated chat session ${sessionId}:`, updatedSession);
      return updatedSession;
    } catch (error) {
      console.error(`Error in updateChatSession for session ${sessionId}:`, error);
      throw error;
    }
  }

  async deleteChatSession(sessionId: string, context?: ChatContext): Promise<void> {
    try {
      const url = this.buildApiUrl(`api/chat/sessions/${sessionId}`, context);
      
      console.log(`Deleting chat session: ${sessionId}`);
      
      await this.fetchWithCredentials(url, {
        method: 'DELETE'
      });
      
      console.log(`Successfully deleted session ${sessionId}`);
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  async getChatHistory(sessionId: string, context?: ChatContext): Promise<ChatMessage[]> {
    if (!sessionId) {
      console.error('No session ID provided for getChatHistory');
      return [];
    }

    try {
      // Use buildApiUrl for consistent URL construction
      const url = this.buildApiUrl(`api/chat/sessions/${sessionId}/messages`, context);
      
      console.log(`Fetching chat history for session ${sessionId}`);
      
      // Log the final URL for debugging
      console.log(`Fetching messages from: ${url}`);
      
      const response = await this.fetchWithCredentials(url, {}, {
        logRequest: true
      });
      const messages = await this.handleResponse<ChatMessage[]>(response);
      
      console.log(`Received ${messages.length} messages for session ${sessionId}`);
      
      // Validate and sanitize messages
      return this.validateMessages(messages, sessionId);
    } catch (error) {
      // If we get a 404 error, return an empty array instead of an error message
      // This is more graceful as the session might exist but have no messages yet
      if (error instanceof Error && error.message.includes('404')) {
        console.warn(`No messages found for session ${sessionId}, returning empty array`);
        return [];
      }
      
      // Specific error handling using our utility
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          console.error('Authentication error in getChatHistory:', error);
          return [this.createErrorMessage('authentication', 'Please log in again.')];
        }
        
        if (error.message.includes('Server error')) {
          console.error('Server error in getChatHistory:', error);
          return [this.createErrorMessage('server', error.message)];
        }
        
        // Network or other errors
        console.error('Error getting chat history:', error);
        return [this.createErrorMessage(
          'network', 
          error instanceof Error ? error.message : 'Unknown error'
        )];
      }
      
      // Fallback for non-Error objects
      console.error('Unknown error getting chat history:', error);
      return [this.createErrorMessage('network', 'An unexpected error occurred')];
    }
  }

  async getChatHistoryComplete(sessionId: string, context?: ChatContext): Promise<ChatMessage[]> {
    if (!sessionId) {
      console.error('No session ID provided for getChatHistoryComplete');
      return [];
    }
    
    // First, get the basic history as a fallback
    const basicHistory = await this.getChatHistory(sessionId, context);
    
    try {
      // Build URL with additional params for complete history
      const url = this.buildApiUrl(
        `api/chat/sessions/${sessionId}/messages/complete`, 
        context,
        { complete: 'true' } // Signal to the server this is a complete history request
      );
      
      console.log(`Fetching complete chat history for session ${sessionId}`);
      const response = await this.fetchWithCredentials(url);
      
      if (!response.ok) {
        // Fall back to the basic history if the complete endpoint fails
        console.warn(`Complete history endpoint failed with status ${response.status}, using basic history`);
        return basicHistory;
      }
      
      const completeHistory = await this.handleResponse<ChatMessage[]>(response);
      console.log(`Fetched ${completeHistory.length} messages in complete history mode`);
      
      // If we get fewer messages from the complete endpoint, use the basic history
      if (completeHistory.length < basicHistory.length) {
        return basicHistory;
      }
      
      return completeHistory;
    } catch (error) {
      console.error('Error fetching complete chat history:', error);
      // Fall back to the basic history on error
      return basicHistory;
    }
  }

  async saveChatHistory(sessionId: string, messages: ChatMessage[], context?: ChatContext): Promise<void> {
    try {
      // Check if user is logged out by checking auth token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log(`Not saving chat history for session ${sessionId} - user is logged out`);
        return;
      }
      
      const url = this.buildApiUrl(`api/chat/sessions/${sessionId}/history`, context);
      
      console.log(`Saving ${messages.length} messages for session ${sessionId}`);
      
      await this.fetchWithCredentials(url, {
        method: 'PUT',
        body: JSON.stringify({ messages })
      }, {
        ignoreAuthErrors: true // Ignore auth errors during save to avoid console errors on logout
      });
      
      console.log(`Successfully saved chat history for session ${sessionId}`);
    } catch (error) {
      console.error(`Error saving chat history for session ${sessionId}:`, error);
      // Don't rethrow the error to avoid disrupting the user experience
    }
  }

  async sendMessage(sessionId: string, message: string, context?: ChatContext, options?: any): Promise<ChatResponse> {
    // Validation with detailed error information
    if (!sessionId) {
      console.error('Missing sessionId in sendMessage call');
      throw new Error('Content and sessionId are required');
    }
    
    if (!message) {
      console.error('Missing message content in sendMessage call');
      throw new Error('Content and sessionId are required');
    }
    
    try {
      // Prepare the API endpoint URL
      const url = this.buildApiUrl(`api/chat/sessions/${sessionId}/messages`, context);
      
      // Prepare data sources
      let data_sources = [];
      try {
        const selectedDataSources = localStorage.getItem('selectedDataSources');
        data_sources = selectedDataSources ? JSON.parse(selectedDataSources) : [];
      } catch (parseError) {
        console.error('Error parsing selectedDataSources:', parseError);
      }
      
      // Format message content
      const messageContent = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);
      
      // Build EXACT payload structure expected by server controller
      const payload: any = {
        content: messageContent,      // Server expects 'content'
        sessionId: sessionId,         // Include in both URL and body
        data_sources: data_sources    // Array of data source IDs
      };
      
      // Add context information
      if (context) {
        const normalizedContext = normalizeContext(context);
        payload.context = {
          organization_id: normalizedContext?.organization_id,
          dashboard_id: normalizedContext?.dashboard_id
        };
      }
      
      // Add previous queries if provided
      if (options?.previousQueries) {
        payload.previousQueries = options.previousQueries;
      }
      
      // Log complete request for debugging
      console.log('Sending message request:', {
        url,
        payload: JSON.stringify(payload)
      });
      
      const response = await this.fetchWithCredentials(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      
      // Handle non-OK responses directly before parsing
      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Fallback to text if JSON parsing fails
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
        console.error('API error response:', errorMessage);
        throw new Error(errorMessage);
      }
      
      // Parse successful response
      const data = await response.json();
      
      // Verify response format and provide helpful error for debugging
      if (!data.aiMessage?.content) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format: missing content');
      }
      
      // Check if we have a structured response
      const hasStructuredResponse = 
        data.aiMessage?.metadata?.structuredResponse && 
        Object.keys(data.aiMessage.metadata.structuredResponse).length > 0;
      
      // If there's a structured response, return that as the main content
      if (hasStructuredResponse) {
        console.log('Using structured response as primary response');
        
        // Create a "steps" marker to add to the metadata if we're using the structured response
        const steps = data.aiMessage.metadata.structuredResponse.steps || [];
        
        return {
          // Use a placeholder content that won't be shown since we're using the structured version
          content: '',
          metadata: {
            model: data.aiMessage.metadata?.model,
            tokens: data.usage,
            suggestions: data.aiMessage.metadata?.suggestions,
            analyticalResponse: data.aiMessage.metadata?.analyticalResponse,
            isMultiStep: true, // Force multi-step to ensure proper rendering
            messageType: 'structured',
            contentType: 'structured',
            dataStructure: data.aiMessage.metadata?.dataStructure,
            processingType: data.aiMessage.metadata?.processingType,
            structuredResponse: data.aiMessage.metadata?.structuredResponse,
            steps: steps
          }
        };
      }
      
      // Return standard response if no structured response
      return {
        content: data.aiMessage.content,
        metadata: {
          model: data.aiMessage.metadata?.model,
          tokens: data.usage,
          suggestions: data.aiMessage.metadata?.suggestions,
          analyticalResponse: data.aiMessage.metadata?.analyticalResponse,
          isMultiStep: data.aiMessage.metadata?.isMultiStep,
          messageType: data.aiMessage.metadata?.messageType,
          contentType: data.aiMessage.metadata?.contentType,
          dataStructure: data.aiMessage.metadata?.dataStructure,
          processingType: data.aiMessage.metadata?.processingType,
          structuredResponse: data.aiMessage.metadata?.structuredResponse
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
    return this.handleResponse<Dashboard[]>(response);
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>): Promise<Dashboard> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards`, {
      method: 'POST',
      body: JSON.stringify(dashboard)
    });
    return this.handleResponse<Dashboard>(response);
  }

  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const response = await this.fetchWithCredentials(`${this.baseUrl}/api/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dashboard)
    });
    return this.handleResponse<Dashboard>(response);
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
    return this.handleResponse<Widget[]>(response);
  }

  /**
   * Creates a standardized error message object for display in the UI
   * @param messageType Type of error message
   * @param content Error message content
   * @returns Error message object
   */
  private createErrorMessage(messageType: 'authentication' | 'server' | 'network' | 'not_found', content: string): ChatMessage {
    const errorTypes = {
      authentication: 'Authentication error',
      server: 'Server error',
      network: 'Network error',
      not_found: 'Not found'
    };
    
    return {
      id: `error-${Date.now()}`,
      role: 'error' as MessageRole,
      content: `${errorTypes[messageType]}: ${content}`,
      timestamp: Date.now(),
      status: 'error',
      metadata: {
        error: true,
        errorType: messageType
      }
    };
  }

  /**
   * Makes an API request with proper context handling and error management
   * @param endpoint API endpoint path
   * @param context Chat context
   * @param options Fetch options
   * @param additionalParams Additional URL parameters
   * @param fetchOptions Additional options for fetchWithCredentials
   * @returns Promise with the response data
   */
  private async makeApiRequest<T>(
    endpoint: string, 
    context?: ChatContext, 
    options: RequestInit = {}, 
    additionalParams: Record<string, string> = {},
    fetchOptions: {
      handleAuth?: boolean;
      timeout?: number;
      logRequest?: boolean;
      retryCount?: number;
      retryDelay?: number;
    } = {}
  ): Promise<T> {
    try {
      // Build the URL with proper context
      const url = this.buildApiUrl(endpoint, context, additionalParams);
      
      // Make the request
      const response = await this.fetchWithCredentials(url, options, fetchOptions);
      
      // Parse and return the response
      return await this.handleResponse<T>(response);
    } catch (error) {
      console.error(`Error in API request to ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Ensures the context contains valid values for required parameters
   * @param context Original context which may be incomplete
   * @param requireOrganization Whether to require and add default organization_id
   * @returns Context with defaults applied
   */
  private ensureValidContext(context?: ChatContext, requireOrganization: boolean = true): ChatContext {
    // Start by normalizing the context
    let normalizedContext = normalizeContext(context) || {};
    
    // FIXED: Improved organization ID handling
    if (requireOrganization) {
      if (!normalizedContext.organization_id) {
        // Check if we have a saved organization ID in localStorage
        const savedOrgId = localStorage.getItem('last_active_organization_id');
        
        if (savedOrgId && savedOrgId !== 'undefined' && savedOrgId !== 'null') {
          const parsedId = parseInt(savedOrgId, 10);
          if (!isNaN(parsedId)) {
            console.log(`Using organization ID ${parsedId} from localStorage`);
            normalizedContext.organization_id = parsedId;
          } else {
            console.log('No valid organization_id found, using default');
            normalizedContext.organization_id = 1; // Default as last resort
          }
        } else {
          console.log('No organization_id provided, using default');
          normalizedContext.organization_id = 1; // Default organization ID
        }
      } else {
        console.log(`Using provided organization_id: ${normalizedContext.organization_id}`);
      }
    }
    
    // FIXED: Improved dashboard ID handling
    if (normalizedContext.dashboard_id === undefined) {
      // Check if we have a saved dashboard ID in localStorage
      const savedDashboardId = localStorage.getItem('last_active_dashboard_id');
      
      if (savedDashboardId && savedDashboardId !== 'undefined' && savedDashboardId !== 'null') {
        console.log(`Using dashboard ID ${savedDashboardId} from localStorage`);
        normalizedContext.dashboard_id = savedDashboardId;
      }
      // Otherwise we leave it undefined which means "global" view
    }
    
    return normalizedContext;
  }

  /**
   * Validates and sanitizes an array of chat messages
   * @param messages Array of messages to validate
   * @param sessionId Optional session ID for logging
   * @returns Filtered array with only valid messages
   */
  private validateMessages(messages: ChatMessage[], sessionId?: string): ChatMessage[] {
    if (!Array.isArray(messages)) {
      console.warn('Invalid messages object received', messages);
      return [];
    }
    
    const validMessages = messages.filter(msg => {
      if (!msg) return false;
      if (!msg.id || !msg.role) {
        console.warn(`Invalid message found ${sessionId ? `in session ${sessionId}` : ''}, filtering out`, msg);
        return false;
      }
      return true;
    });
    
    console.log(`Validated ${validMessages.length} of ${messages.length} messages`);
    return validMessages;
  }
}

// Export a singleton instance of the API service
export const apiService = new ApiServiceImpl();