import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// Temporarily commenting out missing components
// import { ThreadList } from './ThreadList';
// import { Thread } from '../types';
// import { ThreadControls } from './ThreadControls';
// import { type ChatMessage } from '../types';

interface Thread {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  messageCount: number;
}

interface ThreadsContainerProps {
  threads: Thread[];
  activeThreadId?: string;
  onThreadSelect: (threadId: string) => void;
  onThreadDelete: (threadId: string) => void;
  onNewThread: () => void;
  // onClearChat: () => void; // Commenting out unused prop
  className?: string;
}

export const ThreadsContainer: React.FC<ThreadsContainerProps> = ({
  threads,
  activeThreadId,
  onThreadSelect,
  onThreadDelete,
  onNewThread,
  className = ''
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(activeThreadId || null);

  // Remove unused function
  // const clearChat = () => {
  //   console.log('Clear chat functionality not implemented yet');
  // };

  useEffect(() => {
    setSelectedThreadId(activeThreadId || null);
  }, [activeThreadId]);

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
    onThreadSelect(threadId);
  };

  const handleNewThread = () => {
    setSelectedThreadId(null);
    onNewThread();
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const handleDeleteThread = (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onThreadDelete(threadId);
  };

  // Handle message actions - remove unused messageId parameter
  const handleCopyMessage = () => {
    console.log('Copy message functionality');
  };

  const handleRegenerateMessage = () => {
    console.log('Regenerate message functionality');
  };

  return (
    <div className={`threads-container h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Threads
        </h2>
        <button
          onClick={handleNewThread}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          New Thread
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>No threads yet. Start a new conversation!</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {threads.map((thread) => (
              <motion.div
                key={thread.id}
                className={`
                  relative group cursor-pointer rounded-lg p-3 transition-colors
                  ${selectedThreadId === thread.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
                onClick={() => handleThreadSelect(thread.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {thread.title}
                    </h3>
                    {thread.lastMessage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {thread.lastMessage}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTimestamp(thread.timestamp)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {thread.messageCount} messages
                      </span>
                    </div>
                  </div>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteThread(thread.id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-500 transition-all"
                    title="Delete thread"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-2">
          <button
            onClick={handleCopyMessage}
            className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Copy Messages
          </button>
          <button
            onClick={handleRegenerateMessage}
            className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}; 