import { v4 as uuidv4 } from 'uuid';

// WebSocket server URL
const WS_URL = typeof window !== 'undefined' && (window as any).ENV?.WS_URL 
  ? (window as any).ENV.WS_URL 
  : 'wss://collaboration.ciro-app.com';

// Flag to track if we should use mock collaboration
let forceUseMockCollaboration = false;

// Check if we're in development mode
const isDevelopment = typeof window !== 'undefined' && 
  ((window as any).ENV?.NODE_ENV === 'development' || (window.location.hostname === 'localhost'));

// Detect if we should initially use mock collaboration based on environment
if (isDevelopment) {
  forceUseMockCollaboration = true;
  console.log('Development environment detected. Using mock collaboration by default.');
}

// WebSocket message types
export enum MessageType {
  INIT = 'init',
  JOIN = 'join',
  LEAVE = 'leave',
  CURSOR_MOVE = 'cursor_move',
  SELECTION_CHANGE = 'selection_change',
  COMMENT_ADD = 'comment_add',
  COMMENT_REPLY = 'comment_reply',
  COMMENT_RESOLVE = 'comment_resolve',
  CHART_UPDATE = 'chart_update',
  QUERY_EXECUTE = 'query_execute',
  CHANGE_HISTORY = 'change_history',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong'
}

// User interface
export interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color: string;
  isActive: boolean;
  cursor?: CursorPosition;
  selection?: Selection;
  lastActivity: number;
}

// Cursor position interface
export interface CursorPosition {
  x: number;
  y: number;
  chartId?: string;
  lastUpdated: number;
}

// Selection interface
export interface Selection {
  chartId?: string;
  elementId?: string;
  startIndex?: number;
  endIndex?: number;
  lastUpdated: number;
}

// Comment interface
export interface Comment {
  id: string;
  userId: string;
  chartId?: string;
  text: string;
  timestamp: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  position?: {
    x: number;
    y: number;
  };
  replies?: Comment[];
  reactions?: {
    [reactionId: string]: {
      emoji: string;
      count: number;
      userIds: string[];
    }
  };
}

// Change history interface
export interface ChangeHistoryEntry {
  id: string;
  userId: string;
  timestamp: number;
  type: 'create' | 'update' | 'delete' | 'query' | 'nl-query' | 'data-connection';
  description: string;
  details: {
    chartId?: string;
    previousState?: any;
    newState?: any;
    query?: string;
    naturalLanguageQuery?: string;
  };
}

// Session interface
export interface CollaborationSession {
  id: string;
  workspaceId: string;
  users: CollaborationUser[];
  comments: Comment[];
  changeHistory: ChangeHistoryEntry[];
  createdAt: number;
  lastActive: number;
}

// WebSocket connection class
class CollaborationSocket {
  private socket: WebSocket | null = null;
  private session: CollaborationSession | null = null;
  private currentUser: CollaborationUser | null = null;
  private messageCallbacks: Map<MessageType, Set<(data: any) => void>> = new Map();
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // Start with 2 seconds
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongTime = 0;
  private connecting = false;
  private mockMode = false;

  // Initialize the WebSocket connection
  public async connect(workspaceId: string, userId?: string, userName?: string, userEmail?: string): Promise<{ session: CollaborationSession; user: CollaborationUser }> {
    // Check if already connected to the same workspace
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.session?.workspaceId === workspaceId) {
      return { session: this.session, user: this.currentUser! };
    }
    
    // In development mode or if previously forced, use mock data
    if (forceUseMockCollaboration || (typeof window !== 'undefined' && (window as any).ENV?.USE_MOCK_COLLAB === true)) {
      console.log('Using mock collaboration session (forced by configuration)');
      return this.initMockSession(workspaceId, userId, userName);
    }
    
    // Close any existing connection
    this.disconnect();
    
