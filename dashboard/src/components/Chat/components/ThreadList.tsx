import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { 
  MessageSquare, 
  Trash2, 
  Clock, 
  RefreshCw,
  MoreVertical 
} from 'lucide-react';

export interface Thread {
  id: string;
  title: string;
  last_message: string;
  updated_at: string;
  message_count: number;
}

export interface ThreadListProps {
  threads: Thread[];
  activeThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onThreadDelete?: (threadId: string) => void;
  isLoading?: boolean;
  onRetry?: () => void;
  className?: string;
}

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

const ThreadItem: React.FC<ThreadItemProps> = ({
  thread,
  isActive,
  onSelect,
  onDelete
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Error deleting thread:', error);
    } finally {
      setIsDeleting(false);
      setShowActions(false);
    }
  }, [onDelete]);

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ x: 2 }}
      className={`
        relative group cursor-pointer p-3 rounded-lg border transition-all duration-200
        ${isActive 
          ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-700'
          : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600'
        }
        ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
      `}
      onClick={onSelect}
    >
      {/* Main Content */}
      <div className="flex items-start space-x-3">
        {/* Thread Icon */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5
          ${isActive 
            ? 'bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }
        `}>
          <MessageSquare className="w-4 h-4" />
        </div>

        {/* Thread Info */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`
            text-sm font-medium leading-tight mb-1
            ${isActive 
              ? 'text-purple-900 dark:text-purple-200'
              : 'text-gray-900 dark:text-white'
            }
          `}>
            {truncateText(thread.title, 40)}
          </h3>

          {/* Last Message Preview */}
          <p className={`
            text-xs leading-relaxed mb-2
            ${isActive 
              ? 'text-purple-700 dark:text-purple-300'
              : 'text-gray-600 dark:text-gray-400'
            }
          `}>
            {truncateText(thread.last_message, 60)}
          </p>

          {/* Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(thread.updated_at)}</span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Message Count */}
              <span className={`
                text-xs px-2 py-0.5 rounded-full
                ${isActive 
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }
              `}>
                {thread.message_count}
              </span>

              {/* Actions Menu */}
              {onDelete && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(!showActions);
                    }}
                    className={`
                      opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded
                      hover:bg-gray-200 dark:hover:bg-gray-600
                      ${showActions ? 'opacity-100' : ''}
                    `}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>

                  <AnimatePresence>
                    {showActions && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50"
                      >
                        <button
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="w-full px-3 py-2 text-xs text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeThread"
          className="absolute left-0 top-1 bottom-1 w-1 bg-purple-500 rounded-r"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.div>
  );
};

const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-8">
    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="text-sm">Loading threads...</span>
    </div>
  </div>
);

const EmptyState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
      No conversations yet
    </h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
      Start a new conversation to see your threads here
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
      >
        Refresh
      </button>
    )}
  </div>
);

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  activeThreadId,
  onThreadSelect,
  onThreadDelete,
  isLoading = false,
  onRetry,
  className = ''
}) => {
  // Handle outside click to close any open action menus
  React.useEffect(() => {
    const handleClickOutside = () => {
      // Close any open action menus
      const buttons = document.querySelectorAll('[data-thread-actions]');
      buttons.forEach(button => {
        const event = new Event('blur');
        button.dispatchEvent(event);
      });
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (!threads || threads.length === 0) {
      return <EmptyState onRetry={onRetry} />;
    }

    return (
      <motion.div layout className="space-y-2 p-4">
        <AnimatePresence mode="popLayout">
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onSelect={() => onThreadSelect(thread.id)}
              onDelete={onThreadDelete ? () => onThreadDelete(thread.id) : undefined}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}; 