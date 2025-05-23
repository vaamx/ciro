export interface ConversationTurn {
  userQuery: string;
  orchestratedResponse: any; // Consider defining a more specific type for OrchestratedRAGResponse
  timestamp: Date;
  error?: string; // Optional error message
}

export interface ConversationState {
  conversationId: string;
  userId?: string;
  history: ConversationTurn[];
  lastModified: Date;
  // metadata?: Record<string, any>; // For future use e.g. tags, summary
} 