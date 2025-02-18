import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowPathIcon, 
  ClipboardIcon, 
  HeartIcon,
  SparklesIcon,
} from './icons';
import { type ChatMessage } from '../types';
import { MessageMarkdown } from './MessageMarkdown';
import { formatTimestamp } from '../utils/formatTimestamp';
import { MessageSuggestions } from './MessageSuggestions';

interface TokenCount {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: any;
  completion_tokens_details?: any;
}

interface AssistantMessageProps {
  message: ChatMessage;
  onCopy: () => void;
  onReload: () => void;
  showMetadata?: boolean;
  showAvatar?: boolean;
  accentColor?: string;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

const reactionEmojis = {
  like: '👍',
  love: '❤️',
  laugh: '😄',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  onCopy,
  onReload,
  showMetadata = false,
  showAvatar = true,
  accentColor = 'indigo',
  isFirstInGroup = false,
  isLastInGroup = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionHovered, setReactionHovered] = useState<string | null>(null);

  const gradientClasses = {
    indigo: 'from-purple-500 to-indigo-600',
    blue: 'from-blue-500 to-cyan-600',
    green: 'from-emerald-500 to-green-600',
    purple: 'from-fuchsia-500 to-purple-600',
  }[accentColor] || 'from-purple-500 to-indigo-600';

  const isTyping = message.status === 'streaming' || message.status === 'loading';
  const hasCodeBlock = message.content.includes('```');

  const messageVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: 'spring',
        damping: 25,
        stiffness: 300
      }
    },
    exit: { opacity: 0, y: -20, scale: 0.95 }
  };

  const actionBarVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: 'spring',
        damping: 20,
        stiffness: 300
      }
    }
  };

  const reactionPickerVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={messageVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`
        flex items-start space-x-4 group relative
        ${!isFirstInGroup ? 'mt-2' : 'mt-6'}
        ${!isLastInGroup ? 'mb-2' : 'mb-6'}
      `}
    >
      {showAvatar && (
        <motion.div 
          className={`
            flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden
            bg-gradient-to-br ${gradientClasses} 
            flex items-center justify-center
            shadow-lg ring-2 ring-white dark:ring-gray-800
            transform-gpu transition-transform duration-200
            ${isFirstInGroup ? '' : 'opacity-0 invisible'}
            hover:scale-110 hover:rotate-3
          `}
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <SparklesIcon className="w-5 h-5 text-white transform hover:scale-110 transition-transform" />
        </motion.div>
      )}

      <div className="flex-1 max-w-2xl space-y-1">
        <motion.div 
          className={`
            relative rounded-2xl p-4
            ${hasCodeBlock 
              ? 'bg-gray-50/80 dark:bg-gray-900/80' 
              : 'bg-white/80 dark:bg-gray-800/80'}
            shadow-sm border border-gray-200/50 dark:border-gray-700/50
            backdrop-blur-sm
            transform-gpu transition-all duration-200
            ${isHovered ? 'scale-[1.01] shadow-md translate-x-1' : ''}
            hover:border-indigo-200 dark:hover:border-indigo-800
            ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-tr-2xl rounded-b-2xl'}
          `}
          whileHover={{ scale: 1.01, x: 4 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MessageMarkdown content={message.content} />
          </div>
          
          {isTyping && (
            <div className="absolute bottom-2 left-4 flex items-center space-x-1">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 bg-indigo-500 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="w-2 h-2 bg-indigo-500 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                className="w-2 h-2 bg-indigo-500 rounded-full"
              />
            </div>
          )}

          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={actionBarVariants}
                className="absolute -top-3 right-4 flex items-center space-x-2 
                  bg-white/90 dark:bg-gray-800/90 px-3 py-1.5 rounded-full shadow-lg 
                  border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm
                  transform-gpu hover:scale-105 transition-transform"
              >
                <motion.button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 
                    dark:text-gray-400 dark:hover:text-indigo-400 rounded-full 
                    hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  title="Add reaction"
                >
                  {selectedReaction ? (
                    <span className="text-lg transform hover:scale-110 transition-transform">
                      {reactionEmojis[selectedReaction as keyof typeof reactionEmojis]}
                    </span>
                  ) : (
                    <HeartIcon className="w-4 h-4" />
                  )}
                </motion.button>

                <motion.button
                  onClick={onCopy}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 
                    dark:text-gray-400 dark:hover:text-indigo-400 rounded-full 
                    hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  title="Copy message"
                >
                  <ClipboardIcon className="w-4 h-4" />
                </motion.button>
                
                {onReload && (
                  <motion.button
                    onClick={onReload}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 
                      dark:text-gray-400 dark:hover:text-indigo-400 rounded-full 
                      hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    title="Regenerate response"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                  </motion.button>
                )}
              </motion.div>
            )}

            {showReactionPicker && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={reactionPickerVariants}
                className="absolute -top-12 right-4 flex items-center space-x-2 
                  bg-white/90 dark:bg-gray-800/90 px-3 py-1.5 rounded-full shadow-lg 
                  border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm"
              >
                {Object.entries(reactionEmojis).map(([key, emoji]) => (
                  <motion.button
                    key={key}
                    onClick={() => {
                      setSelectedReaction(key);
                      setShowReactionPicker(false);
                    }}
                    onHoverStart={() => setReactionHovered(key)}
                    onHoverEnd={() => setReactionHovered(null)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-1.5 text-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 
                      rounded-full transition-colors relative transform hover:rotate-12"
                  >
                    {emoji}
                    {reactionHovered === key && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 
                          px-2 py-1 text-xs font-medium text-white bg-gray-800 
                          dark:bg-gray-700 rounded-md whitespace-nowrap"
                      >
                        {key}
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {message.metadata?.suggestions && (
          <MessageSuggestions 
            suggestions={message.metadata.suggestions}
            onSuggestionClick={(suggestion) => {
              console.log('Suggestion clicked:', suggestion);
            }}
          />
        )}

        {showMetadata && message.metadata && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-gray-500 dark:text-gray-400 pl-4 flex items-center space-x-2"
          >
            <span>{formatTimestamp(message.timestamp || 0)}</span>
            {message.metadata?.model && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="font-medium">{message.metadata.model}</span>
              </>
            )}
            {message.metadata?.tokens && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span>
                  {typeof message.metadata.tokens === 'object' 
                    ? `${(message.metadata.tokens as TokenCount).total_tokens || 0} tokens`
                    : `${message.metadata.tokens} tokens`}
                </span>
              </>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}; 