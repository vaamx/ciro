import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Trash2, MessageSquare } from 'lucide-react'; // Import icons
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
    event.stopPropagation(); // Prevent thread selection when deleting
    onThreadDelete(threadId);
  };

  // Handle message actions - remove unused messageId parameter
  // const handleCopyMessage = () => {
  //   console.log('Copy message functionality');
  // };

  // const handleRegenerateMessage = () => {
  //   console.log('Regenerate message functionality');
  // };

  return (
    <div className={`threads-container h-full flex flex-col bg-white dark:bg-gray-900 ${className}`}>
      {/* Header Section - Lobe Chat like */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          Threads
        </h1>
        <button
          onClick={onNewThread} // Use onNewThread from props
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
        >
          <PlusCircle size={18} className="mr-2" />
          New Thread
        </button>
      </div>

      {/* Thread List Section */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-6 text-center">
            <MessageSquare size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No Threads Yet</h3>
            <p className="text-sm">Click "New Thread" to start a new conversation.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <motion.div
                key={thread.id}
                className={`
                  relative group cursor-pointer rounded-xl p-3 transition-all duration-150 ease-in-out
                  border 
                  ${selectedThreadId === thread.id 
                    ? 'bg-purple-50 dark:bg-purple-800/30 border-purple-500 dark:border-purple-600 shadow-md' 
                    : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-sm'
                  }
                `}
                onClick={() => handleThreadSelect(thread.id)}
                whileHover={{ y: -2 }}
                layout // Animate layout changes
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {thread.title}
                    </h3>
                    {thread.lastMessage && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                        {thread.lastMessage}
                      </p>
                    )}
                  </div>
                  {/* Delete button - more subtle, appears on hover */}
                  <button
                    onClick={(e) => handleDeleteThread(thread.id, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity duration-150 rounded-full hover:bg-red-100/50 dark:hover:bg-red-700/30"
                    title="Delete thread"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTimestamp(thread.timestamp)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {thread.messageCount} messages
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Lobe chat doesn't have a prominent footer in the thread list itself */}
      {/* Removing the generic Copy Messages / Regenerate footer for now */}
    </div>
  );
}; 