/**
 * Global event system for coordinating API calls and rate limiting across components
 */

// Event types
export enum EventType {
  API_RATE_LIMIT = 'api_rate_limit',
  API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
  API_ERROR = 'api_error',
  API_SUCCESS = 'api_success',
  CACHE_UPDATED = 'cache_updated',
  KNOWLEDGE_BASE_UPDATED = 'knowledge_base_updated',
  SESSION_UPDATED = 'session_updated',
  USER_AUTHENTICATED = 'user_authenticated',
  USER_LOGGED_OUT = 'user_logged_out'
}

// Event payload types
export interface ApiRateLimitEvent {
  endpoint: string;
  retryAfter: number;
  timestamp: number;
}

export interface ApiRateLimitExceededEvent {
  endpoint: string;
  retryAfter: number;
  timestamp: number;
  message: string;
}

export interface ApiErrorEvent {
  endpoint: string;
  status: number;
  message: string;
  timestamp: number;
}

export interface ApiSuccessEvent {
  endpoint: string;
  timestamp: number;
}

export interface CacheUpdatedEvent {
  key: string;
  timestamp: number;
}

export interface KnowledgeBaseUpdatedEvent {
  action: 'add' | 'update' | 'delete';
  sourceId?: string;
  timestamp: number;
}

export interface SessionUpdatedEvent {
  sessionId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
}

export interface UserAuthenticatedEvent {
  userId: string;
  timestamp: number;
}

export interface UserLoggedOutEvent {
  timestamp: number;
}

// Union type for all event payloads
export type EventPayload = 
  | ApiRateLimitEvent
  | ApiRateLimitExceededEvent
  | ApiErrorEvent
  | ApiSuccessEvent
  | CacheUpdatedEvent
  | KnowledgeBaseUpdatedEvent
  | SessionUpdatedEvent
  | UserAuthenticatedEvent
  | UserLoggedOutEvent;

// Event listener type
export type EventListener<T extends EventPayload> = (payload: T) => void;

// Event emitter class
class EventEmitter {
  private listeners: Map<EventType, EventListener<any>[]> = new Map();

  // Add event listener
  public on<T extends EventPayload>(eventType: EventType, listener: EventListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    };
  }

  // Remove event listener
  public off<T extends EventPayload>(eventType: EventType, listener: EventListener<T>): void {
    if (!this.listeners.has(eventType)) {
      return;
    }

    const eventListeners = this.listeners.get(eventType)!;
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }

  // Emit event
  public emit<T extends EventPayload>(eventType: EventType, payload: T): void {
    if (!this.listeners.has(eventType)) {
      return;
    }

    const eventListeners = this.listeners.get(eventType)!;
    for (const listener of eventListeners) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    }
  }

  // Remove all listeners for an event type
  public removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }
}

// Create singleton instance
export const eventEmitter = new EventEmitter();

// Helper functions for common events
export const emitApiRateLimit = (endpoint: string, retryAfter: number): void => {
  eventEmitter.emit<ApiRateLimitEvent>(EventType.API_RATE_LIMIT, {
    endpoint,
    retryAfter,
    timestamp: Date.now()
  });
};

export const emitApiRateLimitExceeded = (endpoint: string, retryAfter: number, message: string): void => {
  eventEmitter.emit<ApiRateLimitExceededEvent>(EventType.API_RATE_LIMIT_EXCEEDED, {
    endpoint,
    retryAfter,
    timestamp: Date.now(),
    message
  });
};

export const emitApiError = (endpoint: string, status: number, message: string): void => {
  eventEmitter.emit<ApiErrorEvent>(EventType.API_ERROR, {
    endpoint,
    status,
    message,
    timestamp: Date.now()
  });
};

export const emitApiSuccess = (endpoint: string): void => {
  eventEmitter.emit<ApiSuccessEvent>(EventType.API_SUCCESS, {
    endpoint,
    timestamp: Date.now()
  });
};

export const emitCacheUpdated = (key: string): void => {
  eventEmitter.emit<CacheUpdatedEvent>(EventType.CACHE_UPDATED, {
    key,
    timestamp: Date.now()
  });
};

export const emitKnowledgeBaseUpdated = (action: 'add' | 'update' | 'delete', sourceId?: string): void => {
  eventEmitter.emit<KnowledgeBaseUpdatedEvent>(EventType.KNOWLEDGE_BASE_UPDATED, {
    action,
    sourceId,
    timestamp: Date.now()
  });
};

export const emitSessionUpdated = (sessionId: string, action: 'create' | 'update' | 'delete'): void => {
  eventEmitter.emit<SessionUpdatedEvent>(EventType.SESSION_UPDATED, {
    sessionId,
    action,
    timestamp: Date.now()
  });
};

export const emitUserAuthenticated = (userId: string): void => {
  eventEmitter.emit<UserAuthenticatedEvent>(EventType.USER_AUTHENTICATED, {
    userId,
    timestamp: Date.now()
  });
};

export const emitUserLoggedOut = (): void => {
  eventEmitter.emit<UserLoggedOutEvent>(EventType.USER_LOGGED_OUT, {
    timestamp: Date.now()
  });
};

// Hook up to the global rate limit in api.ts
export const useGlobalRateLimitEvents = (): void => {
  // Listen for API rate limit events
  eventEmitter.on<ApiRateLimitEvent>(EventType.API_RATE_LIMIT, (payload) => {
    console.warn(`Global rate limit event: ${payload.endpoint} rate limited for ${payload.retryAfter}ms`);
    
    // Could implement additional global rate limiting logic here
    // For example, pause all API calls for a certain period
  });
};

export default eventEmitter; 