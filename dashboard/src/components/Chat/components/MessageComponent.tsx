import React, { memo, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { TokenStreamRenderer, TypingIndicator } from './TokenStreamRenderer';
import type { ChatMessage, ChatUIConfig } from '../types';

// Extended UI config interface for thread-specific features
interface ExtendedChatUIConfig extends ChatUIConfig {
  streamSpeed?: number;
}

export interface MessageComponentProps {
  message: ChatMessage;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  isStreaming?: boolean;
  uiConfig: ExtendedChatUIConfig;
  isMobile?: boolean;
  isInGroup?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  previousMessage?: ChatMessage;
  nextMessage?: ChatMessage;
  className?: string;
}

// Helper function to determine if messages should be grouped
const shouldGroupMessages = (current: ChatMessage, previous?: ChatMessage): boolean => {
  if (!previous) return false;
  
  // Group if same role and within 5 minutes
  const timeDiff = current.timestamp && previous.timestamp 
    ? new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()
    : 0;
  
  return current.role === previous.role && timeDiff < 5 * 60 * 1000; // 5 minutes
};

// Memoized message component for performance optimization
export const MessageComponent: React.FC<MessageComponentProps> = memo(({
  message,
  onRegenerate,
  onEdit,
  onDelete,
  isStreaming = false,
  uiConfig,
  isMobile = false,
  isInGroup,
  isFirstInGroup,
  isLastInGroup,
  previousMessage,
  nextMessage,
  className = ''
}) => {
  // Determine grouping if not explicitly provided
  const computedIsInGroup = isInGroup ?? shouldGroupMessages(message, previousMessage);
  const computedIsFirstInGroup = isFirstInGroup ?? !computedIsInGroup;
  const computedIsLastInGroup = isLastInGroup ?? (nextMessage ? !shouldGroupMessages(nextMessage, message) : true);

  // Handle message actions with proper signatures
  const handleRegenerate = () => {
    if (onRegenerate && message.id) {
      onRegenerate(message.id);
    }
  };

  const handleEdit = (newContent: string) => {
    if (onEdit && message.id) {
      onEdit(message.id, newContent);
    }
  };

  const handleDelete = () => {
    if (onDelete && message.id) {
      onDelete(message.id);
    }
  };

  const handleCopy = useCallback(() => {
    // Simple copy implementation that AssistantMessage expects
    console.log('Copy action triggered from MessageComponent');
  }, []);

  // Determine if message is actively streaming
  const isActivelyStreaming = isStreaming && message.status === 'streaming';

  // Animation variants for message entrance
  const messageVariants = {
    initial: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1]
      }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      transition: {
        duration: 0.2
      }
    }
  };

  // Render assistant message with streaming support
  const renderAssistantMessage = useMemo(() => {
    if (isActivelyStreaming) {
      return (
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-purple-600 dark:bg-purple-400 rounded-full" />
          </div>
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <TokenStreamRenderer
              content={message.content}
              isStreaming={isActivelyStreaming}
              isComplete={message.status === 'complete'}
              streamSpeed={uiConfig.streamSpeed || 50}
              showCursor={true}
              className="prose dark:prose-invert max-w-none"
            />
          </div>
        </div>
      );
    }

    return (
      <AssistantMessage
        message={message}
        onReload={handleRegenerate}
        onCopy={handleCopy}
        showMetadata={uiConfig.showMetadata}
        showAvatar={computedIsFirstInGroup}
        isFirstInGroup={computedIsFirstInGroup}
        isLastInGroup={computedIsLastInGroup}
        isRunning={isActivelyStreaming}
        messageAlignment="left"
        bubbleStyle={uiConfig.bubbleStyle || 'modern'}
        accentColor={uiConfig.accentColor || 'purple'}
        isInGroup={computedIsInGroup}
        isMobile={isMobile}
      />
    );
  }, [
    isActivelyStreaming,
    message,
    handleRegenerate,
    handleCopy,
    uiConfig,
    computedIsFirstInGroup,
    computedIsLastInGroup,
    computedIsInGroup,
    isMobile
  ]);

  // Render user message
  const renderUserMessage = useMemo(() => (
    <UserMessage
      message={message}
      onEdit={handleEdit}
      onDelete={handleDelete}
      showAvatar={computedIsFirstInGroup}
      showMetadata={uiConfig.showMetadata}
      messageAlignment="right"
      bubbleStyle={uiConfig.bubbleStyle || 'modern'}
      accentColor={uiConfig.accentColor || 'blue'}
      isInGroup={computedIsInGroup}
      isFirstInGroup={computedIsFirstInGroup}
      isLastInGroup={computedIsLastInGroup}
      isMobile={isMobile}
    />
  ), [
    message,
    handleEdit,
    handleDelete,
    uiConfig,
    computedIsFirstInGroup,
    computedIsLastInGroup,
    computedIsInGroup,
    isMobile
  ]);

  // Show typing indicator for loading assistant messages
  if (message.role === 'assistant' && message.status === 'loading' && !message.content) {
    return (
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`w-full ${className}`}
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-purple-600 dark:bg-purple-400 rounded-full" />
          </div>
          <div className="flex-1">
            <TypingIndicator
              isVisible={true}
              variant="dots"
              size={isMobile ? 'md' : 'sm'}
              color="purple"
              message="AI is thinking..."
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`w-full ${className}`}
      layout
    >
      {message.role === 'assistant' ? renderAssistantMessage : renderUserMessage}
    </motion.div>
  );
});

MessageComponent.displayName = 'MessageComponent';

// Export enhanced message grouping utilities
export const MessageGroupingUtils = {
  shouldGroupMessages,
  
  // Calculate grouping information for a list of messages
  calculateGrouping: (messages: ChatMessage[]) => {
    return messages.map((message, index) => {
      const previousMessage = index > 0 ? messages[index - 1] : undefined;
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : undefined;
      
      const isInGroup = shouldGroupMessages(message, previousMessage);
      const isFirstInGroup = !isInGroup;
      const isLastInGroup = nextMessage ? !shouldGroupMessages(nextMessage, message) : true;
      
      return {
        ...message,
        grouping: {
          isInGroup,
          isFirstInGroup,
          isLastInGroup,
          previousMessage,
          nextMessage
        }
      };
    });
  },
  
  // Optimize message list for rendering performance
  optimizeForRendering: (messages: ChatMessage[], windowSize = 50) => {
    // For very long conversations, implement virtual scrolling window
    if (messages.length <= windowSize) {
      return messages;
    }
    
    // Return the most recent messages within window size
    return messages.slice(-windowSize);
  }
}; 