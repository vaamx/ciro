import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type ChatMessage, type MessageStatus } from '../types';
// Import removed as the API is incompatible

export const useChatMessages = (sessionId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: "Hi! I'm your AI assistant. How can I help you today?",
    status: 'complete',
  }]);

  useEffect(() => {
    // Load chat history when component mounts
    const loadChatHistory = async () => {
      try {
        // TODO: Implement chat history loading
        console.log('Loading chat history for session:', sessionId);
        // Mock implementation - would normally fetch from API
        const history: ChatMessage[] = [];
        if (history.length > 0) {
          setMessages(prev => [...prev, ...history]);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadChatHistory();
  }, [sessionId]);

  const sendMessage = async (content: string, selectedDataSource?: string) => {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      status: 'complete',
    };

    setMessages(prev => [...prev, newMessage]);

    try {
      // TODO: Implement real API call
      console.log('Sending message:', content, 'with data source:', selectedDataSource);
      
      // Mock response
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `I received your message: "${content}"`,
        status: 'complete',
        metadata: { isSimulated: true },
      };

      setMessages(prev => [...prev, assistantMessage]);
      return assistantMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'error',
        content: 'Sorry, there was an error processing your request. Please try again.',
        status: 'error',
      };

      setMessages(prev => [...prev, errorMessage]);
      return errorMessage;
    }
  };

  const regenerateMessage = async (messageId: string) => {
    try {
      // TODO: Implement regeneration
      console.log('Regenerating message:', messageId);
      
      // Mock implementation
      setMessages(prev => 
        prev.map(m => m.id === messageId ? {
          ...m,
          content: 'This is a regenerated response.',
          status: 'complete' as MessageStatus,
        } : m)
      );
    } catch (error) {
      console.error('Error regenerating message:', error);
      setMessages(prev =>
        prev.map(m => m.id === messageId ? {
          ...m,
          status: 'error' as MessageStatus,
        } : m)
      );
    }
  };

  return {
    messages,
    sendMessage,
    regenerateMessage,
  };
}; 