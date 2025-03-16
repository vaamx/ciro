import React, { useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  showMetadata,
  showAvatar,
  messageAlignment = 'left',
  accentColor = 'violet',
  isMobile = false,
}) => {
  const showGroupMetadata = showMetadata || isLastGroup;
  const firstMessage = messages[0];
  const isAssistantGroup = firstMessage.role === 'assistant';

  const groupVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    },
    exit: { opacity: 0, y: -20 }
  };

  // Memoize the rendered messages to avoid constant re-renders
  const renderedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const isFirst = index === 0;
      const isLast = index === messages.length - 1;
      
      return (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.4, 
            ease: [0.23, 1, 0.32, 1], 
            delay: index * 0.1 
          }}
          className="relative"
        >
          <MemoizedMessage
            message={message}
            index={index}
            isFirst={isFirst}
            isLast={isLast}
            showGroupMetadata={!!showGroupMetadata}
            showAvatar={!!showAvatar}
            messageAlignment={messageAlignment || 'left'}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onDelete={onDelete}
            isMobile={isMobile}
          />
        </motion.div>
      );
    });
  }, [
    messages, 
    showGroupMetadata, 
    showAvatar, 
    messageAlignment, 
    onCopy, 
    onRegenerate, 
    onEdit, 
    onDelete,
    isMobile
  ]);

  // Apply mobile-friendly adjustments to the component
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={groupVariants}
      className={`
        relative flex flex-col gap-2 py-4
        ${isAssistantGroup 
          ? 'bg-gradient-to-r from-gray-50/50 via-gray-50/80 to-gray-50/50 dark:from-gray-900/20 dark:via-gray-900/30 dark:to-gray-900/20' 
          : ''}
        transition-all duration-300 ease-out
        border-b border-gray-100/40 dark:border-gray-800/40
        group
        hover:bg-gray-50/80 dark:hover:bg-gray-900/40
      `}
    >
      <div className={`
        w-full ${isMobile ? 'max-w-full px-2' : 'max-w-4xl px-4 sm:px-6 lg:px-8'} mx-auto
        flex flex-col ${isMobile ? 'gap-2' : 'gap-3'}
        ${isAssistantGroup ? 'items-start' : 'items-end'}
        relative
      `}>
        <div className="absolute inset-0 pointer-events-none">
          {messages.length > 1 && (
            <div className={`
              h-full w-0.5 rounded-full
              ${isAssistantGroup 
                ? `bg-gradient-to-b from-${accentColor}-500/20 via-${accentColor}-500/10 to-transparent dark:from-${accentColor}-400/30 dark:via-${accentColor}-400/15`
                : `bg-gradient-to-b from-${accentColor}-500/20 via-${accentColor}-500/10 to-transparent dark:from-${accentColor}-400/30 dark:via-${accentColor}-400/15`
              }
              ${isAssistantGroup ? 'ml-8' : 'mr-8'}
              opacity-0 group-hover:opacity-100 transition-all duration-300
            `} />
          )}
        </div>
        <div className={`w-full ${isMobile ? 'max-w-full space-y-2' : 'max-w-2xl space-y-3'}`}>
          {renderedMessages}
        </div>
      </div>
    </motion.div>
  );
}; 