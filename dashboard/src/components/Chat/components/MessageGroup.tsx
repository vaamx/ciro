import React from 'react';
import { motion } from 'framer-motion';
import { type ChatMessage } from '../types';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { ErrorMessage } from './ErrorMessage';
import { formatTimestamp } from '../utils/formatTimestamp';

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
}

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
  bubbleStyle = 'modern',
  accentColor,
}) => {
  const showGroupMetadata = showMetadata || isLastGroup;
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
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

  const renderMessage = (message: ChatMessage, index: number) => {
    const isFirst = index === 0;
    const isLast = index === messages.length - 1;
    const commonProps = {
      message,
      showAvatar: showAvatar && isFirst,
      showMetadata: showGroupMetadata && isLast,
      messageAlignment,
      bubbleStyle,
      accentColor,
      isFirstInGroup: isFirst,
      isLastInGroup: isLast,
    };

    if (message.role === 'assistant') {
      return (
        <AssistantMessage
          key={message.id}
          {...commonProps}
          onCopy={() => onCopy(message)}
          onReload={() => onRegenerate(message)}
        />
      );
    }

    if (message.role === 'user') {
      return (
        <UserMessage
          key={message.id}
          {...commonProps}
          onEdit={(content: string) => onEdit?.(message, content)}
          onDelete={() => onDelete?.(message)}
        />
      );
    }

    if (message.role === 'error') {
      return (
        <ErrorMessage
          key={message.id}
          message={message}
          timestamp={message.timestamp}
        />
      );
    }

    return null;
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={groupVariants}
      className={`
        relative py-2 first:pt-4 last:pb-4
        ${isAssistantGroup ? 'bg-gradient-to-b from-gray-50/50 to-transparent dark:from-gray-900/30' : ''}
      `}
    >
      {messages.length > 1 && (
        <div className={`
          absolute top-0 left-0 w-full h-full pointer-events-none
          ${isAssistantGroup 
            ? 'border-l-2 border-indigo-500/20 dark:border-indigo-400/20 ml-4' 
            : 'border-r-2 border-purple-500/20 dark:border-purple-400/20 mr-4'
          }
        `} />
      )}

      <div className={`
        flex flex-col
        ${messageAlignment === 'right' ? 'items-end' : 'items-start'}
        ${messages.length > 1 ? 'space-y-1' : ''}
      `}>
        {messages.map(renderMessage)}

        {showGroupMetadata && messages.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`
              text-xs text-gray-500 dark:text-gray-400 px-4
              ${messageAlignment === 'right' ? 'text-right' : 'text-left'}
            `}
          >
            {formatTimestamp(firstMessage.timestamp || 0)} - {formatTimestamp(lastMessage.timestamp || 0)}
            <span className="mx-2">•</span>
            {messages.length} messages
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}; 