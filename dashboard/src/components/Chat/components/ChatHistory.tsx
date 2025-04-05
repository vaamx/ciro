import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatHistoryItem } from './ChatHistoryItem';
import { Loader2 as LoaderIcon, Plus as PlusIcon, Search as SearchIcon, X as XIcon } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useChat } from '../providers/ChatProvider';
import { DataTypeBadge } from './DataTypeBadge';
import { ChatMessage } from '../types';

const Loader2 = LoaderIcon as React.FC<LucideProps>;
const Plus = PlusIcon as React.FC<LucideProps>;
const Search = SearchIcon as React.FC<LucideProps>;
const X = XIcon as React.FC<LucideProps>;

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  messageCount: number;
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onNewChat?: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  isLoading = false,
  error = null,
  onRetry,
  onNewChat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState(sessions);
  const [selectedId, setSelectedId] = useState<string | null>(activeSessionId);
  const { messages } = useChat();
  
  // Group messages by content type and count occurrences
  const contentTypeCounts: Record<string, number> = {};
  
  messages.forEach((message: ChatMessage) => {
    if (message.role === 'assistant' && message.metadata?.contentType) {
      const contentType = message.metadata.contentType as string;
      contentTypeCounts[contentType] = (contentTypeCounts[contentType] || 0) + 1;
    }
  });
  
  // Check if we have any content types detected
  const hasContentTypes = Object.keys(contentTypeCounts).length > 0;

  useEffect(() => {
    const filtered = sessions.filter(session => 
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredSessions(filtered);
  }, [sessions, searchQuery]);

  useEffect(() => {
    setSelectedId(activeSessionId);
  }, [activeSessionId]);

  const handleSessionClick = (sessionId: string) => {
    // Add visual feedback before switching
    const element = document.getElementById(`chat-session-${sessionId}`);
    if (element) {
      element.classList.add('scale-[0.98]', 'bg-purple-50', 'dark:bg-purple-900/30');
      setTimeout(() => {
        element.classList.remove('scale-[0.98]', 'bg-purple-50', 'dark:bg-purple-900/30');
        setSelectedId(sessionId);
        onSessionSelect(sessionId);
      }, 150);
    } else {
      setSelectedId(sessionId);
      onSessionSelect(sessionId);
    }
  };

  const handleNewChatClick = () => {
    if (onNewChat) {
      // Add visual feedback for the button
      const button = document.querySelector('[data-new-chat-button]');
      if (button) {
        button.classList.add('scale-[0.98]');
        setTimeout(() => {
          button.classList.remove('scale-[0.98]');
          onNewChat();
        }, 150);
      } else {
        onNewChat();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with New Chat Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          data-new-chat-button
          onClick={handleNewChatClick}
          className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 
            hover:bg-purple-500 text-white rounded-lg transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
            active:scale-[0.98]"
        >
          <Plus className="w-5 h-5 mr-2" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 pr-10 bg-gray-50 dark:bg-gray-900 rounded-lg 
              text-sm text-gray-900 dark:text-white placeholder-gray-500 
              dark:placeholder-gray-400 focus:outline-none focus:ring-2 
              focus:ring-purple-500 dark:focus:ring-purple-400
              border border-gray-200 dark:border-gray-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600
                dark:hover:text-gray-300 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Type Summary */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Conversation Context</h2>
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content Types</h3>
          {hasContentTypes ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(contentTypeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center">
                  <DataTypeBadge dataType={type} />
                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({count})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No content types detected</p>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-32"
            >
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Loading conversations...
              </p>
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-32 text-center p-4"
            >
              <div className="text-red-500 mb-2">
                <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 
                    hover:bg-purple-500 rounded-lg transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Try again
                </button>
              )}
            </motion.div>
          ) : filteredSessions.length > 0 ? (
            filteredSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                id={`chat-session-${session.id}`}
                className="transition-all duration-200"
              >
                <ChatHistoryItem
                  {...session}
                  isActive={session.id === selectedId}
                  onClick={() => handleSessionClick(session.id)}
                />
              </motion.div>
            ))
          ) : searchQuery ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No conversations found matching "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-purple-600 hover:text-purple-500 
                  dark:text-purple-400 dark:hover:text-purple-300 font-medium"
              >
                Clear search
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-32 text-center"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No conversations yet
              </p>
              <button
                onClick={onNewChat}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-purple-600 
                  hover:bg-purple-500 rounded-lg transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                Start your first chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}; 