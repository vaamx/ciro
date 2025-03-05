import { forwardRef, useEffect, useState, useRef, useCallback } from 'react';
import type { ChatMessage, ChatUIConfig } from '../types';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import { Composer, MessageGroup } from '.';
import { KnowledgeSidebar } from '../../knowledge/KnowledgeSidebar';
import { KnowledgeItem } from '../../../types/knowledge';

export interface ThreadProps {
  messages: ChatMessage[];
  onMessageRegenerate: (message: ChatMessage) => void;
  onMessageCopy: (message: ChatMessage) => void;
  onMessageEdit?: (message: ChatMessage, newContent: string) => void;
  onMessageDelete?: (message: ChatMessage) => void;
  onClose: () => void;
  onClearChat: () => void;
  onCancelGeneration?: () => void;
  isGenerating: boolean;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (message: string, attachments?: File[]) => void;
  uiConfig: ChatUIConfig;
  participants?: {
    id: string;
    name: string;
    avatar?: string;
    isTyping?: boolean;
  }[];
  onMessageRestore?: (messages: ChatMessage[]) => void;
  activeSessionId: string | null;
  sessions?: {
    id: string;
    title: string;
    last_message: string;
    updated_at: string;
    message_count: number;
  }[];
  onSessionSelect: (sessionId: string) => void;
  isLoadingSessions?: boolean;
  onRetry?: () => void;
  onNewChat?: () => void;
  onKnowledgeItemSelect?: (item: KnowledgeItem) => void;
}

