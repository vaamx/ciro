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
  return (
    <div className="w-full space-y-4">
      {messages.map((message) => {
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