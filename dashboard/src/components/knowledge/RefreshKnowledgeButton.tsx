import React, { useState } from 'react';
import { RefreshCw, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { refreshKnowledgeBase } from '../../refresh-knowledge-base';

interface RefreshKnowledgeButtonProps {
  className?: string;
}

export const RefreshKnowledgeButton: React.FC<RefreshKnowledgeButtonProps> = ({ className = '' }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleRefresh = async (forceReload = false) => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      await refreshKnowledgeBase(forceReload);
      
      // Reset the refreshing state after a delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1500);
    } catch (error) {
      console.error('Error refreshing knowledge base:', error);
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative inline-flex gap-1">
      {/* Main refresh button */}
      <button
        className={`
          p-2 rounded-lg text-gray-600 dark:text-gray-300
          hover:bg-gray-100 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
          transition-all duration-200
          ${isRefreshing ? 'opacity-70 cursor-not-allowed' : ''}
          ${className}
        `}
        onClick={() => handleRefresh(false)}
        disabled={isRefreshing}
        title="Refresh Knowledge Base"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <RefreshCw 
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>

      {/* Force refresh button */}
      <button
        className={`
          p-2 rounded-lg text-gray-600 dark:text-gray-300
          hover:bg-gray-100 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
          transition-all duration-200
          ${isRefreshing ? 'opacity-70 cursor-not-allowed' : ''}
        `}
        onClick={() => handleRefresh(true)}
        disabled={isRefreshing}
        title="Force Reload Knowledge Base"
      >
        <RotateCw className="w-4 h-4" />
      </button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && !isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Knowledge Base'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 whitespace-nowrap"
        >
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Refreshing...
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default RefreshKnowledgeButton; 