// Group messages helper function
const groupMessages = (msgs: ChatMessage[]) => {
  const groups: ChatMessage[][] = [];
  let currentGroup: ChatMessage[] = [];
  
  msgs.forEach((message, index) => {
    if (index === 0) {
      currentGroup.push(message);
      return;
    }

    const prevMessage = msgs[index - 1];
    const timeDiff = message.timestamp && prevMessage.timestamp
      ? message.timestamp - prevMessage.timestamp
      : 0;
    
    if (
      message.role === prevMessage.role &&
      timeDiff < 2 * 60 * 1000 // 2 minutes
    ) {
      currentGroup.push(message);
    } else {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [message];
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

export const Thread = forwardRef<HTMLDivElement, ThreadProps>(({
  messages,
  onMessageRegenerate,
  onMessageCopy,
  onMessageEdit,
  onMessageDelete,
  onClose,
  onClearChat,
  onCancelGeneration,
  isGenerating,
  isLoading,
  error,
  onSubmit,
  uiConfig,
  participants,
  onMessageRestore,
  activeSessionId,
  sessions,
  onSessionSelect,
  isLoadingSessions,
  onRetry,
  onNewChat,
  onKnowledgeItemSelect,
}, ref) => {
  const [groupedMessages, setGroupedMessages] = useState<ChatMessage[][]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const { ref: inViewRef, inView } = useInView({ 
    threshold: 0,
    rootMargin: '0px 0px -100px 0px'
  });
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isKnowledgeBaseVisible, setIsKnowledgeBaseVisible] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{sessionId: string, title: string} | null>(null);

  // Message grouping effect
  useEffect(() => {
    setGroupedMessages(groupMessages(messages));
  }, [messages]);

  // Scroll handling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
      
      // Check for unread messages
      if (!isNearBottom && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const isNewMessage = lastMessage.timestamp && 
          lastMessage.timestamp > Date.now() - 1000;
        if (isNewMessage) {
          setHasUnreadMessages(true);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages]);

  // Auto-scroll effect
  useEffect(() => {
    if (messages.length > 0 && shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll]);

  // Unread messages effect
  useEffect(() => {
    if (!inView && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isNewMessage = lastMessage.timestamp && 
        lastMessage.timestamp > Date.now() - 1000;
      if (isNewMessage && !shouldAutoScroll) {
        setHasUnreadMessages(true);
      }
    } else {
      setHasUnreadMessages(false);
    }
  }, [messages, inView, shouldAutoScroll]);

  // Message restoration effect
  useEffect(() => {
    if (!activeSessionId && messages.length === 0) {
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          if (Array.isArray(parsedMessages) && parsedMessages.length > 0 && typeof onMessageRestore === 'function') {
            onMessageRestore(parsedMessages);
          }
        } catch (error) {
          console.error('Error restoring messages:', error);
          localStorage.removeItem('chatMessages');
        }
      }
    }
  }, [activeSessionId, messages.length, onMessageRestore]);

  // Message persistence effect
  useEffect(() => {
    if (!activeSessionId && messages.length > 0) {
      try {
        localStorage.setItem('chatMessages', JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving messages:', error);
      }
    }
  }, [messages, activeSessionId]);

  // Initial scroll effect - ensure messages are visible when chat opens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, []);

  // Auto-scroll effect for new messages
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
      });
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
    setHasUnreadMessages(false);
  };

  // Add scroll to bottom button if there are unread messages
  const renderScrollToBottomButton = () => {
    if (hasUnreadMessages) {
      return (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={scrollToBottom}
          className="fixed bottom-24 right-8 bg-purple-600 text-white rounded-full p-3 shadow-lg hover:bg-purple-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.button>
      );
    }
    return null;
  };

  // Create a callback ref that handles both refs
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      // Save a reference to the node
      messagesContainerRef.current = node;
      // Forward the node to the inView ref
      inViewRef(node);
    },
    [inViewRef]
  );

  const handleKnowledgeItemSelect = (item: KnowledgeItem) => {
    onKnowledgeItemSelect?.(item);
  };

  // Add this useEffect to close the history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.chat-history-dropdown')) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add delete confirmation dialog
  const renderDeleteConfirmation = () => {
    if (!deleteConfirmation) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Delete Chat
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Are you sure you want to delete "{deleteConfirmation.title}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirmation(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const sessionId = deleteConfirmation.sessionId;
                // If it's the active session, clear it first
                if (sessionId === activeSessionId) {
                  onClearChat();
                  // Create a new chat after clearing
                  if (onNewChat) {
                    onNewChat();
                  }
                }
                // Delete the session
                if (onMessageDelete) {
                  onMessageDelete({
                    id: sessionId,
                    role: 'system',
                    content: deleteConfirmation.title,
                    timestamp: Date.now(),
                    status: 'complete',
                    metadata: {
                      sessionId: sessionId,
                      isSessionDelete: true,
                      type: 'session_deletion'
                    }
                  });
                }
                setDeleteConfirmation(null);
                setIsHistoryOpen(false);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 
                hover:bg-red-700 rounded-md transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Update the delete button click handler
  const handleDeleteClick = (e: React.MouseEvent | React.KeyboardEvent, session: { id: string; title: string }) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteConfirmation({ sessionId: session.id, title: session.title });
  };

  return (
    <motion.div
      ref={ref}
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-[1000px] 
        bg-white dark:bg-gray-950 shadow-xl z-50 
        border-l border-gray-200 dark:border-gray-800
        flex flex-col h-screen"
    >
      {/* Static Header */}
      <div className="flex-none border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left side - Close button and Chat Controls */}
          <div className="flex items-center gap-3">
            {/* Chat History Dropdown */}
            <div className="relative chat-history-dropdown">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium
                  text-gray-700 dark:text-gray-300
                  bg-gray-100 dark:bg-gray-800
                  hover:bg-gray-200 dark:hover:bg-gray-700
                  rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="max-w-[150px] truncate">
                  {activeSessionId 
                    ? sessions?.find(s => s.id === activeSessionId)?.title || 'Current Chat'
                    : 'New Chat'}
                </span>
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* History Dropdown Menu */}
              {isHistoryOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-gray-800 
                  rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50
                  overflow-hidden"
                >
                  {/* New Chat Button */}
                  <button
                    onClick={() => {
                      if (onNewChat) {
                        onNewChat();
                        setIsHistoryOpen(false);
                      }
                    }}
                    className="flex items-center gap-2 w-full px-4 py-3 text-left
                      bg-gradient-to-r from-purple-500/10 to-indigo-500/10
                      hover:from-purple-500/20 hover:to-indigo-500/20
                      border-b border-gray-200 dark:border-gray-700"
                  >
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium text-gray-900 dark:text-white">New Chat</span>
                  </button>

                  {/* Chat History List */}
                  <div className="max-h-[calc(100vh-200px)] overflow-y-auto py-1">
                    {isLoadingSessions ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
                        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                          Loading chats...
                        </span>
                      </div>
                    ) : sessions && sessions.length > 0 ? (
                      sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`flex flex-col w-full px-4 py-3 text-left relative group cursor-pointer
                            ${activeSessionId === session.id 
                              ? 'bg-purple-50 dark:bg-purple-900/20' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                            transition-colors duration-150`}
                          onClick={() => {
                            onSessionSelect(session.id);
                            setIsHistoryOpen(false);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`font-medium truncate max-w-[80%]
                              ${activeSessionId === session.id 
                                ? 'text-purple-700 dark:text-purple-400' 
                                : 'text-gray-900 dark:text-white'}`}
                            >
                              {session.title}
                            </span>
                            
                            {/* Delete Button */}
                            <div
                              onClick={(e) => handleDeleteClick(e, session)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleDeleteClick(e, session);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 
                                dark:hover:bg-red-900/30 rounded-full transition-all duration-200
                                text-gray-500 hover:text-red-600 dark:text-gray-400 
                                dark:hover:text-red-400 cursor-pointer"
                              title="Delete chat"
                              role="button"
                              tabIndex={0}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </div>
                          </div>

                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                            {session.last_message || 'No messages yet'}
                          </span>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(session.updated_at).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {session.message_count} messages
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No chat history
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Knowledge Base Toggle Button */}
            <button
              onClick={() => setIsKnowledgeBaseVisible(!isKnowledgeBaseVisible)}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white
                focus:outline-none rounded-lg 
                flex items-center gap-2 
                bg-gray-100 dark:bg-gray-800 
                hover:bg-gray-200 dark:hover:bg-gray-700
                transition-all duration-200"
              title={isKnowledgeBaseVisible ? "Hide Knowledge Base" : "Show Knowledge Base"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-sm font-medium">Knowledge Base</span>
            </button>

            {/* Exit Button - Moved here */}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
                rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Close chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        </div>

      <div className="flex flex-1 min-h-0">
        {/* Main Chat Area */}
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${isKnowledgeBaseVisible ? 'w-[calc(100%-350px)]' : 'w-full'}`}>
            {/* Messages Container */}
            <div
              ref={setRefs}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-950"
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Loading messages...
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center space-y-4 text-center max-w-md">
                    <div className="text-red-500">
                      <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{error}</p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              ) : groupedMessages.map((group, index) => (
                <MessageGroup
                  key={group[0].id}
                  messages={group}
                  onRegenerate={onMessageRegenerate}
                  onCopy={onMessageCopy}
                  onEdit={onMessageEdit}
                  onDelete={onMessageDelete}
                  isLastGroup={index === groupedMessages.length - 1}
                  showMetadata={uiConfig.showMetadata}
                  showAvatar={uiConfig.showAvatars}
                  messageAlignment={uiConfig.messageAlignment}
                  bubbleStyle="modern"
                  accentColor="purple"
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

          {/* Composer Section - Updated */}
          <div className="flex-none border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4">
              <Composer
                onSubmit={onSubmit}
                isGenerating={isGenerating}
                disabled={isGenerating || isLoading}
                placeholder="Type your message..."
                suggestions={messages[messages.length - 1]?.metadata?.suggestions}
                mentionableUsers={participants}
                allowAttachments={uiConfig.enableFileAttachments}
                allowVoiceInput={true}
                maxAttachmentSize={10 * 1024 * 1024}
                supportedFileTypes={['image/*', 'application/pdf', 'text/*']}
                className="min-h-[60px] max-h-[200px]"
              />
              
              {isGenerating && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="animate-pulse">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                  <span>Generating response...</span>
                  {onCancelGeneration && (
                    <button
                      onClick={onCancelGeneration}
                      className="text-sm text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Knowledge Base Sidebar */}
        <div
          className={`flex-none transition-all duration-300 border-l border-gray-200 dark:border-gray-800
            ${isKnowledgeBaseVisible ? 'w-[350px]' : 'w-0 overflow-hidden'}`}
        >
          <KnowledgeSidebar
            onItemSelect={handleKnowledgeItemSelect}
          />
        </div>
            </div>

        <AnimatePresence>
          {renderScrollToBottomButton()}
        {renderDeleteConfirmation()}
        </AnimatePresence>
    </motion.div>
  );
});

Thread.displayName = 'Thread'; 