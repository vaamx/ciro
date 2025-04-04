import { useState, useEffect, useCallback } from 'react';
import { ChatMessage } from '../types';
import { detectDocumentType, DocumentType } from '../utils/documentTypeHandlers';

/**
 * Document state for persisting document metadata between navigation
 */
interface DocumentState {
  id: string;
  messageId: string;
  type: DocumentType;
  metadata: Record<string, any>;
  timestamp: number;
}

/**
 * Hook for persisting document state between navigation
 */
export function useDocumentState() {
  // Store document states for different sessions
  const [documentStates, setDocumentStates] = useState<Record<string, DocumentState>>({});
  
  // Set document state for a message
  const setDocumentStateForMessage = useCallback((message: ChatMessage, sessionId: string) => {
    if (!message || !message.id || !sessionId) return;
    
    const { type, metadata } = detectDocumentType(message);
    
    // Only store state for document types
    if (type === DocumentType.UNKNOWN) return;
    
    setDocumentStates(prev => ({
      ...prev,
      [sessionId]: {
        id: sessionId,
        messageId: message.id,
        type,
        metadata: { ...metadata },
        timestamp: Date.now()
      }
    }));
    
    console.log(`Persisted document state for session ${sessionId}, message ${message.id}, type ${type}`);
  }, []);
  
  // Get document state for a session
  const getDocumentStateForSession = useCallback((sessionId: string): DocumentState | null => {
    if (!sessionId || !documentStates[sessionId]) return null;
    return documentStates[sessionId];
  }, [documentStates]);
  
  // Clear document state for a session
  const clearDocumentStateForSession = useCallback((sessionId: string) => {
    if (!sessionId) return;
    
    setDocumentStates(prev => {
      const newState = { ...prev };
      delete newState[sessionId];
      return newState;
    });
  }, []);
  
  // Clean up old document states (older than 1 hour)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      
      setDocumentStates(prev => {
        const newState = { ...prev };
        let cleaned = false;
        
        Object.entries(newState).forEach(([sessionId, state]) => {
          if (state.timestamp < oneHourAgo) {
            delete newState[sessionId];
            cleaned = true;
          }
        });
        
        if (cleaned) {
          console.log('Cleaned up old document states');
          return newState;
        }
        
        return prev;
      });
    }, 30 * 60 * 1000); // Run every 30 minutes
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  return {
    setDocumentStateForMessage,
    getDocumentStateForSession,
    clearDocumentStateForSession
  };
} 