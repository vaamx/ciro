import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { formatTimestamp } from '../utils/formatTimestamp';

interface ChatHistoryItemProps {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messageCount: number;
  isActive: boolean;
  onClick: () => void;
}

export const ChatHistoryItem = forwardRef<HTMLDivElement, ChatHistoryItemProps>(({
  title,
  lastMessage,
  timestamp,
  messageCount,
  isActive,
  onClick,
}, ref) => {
  return (
    <motion.div
      ref={ref}
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`
        p-4 rounded-lg cursor-pointer transition-colors
        ${isActive 
          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800' 
          : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'}
        border border-gray-200/50 dark:border-gray-700/50
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {title}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {lastMessage}
          </p>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimestamp(timestamp)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {messageCount} messages
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ChatHistoryItem.displayName = 'ChatHistoryItem';