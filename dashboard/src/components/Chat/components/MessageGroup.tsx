import React from 'react';
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

  const renderMessage = (message: ChatMessage, index: number) => {
    const isFirst = index === 0;
    const isLast = index === messages.length - 1;

    if (message.role === 'assistant') {
      return (
        <AssistantMessage
          key={message.id}
          message={message}
          isFirstInGroup={isFirst}
          isLastInGroup={isLast}
          onCopy={() => onCopy(message)}
          onReload={() => onRegenerate(message)}
          onDelete={onDelete ? () => onDelete(message) : undefined}
          showMetadata={showGroupMetadata && isLast}
          showAvatar={showAvatar && isFirst}
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
          onEdit={onEdit ? (content) => onEdit(message, content) : undefined}
          onDelete={onDelete ? () => onDelete(message) : undefined}
          showMetadata={showGroupMetadata && isLast}
          showAvatar={showAvatar && isFirst}
          messageAlignment={messageAlignment}
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
        relative flex flex-col gap-2 py-4
        ${isAssistantGroup ? 'bg-gray-50/10 dark:bg-gray-900/30' : ''}
        transition-colors duration-200 ease-out
        border-b border-gray-100/20 dark:border-gray-800/40
        group
        bg-white dark:bg-gray-950
      `}
    >
      <div className={`
        w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8
        flex flex-col gap-3
        ${isAssistantGroup ? 'items-start' : 'items-end'}
        relative
        bg-white dark:bg-gray-950
      `}>
        <div className="absolute inset-0 pointer-events-none">
          {messages.length > 1 && (
            <div className={`
              h-full w-0.5 rounded-full
              ${isAssistantGroup 
                ? 'bg-gradient-to-b from-indigo-500/5 via-indigo-500/3 to-transparent dark:from-indigo-400/20 dark:via-indigo-400/10'
                : 'bg-gradient-to-b from-purple-500/5 via-purple-500/3 to-transparent dark:from-purple-400/20 dark:via-purple-400/10'
              }
              ${isAssistantGroup ? 'ml-8' : 'mr-8'}
              opacity-0 group-hover:opacity-100 transition-opacity duration-300
            `} />
          )}
        </div>
        <div className="w-full max-w-2xl space-y-2">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.3, 
                ease: 'easeOut',
                delay: index * 0.1 
              }}
              className="relative"
            >
              {renderMessage(message, index)}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}; 