    try {
      this.connecting = true;
      
      // Generate IDs if not provided
      userId = userId || `user-${uuidv4()}`;
      userName = userName || `User ${Math.floor(Math.random() * 1000)}`;
      
      // Connect to WebSocket with timeout promise
      const socketPromise = new Promise<WebSocket>((resolve, reject) => {
        try {
          // Connect to WebSocket
          const encodedWorkspaceId = encodeURIComponent(workspaceId);
          const encodedUserId = encodeURIComponent(userId as string);
          const url = `${WS_URL}/ws/workspace/${encodedWorkspaceId}/user/${encodedUserId}`;
          
          console.log(`Attempting to connect to collaboration server: ${url}`);
          this.socket = new WebSocket(url);
          
          // Set up event listeners
          this.socket.onopen = () => {
            console.log('WebSocket connection established successfully');
            this.handleOpen();
            resolve(this.socket as WebSocket);
          };
          
          this.socket.onclose = this.handleClose.bind(this);
          this.socket.onerror = (e) => {
            console.warn('WebSocket connection failed');
            this.handleError(e);
            reject(new Error('WebSocket connection failed'));
          };
          this.socket.onmessage = this.handleMessage.bind(this);
        } catch (error) {
          console.error('Exception while creating WebSocket:', error);
          reject(error);
        }
      });
      
      // Set up timeout for connection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.warn('Connection timeout after 8 seconds');
          reject(new Error('Connection timeout'));
        }, 8000);
      });
      
      // Wait for either connection or timeout
      const socket = await Promise.race([socketPromise, timeoutPromise])
        .catch(error => {
          console.error('Failed to establish WebSocket connection:', error.message);
          throw error;
        });
      
      // Wait for session data with timeout
      const sessionDataPromise = new Promise<CollaborationSession>((resolve, reject) => {
        const initHandler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === MessageType.INIT) {
              resolve(message.data.session);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            reject(error);
          }
        };
        
        socket.addEventListener('message', initHandler, { once: true });
      });
      
      // Set up timeout for session data
      const sessionTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.warn('Session data timeout after 5 seconds');
          reject(new Error('Session data timeout'));
        }, 5000);
      });
      
      // Wait for either session data or timeout
      const sessionData = await Promise.race([sessionDataPromise, sessionTimeoutPromise])
        .catch(error => {
          console.error('Failed to get session data:', error.message);
          throw error;
        });
      
      // Send join message with user details
      this.sendMessage(MessageType.JOIN, {
        userId,
        userName,
        userEmail,
        color: this.getRandomColor()
      });
      
      // Set current session and user
      this.session = sessionData;
      this.currentUser = sessionData.users.find(user => user.id === userId) || null;
      
      // Start ping interval to keep connection alive
      this.startPingInterval();
      
      // Notify about connection
      this.connectionCallbacks.forEach(callback => {
        try {
          callback(true);
        } catch (error) {
          console.error('Error in connection callback:', error);
        }
      });
      
      this.connecting = false;
      this.mockMode = false;
      return { session: sessionData, user: this.currentUser! };
    } catch (error) {
      console.error('Error connecting to collaboration session:', error);
      this.connecting = false;
      
      // After connection failure, use mock for all future attempts
      forceUseMockCollaboration = true;
      
      // Fallback to mock implementation in case of error
      console.log('Using mock collaboration session (fallback after connection failure)');
      return this.initMockSession(workspaceId, userId, userName);
    }
  }
  
  // Initialize a mock session for development or when connection fails
  private initMockSession(workspaceId: string, userId?: string, userName?: string): Promise<{ session: CollaborationSession; user: CollaborationUser }> {
    this.mockMode = true;
    
    // Generate IDs if not provided
    userId = userId || `user-${uuidv4()}`;
    userName = userName || `User ${Math.floor(Math.random() * 1000)}`;
    
    // Create mock user
    const currentUser: CollaborationUser = {
      id: userId,
      name: userName,
      color: this.getRandomColor(),
      isActive: true,
      lastActivity: Date.now()
    };
    
    // Create mock users
    const mockUsers: CollaborationUser[] = [
      currentUser,
      {
        id: 'user-mock-1',
        name: 'Alex Designer',
        color: '#4f86ec',
        isActive: true,
        lastActivity: Date.now() - 60000
      },
      {
        id: 'user-mock-2',
        name: 'Taylor Analyst',
        color: '#ec4f86',
        isActive: false,
        lastActivity: Date.now() - 3600000
      }
    ];
    
    // Create mock comments
    const mockComments: Comment[] = [
      {
        id: 'comment-1',
        userId: 'user-mock-1',
        text: 'I think we should add a filter for department.',
        timestamp: Date.now() - 3600000,
        resolved: false
      },
      {
        id: 'comment-2',
        userId: 'user-mock-2',
        text: 'The revenue numbers seem off compared to last month.',
        timestamp: Date.now() - 7200000,
        resolved: true,
        resolvedBy: userId,
        resolvedAt: Date.now() - 3000000
      }
    ];
    
    // Create mock change history
    const mockChangeHistory: ChangeHistoryEntry[] = [
      {
        id: 'change-1',
        userId: 'user-mock-1',
        timestamp: Date.now() - 7200000,
        type: 'create',
        description: 'Created bar chart',
        details: {
          chartId: 'chart-1'
        }
      },
      {
        id: 'change-2',
        userId: 'user-mock-2',
        timestamp: Date.now() - 5400000,
        type: 'query',
        description: 'Executed query',
        details: {
          chartId: 'chart-1',
          query: 'SELECT region, SUM(sales) FROM sales_data GROUP BY region'
        }
      }
    ];
    
    // Create mock session
    const mockSession: CollaborationSession = {
      id: `session-${workspaceId}`,
      workspaceId,
      users: mockUsers,
      comments: mockComments,
      changeHistory: mockChangeHistory,
      createdAt: Date.now() - 86400000,
      lastActive: Date.now()
    };
    
    // Set current session and user
    this.session = mockSession;
    this.currentUser = currentUser;
    
    // Notify about connection
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(true);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
    
    return Promise.resolve({ session: mockSession, user: currentUser });
  }
  
  // Send a message through the WebSocket
  public sendMessage(type: MessageType, data: any = {}): boolean {
    // If in mock mode, handle messaging differently
    if (this.mockMode) {
      // Only log non-cursor movement messages to reduce console spam
      if (type !== MessageType.CURSOR_MOVE && type !== MessageType.PING && type !== MessageType.PONG) {
        console.log(`Mock sending message: ${type}`, data);
      }
      
      // For cursor movement in mock mode, just update the current user's cursor
      if (type === MessageType.CURSOR_MOVE && this.currentUser && this.session) {
        const { x, y, chartId } = data;
        this.currentUser.cursor = {
          x, y, chartId,
          lastUpdated: Date.now()
        };
      }
      
      // For comments in mock mode, add to the session
      if (type === MessageType.COMMENT_ADD && this.currentUser && this.session) {
        const commentId = `comment-${Date.now()}`;
        const newComment: Comment = {
          id: commentId,
          userId: this.currentUser.id,
          text: data.text,
          chartId: data.chartId,
          timestamp: Date.now(),
          resolved: false
        };
        
        this.session.comments.push(newComment);
        
        // Trigger comment callbacks
        const callbacks = this.messageCallbacks.get(MessageType.COMMENT_ADD);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback({ comment: newComment });
            } catch (error) {
              console.error('Error in comment callback:', error);
            }
          });
        }
        
        return true;
      }
      
      return true;
    }
    
    // For real WebSocket connection
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message: WebSocket is not connected');
      return false;
    }
    
    try {
      const message = JSON.stringify({ type, data });
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  // Register a callback for a specific message type
  public onMessage(type: MessageType, callback: (data: any) => void): () => void {
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, new Set());
    }
    
    const callbacks = this.messageCallbacks.get(type)!;
    callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbackSet = this.messageCallbacks.get(type);
      if (callbackSet) {
        callbackSet.delete(callback);
      }
    };
  }
  
  // Register a callback for connection state changes
  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }
  
  // Disconnect from the WebSocket
  public disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.socket) {
      // Send leave message if connected
      if (this.socket.readyState === WebSocket.OPEN && this.currentUser) {
        this.sendMessage(MessageType.LEAVE, { userId: this.currentUser.id });
      }
      
      // Close the connection
      this.socket.close();
      this.socket = null;
    }
    
    // Clear state
    this.session = null;
    this.currentUser = null;
    
    // Notify about disconnection
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(false);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }
  
  // Get current session
  public getSession(): CollaborationSession | null {
    return this.session;
  }
  
  // Get current user
  public getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }
  
  // Check if connected
  public isConnected(): boolean {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }
  
  // Update cursor position
  public updateCursorPosition(x: number, y: number, chartId?: string): boolean {
    if (!this.currentUser || !this.session) return false;
    
    // Skip if cursor position is very similar to avoid unnecessary updates
    if (this.currentUser.cursor) {
      const prevX = this.currentUser.cursor.x;
      const prevY = this.currentUser.cursor.y;
      const prevChartId = this.currentUser.cursor.chartId;
      
      // If position is almost the same and chart hasn't changed, skip update
      if (
        prevChartId === chartId &&
        Math.abs(prevX - x) < 15 && 
        Math.abs(prevY - y) < 15
      ) {
        return false;
      }
    }
    
    const cursor: CursorPosition = {
      x,
      y,
      chartId,
      lastUpdated: Date.now()
    };
    
    // Update local state
    this.currentUser.cursor = cursor;
    
    // Send to server
    return this.sendMessage(MessageType.CURSOR_MOVE, { cursor });
  }
  
  // Update selection
  public updateSelection(chartId?: string, elementId?: string, startIndex?: number, endIndex?: number): boolean {
    if (!this.currentUser || !this.session) return false;
    
    const selection: Selection = {
      chartId,
      elementId,
      startIndex,
      endIndex,
      lastUpdated: Date.now()
    };
    
    // Update local state
    this.currentUser.selection = selection;
    
    // Send to server
    return this.sendMessage(MessageType.SELECTION_CHANGE, { selection });
  }
  
  // Add comment
  public addComment(text: string, chartId?: string, position?: { x: number, y: number }): Comment | null {
    if (!this.currentUser || !this.session) return null;
    
    const comment: Comment = {
      id: `comment-${uuidv4()}`,
      userId: this.currentUser.id,
      chartId,
      text,
      timestamp: Date.now(),
      resolved: false,
      position,
      replies: []
    };
    
    // Update local state
    this.session.comments.push(comment);
    
    // Send to server
    this.sendMessage(MessageType.COMMENT_ADD, { comment });
    
    return comment;
  }
  
  // Add reply to comment
  public addCommentReply(commentId: string, text: string): Comment | null {
    if (!this.currentUser || !this.session) return null;
    
    // Find parent comment
    const parentComment = this.session.comments.find(c => c.id === commentId);
    if (!parentComment) return null;
    
    const reply: Comment = {
      id: `reply-${uuidv4()}`,
      userId: this.currentUser.id,
      text,
      timestamp: Date.now(),
      resolved: false
    };
    
    // Update local state
    if (!parentComment.replies) {
      parentComment.replies = [];
    }
    parentComment.replies.push(reply);
    
    // Send to server
    this.sendMessage(MessageType.COMMENT_REPLY, { 
      commentId: parentComment.id, 
      reply 
    });
    
    return reply;
  }
  
  // Resolve comment
  public resolveComment(commentId: string): boolean {
    if (!this.currentUser || !this.session) return false;
    
    // Find comment
    const comment = this.session.comments.find(c => c.id === commentId);
    if (!comment) return false;
    
    // Update local state
    comment.resolved = true;
    comment.resolvedBy = this.currentUser.id;
    comment.resolvedAt = Date.now();
    
    // Send to server
    this.sendMessage(MessageType.COMMENT_RESOLVE, { 
      commentId,
      userId: this.currentUser.id,
      timestamp: comment.resolvedAt
    });
    
    return true;
  }
  
  // Add chart update to history
  public addChartUpdate(chartId: string, previousState: any, newState: any): boolean {
    if (!this.currentUser || !this.session) return false;
    
    const entry: ChangeHistoryEntry = {
      id: `change-${uuidv4()}`,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      type: 'update',
      description: `Updated chart configuration`,
      details: {
        chartId,
        previousState,
        newState
      }
    };
    
    // Update local state
    this.session.changeHistory.push(entry);
    
    // Send to server
    this.sendMessage(MessageType.CHANGE_HISTORY, { entry });
    
    return true;
  }
  
  // Add query execution to history
  public addQueryExecution(chartId: string, query: string, naturalLanguageQuery?: string): boolean {
    if (!this.currentUser || !this.session) return false;
    
    const type = naturalLanguageQuery ? 'nl-query' : 'query';
    const description = naturalLanguageQuery 
      ? `Used natural language query: "${naturalLanguageQuery}"`
      : `Executed query on chart`;
    
    const entry: ChangeHistoryEntry = {
      id: `change-${uuidv4()}`,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      type,
      description,
      details: {
        chartId,
        query,
        naturalLanguageQuery
      }
    };
    
    // Update local state
    this.session.changeHistory.push(entry);
    
    // Send to server
    this.sendMessage(MessageType.CHANGE_HISTORY, { entry });
    
    return true;
  }
  
  // WebSocket event handlers
  private handleOpen(): void {
    console.log('WebSocket connection opened');
    this.reconnectAttempts = 0;
  }
  
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    // Clear interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Don't attempt to reconnect if mock mode or was closed on purpose
    if (this.mockMode || event.code === 1000) {
      return;
    }
    
    // Notify about disconnection
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(false);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
    
    // Attempt to reconnect if we're not already attempting
    if (!this.connecting && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Switching to mock mode.`);
      forceUseMockCollaboration = true;
    }
  }
  
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      
      // Handle pong messages for keepalive
      if (type === MessageType.PONG) {
        this.lastPongTime = Date.now();
        return;
      }
      
      // Process message based on type
      this.processMessage(type, data);
      
      // Trigger callbacks for this message type
      if (this.messageCallbacks.has(type)) {
        const callbacks = this.messageCallbacks.get(type)!;
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in message callback for type ${type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  // Process incoming messages
  private processMessage(type: MessageType, data: any): void {
    if (!this.session) return;
    
    switch (type) {
      case MessageType.JOIN:
        // Add new user
        this.session.users.push(data.user);
        break;
        
      case MessageType.LEAVE:
        // Remove user
        this.session.users = this.session.users.filter(u => u.id !== data.userId);
        break;
        
      case MessageType.CURSOR_MOVE:
        // Update user cursor
        const cursorUser = this.session.users.find(u => u.id === data.userId);
        if (cursorUser) {
          cursorUser.cursor = data.cursor;
          cursorUser.lastActivity = Date.now();
        }
        break;
        
      case MessageType.SELECTION_CHANGE:
        // Update user selection
        const selectionUser = this.session.users.find(u => u.id === data.userId);
        if (selectionUser) {
          selectionUser.selection = data.selection;
          selectionUser.lastActivity = Date.now();
        }
        break;
        
      case MessageType.COMMENT_ADD:
        // Add new comment
        this.session.comments.push(data.comment);
        break;
        
      case MessageType.COMMENT_REPLY:
        // Add reply to comment
        const commentToReply = this.session.comments.find(c => c.id === data.commentId);
        if (commentToReply) {
          if (!commentToReply.replies) {
            commentToReply.replies = [];
          }
          commentToReply.replies.push(data.reply);
        }
        break;
        
      case MessageType.COMMENT_RESOLVE:
        // Resolve comment
        const commentToResolve = this.session.comments.find(c => c.id === data.commentId);
        if (commentToResolve) {
          commentToResolve.resolved = true;
          commentToResolve.resolvedBy = data.userId;
          commentToResolve.resolvedAt = data.timestamp;
        }
        break;
        
      case MessageType.CHANGE_HISTORY:
        // Add history entry
        this.session.changeHistory.push(data.entry);
        break;
        
      case MessageType.ERROR:
        console.error('Received error from server:', data.message);
        break;
    }
  }
  
  // Start ping interval to keep connection alive
  private startPingInterval(): void {
    // Stop any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage(MessageType.PING, { timestamp: Date.now() });
        
        // Check if we haven't received a pong in a while
        const now = Date.now();
        if (this.lastPongTime > 0 && now - this.lastPongTime > 90000) { // 90 seconds
          console.warn('No pong received in 90 seconds, reconnecting...');
          this.reconnect();
        }
      }
    }, 30000);
  }
  
  // Reconnect after a disconnection
  private reconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(async () => {
      if (this.session) {
        try {
          this.connecting = true;
          await this.connect(this.session.workspaceId);
          this.connecting = false;
          this.reconnectAttempts = 0;
          console.log('Reconnection successful');
        } catch (error) {
          console.error('Reconnection failed:', error);
          this.connecting = false;
          
          // If we've hit the max retry count, switch to mock mode permanently
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Switching to mock mode.`);
            forceUseMockCollaboration = true;
          }
        }
      }
    }, delay);
  }
  
  // Get a random color
  private getRandomColor(): string {
    const colors = [
      '#4F46E5', // indigo
      '#10B981', // emerald
      '#EF4444', // red
      '#F59E0B', // amber
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#14B8A6', // teal
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Singleton instance
const collaborationSocket = new CollaborationSocket();

// Export the singleton instance methods
export const initCollaboration = collaborationSocket.connect.bind(collaborationSocket);
export const updateCursorPosition = collaborationSocket.updateCursorPosition.bind(collaborationSocket);
export const updateSelection = collaborationSocket.updateSelection.bind(collaborationSocket);
export const addComment = collaborationSocket.addComment.bind(collaborationSocket);
export const addCommentReply = collaborationSocket.addCommentReply.bind(collaborationSocket);
export const resolveComment = collaborationSocket.resolveComment.bind(collaborationSocket);
export const addChartUpdate = collaborationSocket.addChartUpdate.bind(collaborationSocket);
export const addQueryExecution = collaborationSocket.addQueryExecution.bind(collaborationSocket);
export const disconnectCollaboration = collaborationSocket.disconnect.bind(collaborationSocket);
export const getCurrentSession = collaborationSocket.getSession.bind(collaborationSocket);
export const getCurrentUser = collaborationSocket.getCurrentUser.bind(collaborationSocket);
export const isConnected = collaborationSocket.isConnected.bind(collaborationSocket);

// Subscribe to WebSocket events
export const onCollaborationEvent = (type: MessageType, callback: (data: any) => void) => {
  return collaborationSocket.onMessage(type, callback);
};

// Subscribe to specific events (compatible with CollaborationOverlay)
export const subscribeToEvent = (eventName: string, callback: (data: any) => void) => {
  // Map event names to appropriate MessageType
  const eventTypeMap: Record<string, MessageType> = {
    'userJoined': MessageType.JOIN,
    'userLeft': MessageType.LEAVE,
    'cursorMoved': MessageType.CURSOR_MOVE,
    'commentAdded': MessageType.COMMENT_ADD,
    'commentResolved': MessageType.COMMENT_RESOLVE
  };
  
  const messageType = eventTypeMap[eventName];
  if (messageType) {
    return collaborationSocket.onMessage(messageType, callback);
  }
  
  // Return no-op function if event name is not recognized
  return () => {};
};

// Subscribe to connection state changes
export const onConnectionChange = (callback: (connected: boolean) => void) => {
  return collaborationSocket.onConnectionChange(callback);
}; 