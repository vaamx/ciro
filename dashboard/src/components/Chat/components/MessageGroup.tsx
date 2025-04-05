import React, { useRef } from 'react';
import { type ChatMessage } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { ErrorMessage } from './ErrorMessage';

interface MessageGroupProps {
  messages: ChatMessage[];
  isLastGroup: boolean;
  onRegenerate: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage, newContent: string) => void;
  onDelete?: (message: ChatMessage) => void;
  showMetadata?: boolean;
  showAvatar?: boolean;
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  accentColor?: string;
  isMobile?: boolean;
}

// Create a memoized message component to prevent unnecessary re-renders
const MemoizedMessage = React.memo(
  ({ 
    message, 
    isFirst, 
    isLast, 
    showGroupMetadata, 
    showAvatar, 
    messageAlignment,
    onCopy,
    onRegenerate,
    onEdit,
    onDelete,
    isMobile
  }: { 
    message: ChatMessage; 
    index: number;
    isFirst: boolean;
    isLast: boolean;
    showGroupMetadata: boolean;
    showAvatar: boolean;
    messageAlignment: 'left' | 'right';
    onCopy: (message: ChatMessage) => void;
    onRegenerate: (message: ChatMessage) => void;
    onEdit?: (message: ChatMessage, newContent: string) => void;
    onDelete?: (message: ChatMessage) => void;
    isMobile?: boolean;
  }) => {
    // Use a ref to ensure we only log once per message
    const hasLoggedRef = useRef(false);
    
    if (!hasLoggedRef.current) {
      console.log(`Rendering message in group: ${message.role}, id: ${message.id}, content length: ${message.content?.length || 0}`);
      hasLoggedRef.current = true;
    }
    
    if (!message.content && message.status !== 'loading') {
      console.warn(`Empty message content detected: ${message.id}, role: ${message.role}, status: ${message.status}`);
    }

    if (message.role === 'assistant') {
      return (
        <AssistantMessage
          key={message.id}
          message={message}
          isFirstInGroup={isFirst}
          isLastInGroup={isLast}
          onCopy={() => onCopy(message)}
          onReload={() => onRegenerate(message)}
          showMetadata={showGroupMetadata && isLast}
          showAvatar={showAvatar && isFirst}
          isRunning={message.status === 'loading'}
          messageAlignment={messageAlignment}
          isMobile={isMobile}
        />
      );
    }

    if (message.role === 'user') {
      return (
        <UserMessage
          key={message.id}
          message={message}
          isFirstInGroup={isFirst}
          isLastInGroup={isLast}
          onEdit={onEdit ? (content: string) => onEdit(message, content) : undefined}
          onDelete={onDelete ? () => onDelete(message) : undefined}
          showMetadata={showGroupMetadata && isLast}
          showAvatar={showAvatar && isFirst}
          messageAlignment={messageAlignment}
          isMobile={isMobile}
        />
      );
    }

    if (message.role === 'error') {
      return (
        <ErrorMessage
          key={message.id}
          message={message}
          timestamp={message.timestamp}
          isMobile={isMobile}
        />
      );
    }

    return null;
  },
  // Custom comparison function to prevent re-renders unless necessary
  (prevProps, nextProps) => {
    // Only re-render if the message ID is different or if the status changed
    return prevProps.message.id === nextProps.message.id && 
           prevProps.message.status === nextProps.message.status &&
           prevProps.message.content === nextProps.message.content &&
           prevProps.isMobile === nextProps.isMobile;
  }
);

export const MessageGroup: React.FC<MessageGroupProps> = ({
  messages,
  isLastGroup,
  onRegenerate,
  onCopy,
  onEdit,
  onDelete,
  showMetadata = false,
  showAvatar = true,
  messageAlignment = 'left',
  isMobile = false
}) => {
  return (
    <div className={`message-group ${isLastGroup ? '' : 'mb-1'}`}>
      {messages.map((message, index) => {
        const isFirst = index === 0;
        const isLast = index === messages.length - 1;
        return (
          <MemoizedMessage
            key={`${message.id}-${index}`}
            message={message}
            index={index}
            isFirst={isFirst}
            isLast={isLast}
            showGroupMetadata={showMetadata}
            showAvatar={showAvatar}
            messageAlignment={messageAlignment}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onDelete={onDelete}
            isMobile={isMobile}
          />
        );
      })}
    </div>
  );
}; 