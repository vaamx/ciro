import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type ChatMessage, type MessageStatus } from '../types';
import { chatApi } from '../../../services/api';

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
        const history = await chatApi.getChatHistory(sessionId);
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
      const response = await chatApi.sendMessage(
        sessionId,
        content,
        selectedDataSource
      );

      // Add the assistant's response
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.message.content,
        status: 'complete',
        metadata: response.message.metadata,
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
      const response = await chatApi.regenerateMessage(messageId);
      setMessages(prev => 
        prev.map(m => m.id === messageId ? {
          ...m,
          content: response.content,
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