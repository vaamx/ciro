import React from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon } from './icons';
import { type ChatMessage } from '../types';
import { formatTimestamp } from '../utils/formatTimestamp';

interface ErrorMessageProps {
  message: ChatMessage;
  timestamp?: number;
  isMobile?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message,
  timestamp,
  isMobile = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start ${isMobile ? 'space-x-1.5' : 'space-x-2'}`}
    >
      <div className={`flex-shrink-0 ${isMobile ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-red-100 dark:bg-red-900/70 flex items-center justify-center`}>
        <ExclamationTriangleIcon className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-red-600 dark:text-red-300`} />
      </div>
      <div className="flex-1 space-y-1">
        {timestamp && (
          <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
            {formatTimestamp(timestamp)}
          </div>
        )}
        <div className={`bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-200 rounded-lg ${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
          <p className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{message.content}</p>
        </div>
      </div>
    </motion.div>
  );
}; 