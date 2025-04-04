import React from 'react';
import { type ChatMessage } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { ErrorMessage } from './ErrorMessage';

interface MessagesProps {
  messages: ChatMessage[];
  onCopyMessage?: (message: ChatMessage) => void;
  onReloadMessage?: (message: ChatMessage) => void;
}

export const Messages: React.FC<MessagesProps> = ({ messages, onCopyMessage, onReloadMessage }) => {
  // Filter messages to remove duplicate summary messages when structured responses exist
  const filteredMessages = messages.filter((message, index) => {
    // Keep all non-assistant messages
    if (message.role !== 'assistant') {
      return true;
    }
    
    // Don't filter out messages that are still loading
    if (message.status === 'loading') {
      return true;
    }
    
    // Look for structured response markers
    const hasStructuredResponse = 
      message.metadata?.structuredResponse || 
      message.metadata?.isMultiStep || 
      message.metadata?.steps;
      
    // Check if the next message is also from the assistant
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    
    if (nextMessage && nextMessage.role === 'assistant') {
      // Next message has structured response but this one doesn't - this is likely a summary
      if (!hasStructuredResponse && 
          (nextMessage.metadata?.structuredResponse || 
           nextMessage.metadata?.isMultiStep || 
           nextMessage.metadata?.steps)) {
        
        // Check if messages are close in time (within 5 seconds of each other)
        if (nextMessage.timestamp && 
            message.timestamp && 
            Math.abs(nextMessage.timestamp - message.timestamp) < 5000) {
          
          // Skip this message as it's likely a summary
          console.log('Filtering out duplicate summary message:', message.id);
          return false;
        }
        
        // Check if the messages have similar content
        // This handles cases where the timestamps might be further apart
        const currentContent = message.content?.substring(0, 100)?.toLowerCase() || '';
        const nextContent = nextMessage.content?.substring(0, 100)?.toLowerCase() || '';
        
        // If both have content and they're similar (one contains the other)
        if (currentContent && nextContent &&
            (currentContent.includes(nextContent.substring(0, 50)) || 
             nextContent.includes(currentContent.substring(0, 50)))) {
          console.log('Filtering out message with similar content:', message.id);
          return false;
        }
      }
      
      // If both messages have structured responses, keep both
      // unless they were created very close together (within 2 seconds)
      if (hasStructuredResponse && 
          (nextMessage.metadata?.structuredResponse || 
           nextMessage.metadata?.isMultiStep || 
           nextMessage.metadata?.steps) &&
          nextMessage.timestamp && 
          message.timestamp && 
          Math.abs(nextMessage.timestamp - message.timestamp) < 2000) {
        
        // Keep the more detailed message (likely the one with steps)
        if (!message.metadata?.steps && nextMessage.metadata?.steps) {
          console.log('Filtering out duplicate structured message without steps:', message.id);
          return false;
        }
      }
    }
    
    // By default, keep this message
    return true;
  });
  
  return (
    <div className="w-full space-y-3">
      {filteredMessages.map((message) => {
        if (message.role === 'assistant') {
          return (
            <AssistantMessage 
              key={message.id}
              message={message}
              onCopy={() => onCopyMessage?.(message)}
              onReload={() => onReloadMessage?.(message)}
              isRunning={message.status === 'loading'}
            />
          );
        }

        if (message.role === 'user') {
          return (
            <UserMessage 
              key={message.id}
              message={message}
            />
          );
        }

        // Error messages
        return (
          <ErrorMessage 
            key={message.id}
            message={message}
          />
        );
      })}
    </div>
  );
}; 