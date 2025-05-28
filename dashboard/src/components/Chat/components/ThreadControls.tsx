import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  MessageSquarePlus, 
  Settings, 
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';

export interface ThreadControlsProps {
  onNewThread: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
  onSearch?: (query: string) => void;
  onFilterChange?: (filter: ThreadFilter) => void;
  currentFilter?: ThreadFilter;
  searchPlaceholder?: string;
}

export type ThreadFilter = 'all' | 'recent' | 'archived' | 'starred';

const filterOptions: Array<{ value: ThreadFilter; label: string }> = [
  { value: 'all', label: 'All Threads' },
  { value: 'recent', label: 'Recent' },
  { value: 'archived', label: 'Archived' },
  { value: 'starred', label: 'Starred' },
];

export const ThreadControls: React.FC<ThreadControlsProps> = ({
  onNewThread,
  onClose,
  showCloseButton = false,
  className = '',
  onSearch,
  onFilterChange,
  currentFilter = 'all',
  searchPlaceholder = 'Search threads...'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleFilterSelect = (filter: ThreadFilter) => {
    if (onFilterChange) {
      onFilterChange(filter);
    }
    setShowFilterDropdown(false);
  };

  const currentFilterLabel = filterOptions.find(option => option.value === currentFilter)?.label || 'All Threads';

  return (
    <div className={`bg-background p-4 ${className}`}>
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Conversations
        </h2>
        
        <div className="flex items-center space-x-2">
          {/* Settings Button */}
          <button
            onClick={() => {/* Future: Open thread settings */}}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label="Thread settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Close Button (Mobile) */}
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Close thread list"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* New Thread Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewThread}
        className="w-full mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg px-4 py-3 flex items-center justify-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="font-medium">New Conversation</span>
      </motion.button>

      {/* Search and Filter Section */}
      {(onSearch || onFilterChange) && (
        <div className="space-y-3">
          {/* Search Bar */}
          {onSearch && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
          )}

          {/* Filter Dropdown */}
          {onFilterChange && (
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-sm"
              >
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <span>{currentFilterLabel}</span>
                </div>
                <ChevronDown 
                  className={`h-4 w-4 text-gray-400 transition-transform ${
                    showFilterDropdown ? 'rotate-180' : ''
                  }`} 
                />
              </button>

              {showFilterDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                >
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterSelect(option.value)}
                      className={`
                        w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg
                        ${currentFilter === option.value
                          ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-750'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700" />
    </div>
  );
}; 