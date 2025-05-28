import React from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, RefreshCw } from 'lucide-react';

export interface LoadMoreButtonProps {
  onLoadMore: () => void;
  isLoading?: boolean;
  className?: string;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  onLoadMore,
  isLoading = false,
  className = ''
}) => {
  return (
    <div className={`flex justify-center ${className}`}>
      <motion.button
        onClick={onLoadMore}
        disabled={isLoading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
        <span>
          {isLoading ? 'Loading...' : 'Load more messages'}
        </span>
      </motion.button>
    </div>
  );
}; 