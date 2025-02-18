import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LightBulbIcon, SparklesIcon } from './icons';

interface MessageSuggestionsProps {
  suggestions?: string[];
  onSuggestionClick: (suggestion: string) => void;
  className?: string;
}

export const MessageSuggestions: React.FC<MessageSuggestionsProps> = ({
  suggestions = [],
  onSuggestionClick,
  className = '',
}) => {
  if (!suggestions.length) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
        <SparklesIcon className="w-4 h-4" />
        <span>Suggested responses</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSuggestionClick(suggestion)}
              className="inline-flex items-center space-x-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 transition-colors"
            >
              <LightBulbIcon className="w-4 h-4" />
              <span>{suggestion}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}; 