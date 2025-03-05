import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowPathIcon, 
  ClipboardIcon, 
  SparklesIcon,
} from './icons';
import { type ChatMessage } from '../types';
import { MessageMarkdown } from './MessageMarkdown';
import { formatTimestamp } from '../utils/formatTimestamp';

interface TokenCount {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface AssistantMessageProps {
  message: ChatMessage;
  onCopy: () => void;
  onReload: () => void;
  onDelete?: () => void;
  showMetadata?: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  messageAlignment?: 'left' | 'right';
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  onCopy,
  onReload,
  onDelete,
  showMetadata = false,
  showAvatar = true,
  isFirstInGroup = false,
  isLastInGroup = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isTyping = message.status === 'streaming' || message.status === 'loading';

  const messageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring',
        damping: 30,
        stiffness: 400
      }
    },
    exit: { opacity: 0, y: -10 }
  };

  const actionBarVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: 'spring',
        damping: 25,
        stiffness: 400
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
        group relative flex items-start gap-8 px-8 py-6
        ${!isFirstInGroup ? 'mt-1' : 'mt-4'}
        ${!isLastInGroup ? 'mb-1' : 'mb-4'}
        bg-transparent dark:bg-transparent
        hover:bg-gray-50/30 dark:hover:bg-gray-900/30
        transition-all duration-200
      `}
    >
      {showAvatar && (
        <motion.div 
          className={`
            relative flex-shrink-0 w-8 h-8 rounded-xl overflow-hidden
            bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-500
            dark:from-violet-400 dark:via-indigo-400 dark:to-purple-400
            flex items-center justify-center
            shadow-lg shadow-violet-500/20 dark:shadow-violet-400/10
            ring-1 ring-white/10 dark:ring-white/5
            ${isFirstInGroup ? '' : 'invisible'}
            transform-gpu transition-all duration-300
            hover:scale-110 hover:rotate-3
            hover:shadow-xl hover:shadow-violet-500/30 dark:hover:shadow-violet-400/20
            group-hover:translate-x-1
          `}
          initial={{ scale: 0.5, rotate: -10, y: 10 }}
          animate={{ scale: 1, rotate: 0, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <SparklesIcon className="w-4 h-4 text-white/90 transform transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </motion.div>
      )}

      <div className="flex-1 min-w-0 max-w-3xl relative">
        <div className="prose prose-sm dark:prose-invert max-w-none
          prose-p:leading-relaxed prose-p:my-3 first:prose-p:mt-0 last:prose-p:mb-0
          prose-p:text-gray-700 dark:prose-p:text-white/90
          prose-headings:text-gray-900 dark:prose-headings:text-white
          prose-pre:my-3 prose-pre:bg-white/50 dark:prose-pre:bg-gray-800/50 
          prose-pre:rounded-xl prose-pre:shadow-sm prose-pre:ring-1 
          prose-pre:ring-gray-100 dark:prose-pre:ring-gray-700/50
          prose-code:text-gray-800 dark:prose-code:text-white/90 
          prose-code:bg-gray-50/80 dark:prose-code:bg-gray-800/80
          prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5
          prose-code:text-[13px] prose-code:font-medium
          prose-code:before:content-none prose-code:after:content-none
          prose-a:text-violet-600 dark:prose-a:text-violet-300 
          prose-a:no-underline hover:prose-a:underline
          prose-strong:text-gray-900 dark:prose-strong:text-white
          prose-em:text-gray-700 dark:prose-em:text-white/80
          prose-ul:my-2 prose-li:my-1 
          prose-li:text-gray-700 dark:prose-li:text-white/90
          prose-li:marker:text-gray-400 dark:prose-li:marker:text-white/40
          prose-blockquote:border-l-2 prose-blockquote:border-violet-200 
          dark:prose-blockquote:border-violet-500/30
          prose-blockquote:pl-4 prose-blockquote:my-4 
          prose-blockquote:italic 
          prose-blockquote:text-gray-700 dark:prose-blockquote:text-white/80
          prose-img:rounded-xl prose-img:shadow-lg
          [&_table]:border-collapse [&_td]:p-2 [&_th]:p-2
          [&_table]:my-4 [&_tr]:border-b 
          [&_tr]:border-gray-100 dark:[&_tr]:border-gray-800
          [&_th]:text-gray-900 dark:[&_th]:text-white
          [&_td]:text-gray-700 dark:[&_td]:text-white/90"
        >
          <MessageMarkdown content={message.content} />
        </div>

        {isTyping && (
          <div className="mt-3 flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="w-1 h-1 bg-violet-500/70 dark:bg-violet-400/70 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
              className="w-1 h-1 bg-indigo-500/70 dark:bg-indigo-400/70 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
              className="w-1 h-1 bg-purple-500/70 dark:bg-purple-400/70 rounded-full"
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
              className="absolute -top-3 right-0 flex items-center gap-2
                bg-white/80 dark:bg-gray-800/80 px-2.5 py-1.5 rounded-lg
                shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-700/50
                opacity-0 group-hover:opacity-100 transition-opacity
                backdrop-blur-sm"
            >
              <button
                onClick={onCopy}
                className="p-1.5 text-gray-600 hover:text-gray-900
                  dark:text-gray-400 dark:hover:text-gray-100 rounded-md
                  hover:bg-gray-100/70 dark:hover:bg-gray-700/70
                  transition-colors duration-200"
                title="Copy message"
              >
                <ClipboardIcon className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={onReload}
                className="p-1.5 text-gray-600 hover:text-gray-900
                  dark:text-gray-400 dark:hover:text-gray-100 rounded-md
                  hover:bg-gray-100/70 dark:hover:bg-gray-700/70
                  transition-colors duration-200"
                title="Regenerate response"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
              </button>

              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 text-gray-600 hover:text-red-600
                    dark:text-gray-400 dark:hover:text-red-400 rounded-md
                    hover:bg-red-100/70 dark:hover:bg-red-900/30
                    transition-colors duration-200"
                  title="Delete message"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {showMetadata && message.metadata && (
          <div className="mt-3 flex items-center gap-2 text-xs
            opacity-0 group-hover:opacity-100 transition-opacity select-none"
          >
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {formatTimestamp(message.timestamp || 0)}
            </span>
            {message.metadata?.model && (
              <>
                <span className="text-gray-400 dark:text-gray-500">•</span>
                <span className="font-medium text-violet-600/90 dark:text-violet-400/90">
                  {message.metadata.model}
                </span>
              </>
            )}
            {message.metadata?.tokens && (
              <>
                <span className="text-gray-400 dark:text-gray-500">•</span>
                <span className="font-medium text-gray-600/90 dark:text-gray-300/90">
                  {typeof message.metadata.tokens === 'object' 
                    ? `${(message.metadata.tokens as TokenCount).total_tokens || 0} tokens`
                    : `${message.metadata.tokens} tokens`}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}; 