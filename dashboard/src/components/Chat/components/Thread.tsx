import React, { forwardRef, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { ChatMessage, ChatUIConfig } from '../types';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import { Composer, MessageGroup } from '.';
import { KnowledgeSidebar } from '../../knowledge/KnowledgeSidebar';
import { KnowledgeItem } from '../../../types/knowledge';
import { 
  Trash2 as TrashIcon, 
  BookOpen, 
  Plus, 
  ChevronLeft, 
  MoreVertical, 
  Clipboard, 
  X 
} from 'lucide-react';

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
  onSessionSelect: (sessionId: string) => Promise<void>;
  isLoadingSessions?: boolean;
  onRetry?: () => void;
  onNewChat?: () => void;
  onKnowledgeItemSelect?: (item: KnowledgeItem) => void;
  isKnowledgeBaseVisible?: boolean;
  onKnowledgeBaseToggle?: () => void;
  onLoadMoreMessages?: () => void;
  hasMoreMessages?: boolean;
  onForceEndLoading?: () => void;
  onSkipLoadingAndStartNewChat?: () => void;
  showWelcomeScreen?: boolean;
  welcomeScreenRenderer?: () => React.ReactNode;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  isMobile?: boolean;
}

// Group messages helper function
const groupMessages = (msgs: ChatMessage[]): ChatMessage[][] => {
  // Log the number of messages being grouped
  console.log(`Grouping ${msgs?.length || 0} messages`);

  // Handle edge cases
  if (!msgs || msgs.length === 0) {
    console.log('No messages to group');
    return [];
  }

  try {
    // Filter out temporary welcome messages if there are other messages
    const hasRealMessages = msgs.some(m => !m.id.includes('welcome-'));
    let filteredMsgs = hasRealMessages 
      ? msgs.filter(m => !m.id.includes('welcome-')) 
      : msgs;

    // Log filtered messages
    console.log(`After filtering welcome messages: ${filteredMsgs.length} messages remain`);

    // Deduplicate messages - keep the last message with the same ID
    const uniqueMessages = filteredMsgs.reduce((acc, curr) => {
      acc[curr.id] = curr;
      return acc;
    }, {} as Record<string, ChatMessage>);
    
    // Enhance message validation with better error logging
    const validMessages = Object.values(uniqueMessages).filter(msg => {
      if (!msg) {
        console.warn('Filtering out null/undefined message');
        return false;
      }
      if (!msg.role) {
        console.warn(`Message missing role, id: ${msg.id}`);
        return false;
      }
      // Add default status if missing
      if (!msg.status) {
        msg.status = 'complete';
      }
      return true;
    });

    // Log valid messages
    console.log(`After validation: ${validMessages.length} valid messages`);

    // Sort messages by timestamp
    const sortedMessages = validMessages.sort((a, b) => 
      (a.timestamp || 0) - (b.timestamp || 0)
    );

    // Group messages by role and time proximity
    const groups: ChatMessage[][] = [];
    let currentGroup: ChatMessage[] = [];

    sortedMessages.forEach((message, index) => {
      const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
      
      // Start a new group if:
      // 1. This is the first message
      // 2. The role changed from the previous message
      // 3. There's a significant time gap (> 5 minutes) between messages of the same role
      const timeGap = prevMessage ? (message.timestamp || 0) - (prevMessage.timestamp || 0) : 0;
      const shouldStartNewGroup = 
        !prevMessage || 
        prevMessage.role !== message.role || 
        (timeGap > 5 * 60 * 1000); // 5 minutes in milliseconds
      
      if (shouldStartNewGroup && currentGroup.length > 0) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
      
      currentGroup.push(message);
    });

    // Add the last group if it's not empty
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    console.log(`Grouped into ${groups.length} message groups`);
    
    // Log the first message of each group for debugging
    groups.forEach((group, i) => {
      if (group.length > 0) {
        console.log(`Group ${i+1}: ${group.length} messages, first message role: ${group[0].role}`);
      }
    });
    
    return groups;
  } catch (error) {
    console.error('Error grouping messages:', error);
    // Fallback: return all messages individually
    return msgs.map(msg => [msg]);
  }
};

// Update the ChatHistoryDropdown component to fix session display issues
const ChatHistoryDropdown: React.FC<{
  sessions?: {
    id: string;
    title: string;
    last_message: string;
    updated_at: string;
    message_count: number;
  }[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => Promise<void>;
  onNewChat?: () => void;
  isLoadingSessions?: boolean;
  onRetry?: () => void;
  onDeleteSession?: (sessionId: string) => Promise<void>;
}> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  isLoadingSessions,
  onRetry,
  onDeleteSession
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Log sessions for debugging
  useEffect(() => {
    console.log('ChatHistoryDropdown - Available Sessions:', sessions);
    console.log('ChatHistoryDropdown - Active Session ID:', activeSessionId);
  }, [sessions, activeSessionId]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle session deletion with loading state
  const handleDeleteSession = async (sessionId: string) => {
    if (deletingSessionId) {
      // Already deleting a session, prevent multiple clicks
      return;
    }
    
    try {
      setDeletingSessionId(sessionId);
      if (onDeleteSession) {
        await onDeleteSession(sessionId);
      }
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Get current session title
  const currentSessionTitle = useMemo(() => {
    if (!activeSessionId || !sessions) return 'New Chat';
    
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return 'New Chat';
    
    // Use the session title, or fallback to 'Untitled Chat' if empty
    return activeSession.title || 'Untitled Chat';
  }, [activeSessionId, sessions]);

  // Log title changes for debugging
  useEffect(() => {
    console.log('Current session title:', currentSessionTitle);
  }, [currentSessionTitle]);

  // Force the history dropdown to open if we have sessions but not showing them
  useEffect(() => {
    if (sessions && sessions.length > 0 && !isOpen && !isLoadingSessions) {
      console.log('Sessions are available but dropdown is closed');
    }
  }, [sessions, isOpen, isLoadingSessions]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chat history dropdown button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-left px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
      >
        <span className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
          {currentSessionTitle}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 group-hover:text-gray-700 dark:group-hover:text-gray-300 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
        >
          {/* New Chat Button */}
          {onNewChat && (
            <button
              onClick={() => {
                onNewChat();
                // Don't close the dropdown after creating a new chat
                // so user can see it appear in the list
              }}
              className="flex items-center gap-2 w-full px-4 py-3 text-left font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
            >
              <Plus className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>New Chat</span>
            </button>
          )}

          {/* Sessions list */}
          <div className="max-h-80 overflow-y-auto">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              </div>
            ) : sessions && sessions.length > 0 ? (
              <div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-750 sticky top-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">Recent Chats</p>
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      {sessions.length}
                    </span>
                  </div>
                </div>
                {sessions.map((session) => (
                  <div 
                    key={session.id}
                    className={`w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      activeSessionId === session.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        try {
                          // Show loading indicator
                          const loadingIndicator = document.createElement('div');
                          loadingIndicator.id = 'session-loading-indicator';
                          loadingIndicator.className = 'fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center';
                          loadingIndicator.innerHTML = `
                            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg flex items-center space-x-3">
                              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-600"></div>
                              <span class="text-gray-700 dark:text-gray-300">Switching chat...</span>
                            </div>
                          `;
                          document.body.appendChild(loadingIndicator);
                          
                          // Select the session
                          onSessionSelect(session.id)
                            .then(() => {
                              // Success - close the dropdown
                              setIsOpen(false);
                            })
                            .catch((error: Error) => {
                              // Show error notification
                              const errorMsg = error?.message || 'Failed to switch chat session';
                              
                              // Create error notification
                              const errorNotification = document.createElement('div');
                              errorNotification.id = 'session-error-notification';
                              errorNotification.className = 'fixed top-4 right-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 shadow-lg rounded z-50 flex items-start';
                              errorNotification.style.maxWidth = '400px';
                              errorNotification.innerHTML = `
                                <div class="flex-shrink-0 mr-2">
                                  <svg class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                  </svg>
                                </div>
                                <div class="flex-1">
                                  <p class="text-sm font-medium">${errorMsg}</p>
                                </div>
                                <button class="ml-2 text-red-500 hover:text-red-700">
                                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                  </svg>
                                </button>
                              `;
                              
                              document.body.appendChild(errorNotification);
                              
                              // Add click handler to close button
                              const closeButton = errorNotification.querySelector('button');
                              if (closeButton) {
                                closeButton.addEventListener('click', () => {
                                  document.body.removeChild(errorNotification);
                                });
                              }
                              
                              // Auto-remove after 5 seconds
                              setTimeout(() => {
                                if (document.body.contains(errorNotification)) {
                                  document.body.removeChild(errorNotification);
                                }
                              }, 5000);
                            })
                            .finally(() => {
                              // Remove loading indicator
                              const indicator = document.getElementById('session-loading-indicator');
                              if (indicator && document.body.contains(indicator)) {
                                document.body.removeChild(indicator);
                              }
                            });
                        } catch (error) {
                          console.error('Error selecting session:', error);
                        }
                      }}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[180px]">
                        {session.title || 'Untitled Chat'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                        {session.last_message || 'No messages yet'}
                      </p>
                      <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                        <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                        <span className="mx-1">•</span>
                        <span>{session.message_count} {session.message_count === 1 ? 'message' : 'messages'}</span>
                      </div>
                    </button>
                    {onDeleteSession && (
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        disabled={deletingSessionId === session.id}
                        className={`p-1.5 rounded-full ${
                          deletingSessionId === session.id
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        aria-label="Delete chat"
                      >
                        {deletingSessionId === session.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-4">
                  No chat history yet
                </p>
                {onNewChat && (
                  <button
                    onClick={() => {
                      onNewChat();
                      // Don't close dropdown after creating a new chat
                    }}
                    className="px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors"
                  >
                    Start your first chat
                  </button>
                )}
                {onRetry && (
                  <button
                    onClick={() => {
                      onRetry();
                      // Keep the dropdown open to allow viewing results
                    }}
                    className="mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                  >
                    Refresh
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Debug info in development mode */}
          {process.env.NODE_ENV === 'development' && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <details>
                <summary className="cursor-pointer">Debug Info</summary>
                <div className="p-2 mt-2 bg-gray-100 dark:bg-gray-750 rounded overflow-auto max-h-36">
                  <p>Active Session: {activeSessionId}</p>
                  <p>Sessions Count: {sessions?.length || 0}</p>
                  <p>Loading: {isLoadingSessions ? 'Yes' : 'No'}</p>
                </div>
              </details>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// Update the CustomThreadHeader component with functional three-dot menu
const CustomThreadHeader: React.FC<{
  onClose: () => void;
  onClearChat: () => void;
  onNewChat?: () => void;
  isKnowledgeBaseVisible?: boolean;
  onKnowledgeBaseToggle?: () => void;
  sessions?: {
    id: string;
    title: string;
    last_message: string;
    updated_at: string;
    message_count: number;
  }[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => Promise<void>;
  isLoadingSessions?: boolean;
  onRetry?: () => void;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  messages?: ChatMessage[];
  isMobile?: boolean;
}> = ({
  onClose,
  onClearChat,
  onNewChat,
  isKnowledgeBaseVisible,
  onKnowledgeBaseToggle,
  sessions,
  activeSessionId,
  onSessionSelect,
  isLoadingSessions,
  onRetry,
  onDeleteSession,
  messages = [],
  isMobile
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopyConversation = () => {
    // Generate text version of the conversation
    const conversationText = messages
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`;
      })
      .join('\n\n');

    // Copy to clipboard
    navigator.clipboard.writeText(conversationText)
      .then(() => {
        // Show success notification if possible
        if (window.notificationContext) {
          window.notificationContext.showNotification({
            type: 'success',
            message: 'Conversation copied to clipboard!'
          });
        }
      })
      .catch(err => {
        console.error('Failed to copy conversation:', err);
        // Show error notification if possible
        if (window.notificationContext) {
          window.notificationContext.showNotification({
            type: 'error',
            message: 'Failed to copy conversation to clipboard'
          });
        }
      });

    // Close the menu
    setShowMenu(false);
  };

  return (
    <div className={`flex items-center justify-between p-3 ${isMobile ? 'px-3' : 'px-5'} border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Back button on the far left */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Chat History Dropdown */}
        <div className="flex-1 min-w-0">
          <ChatHistoryDropdown
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            onNewChat={onNewChat}
            isLoadingSessions={isLoadingSessions}
            onRetry={onRetry}
            onDeleteSession={onDeleteSession}
          />
        </div>
      </div>

      {/* Right aligned actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Knowledge Base Toggle - Only show on non-mobile or make smaller on mobile */}
        <button
          onClick={(e) => {
            // Prevent default and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            // Direct DOM event handling
            e.nativeEvent.stopImmediatePropagation();
            
            console.log('[Knowledge Base] Toggle button clicked in header');
            if (typeof onKnowledgeBaseToggle === 'function') {
              try {
                // Force immediate execution
                window.setTimeout(() => {
                  onKnowledgeBaseToggle();
                  console.log('[Knowledge Base] onKnowledgeBaseToggle called from header button');
                }, 0);
              } catch (error) {
                console.error('[Knowledge Base] Error in onKnowledgeBaseToggle from header button:', error);
              }
            } else {
              console.error('[Knowledge Base] onKnowledgeBaseToggle is not a function in header');
            }
          }}
          className={`${isMobile ? 'p-2' : 'p-2'} rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 
                    dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 
                    ${isKnowledgeBaseVisible ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : ''}`}
          aria-label="Toggle Knowledge Base"
          title="Knowledge Base"
          data-testid="kb-toggle-button"
        >
          <BookOpen size={isMobile ? 20 : 18} />
        </button>

        {/* New Chat button - Hide text on mobile */}
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="flex items-center rounded-lg text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="New Chat"
          >
            <Plus size={18} className="mr-1" />
            <span className={`${isMobile ? 'hidden' : 'inline'} text-sm font-medium`}>New Chat</span>
          </button>
        )}

        {/* Three-dot menu button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 
                      dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            aria-label="Menu"
          >
            <MoreVertical size={18} />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="py-1">
                <button
                  onClick={() => {
                    handleCopyConversation();
                    setShowMenu(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Clipboard size={16} className="mr-2" />
                  Copy conversation
                </button>
                <button
                  onClick={() => {
                    onClearChat();
                    setShowMenu(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <TrashIcon size={16} className="mr-2" />
                  Clear conversation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  isKnowledgeBaseVisible = true,
  onKnowledgeBaseToggle,
  onLoadMoreMessages,
  hasMoreMessages,
  showWelcomeScreen,
  welcomeScreenRenderer,
  onDeleteSession,
  isMobile
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
  const [_isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{sessionId: string, title: string} | null>(null);

  // Group messages with useMemo to prevent unnecessary re-renders
  const memoizedGroupedMessages = useMemo(() => {
    console.log(`Grouping ${messages.length} messages with useMemo:`, messages);
    return groupMessages(messages);
  }, [messages]);

  // Set grouped messages with useCallback to prevent unnecessary re-renders
  const setGroupedMessagesState = useCallback((msgs: ChatMessage[][]) => {
    console.log(`Setting ${msgs.length} grouped messages`);
    setGroupedMessages(msgs);
  }, []);

  // Update grouped messages only when necessary
  useEffect(() => {
    if (memoizedGroupedMessages.length > 0) {
      setGroupedMessagesState(memoizedGroupedMessages);
    }
  }, [memoizedGroupedMessages, setGroupedMessagesState]);

  // Log when the component receives messages
  useEffect(() => {
    console.log(`Thread component received ${messages.length} messages:`, messages);
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
    const handleClickOutside = (event: globalThis.MouseEvent) => {
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

  // Handler for scrolling messages container
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      
      setShouldAutoScroll(isAtBottom);
      
      if (!isAtBottom && !hasUnreadMessages && messages.length > 0) {
        setHasUnreadMessages(true);
      } else if (isAtBottom && hasUnreadMessages) {
        setHasUnreadMessages(false);
      }
    }
  };

  // Run RAG diagnostics
  const handleRunRagDiagnostics = async () => {
    try {
      // Import RagService dynamically to avoid circular dependencies
      const { RagService } = await import('../../../services/rag/RagService');
      
      // Show a diagnostics message
      const diagnosticsMessageId = `rag-diagnostics-${Date.now()}`;
      const diagnosticsMessage: ChatMessage = {
        id: diagnosticsMessageId,
        role: 'system',
        content: 'Running RAG diagnostics...',
        timestamp: Date.now(),
        status: 'loading',
        metadata: {
          isSystemMessage: true,
          isDiagnostics: true
        }
      };
      
      // Add the message to the thread
      setGroupedMessages(prev => [...prev, [diagnosticsMessage]]);
      
      // Create RAG service and run diagnostics
      const ragService = new RagService();
      
      // Find the collection to test
      let dataSourceIdToTest: string | undefined;
      const messagesRev = [...messages].reverse();
      for (const msg of messagesRev) {
        if (msg.metadata?.dataSourceId) {
          dataSourceIdToTest = msg.metadata.dataSourceId.toString();
          break;
        }
      }
      
      // Run diagnostics
      const diagnosticResults = await ragService.runDiagnostics(dataSourceIdToTest);
      
      // Format results as markdown
      const formatErrors = (errors: string[]) => 
        errors.length > 0 
          ? errors.map(e => `- ❌ ${e}`).join('\n') 
          : '- ✅ No errors detected';
          
      const formatWarnings = (warnings: string[]) => 
        warnings.length > 0 
          ? warnings.map(w => `- ⚠️ ${w}`).join('\n') 
          : '- ✅ No warnings';
          
      const formatInfo = (info: Record<string, any>) => 
        Object.entries(info)
          .map(([key, value]) => `- **${key}**: ${value}`)
          .join('\n');
      
      const resultsMarkdown = `
## RAG Diagnostics Results

### Status: ${diagnosticResults.status ? '✅ Operational' : '❌ Issues Detected'}

### System Information
${formatInfo(diagnosticResults.info)}

### Collections
${diagnosticResults.collections.length === 0 
  ? '- No collections found' 
  : diagnosticResults.collections.map(c => `- ${c}`).join('\n')}

### Errors
${formatErrors(diagnosticResults.errors)}

### Warnings
${formatWarnings(diagnosticResults.warnings)}

### Suggestions
${diagnosticResults.suggestions.map(s => `- ${s}`).join('\n')}
`;
      
      // Update the diagnostics message
      setGroupedMessages(prev => 
        prev.map(group => 
          group.map(msg => 
            msg.id === diagnosticsMessageId 
              ? {
                  ...msg,
                  content: resultsMarkdown,
                  status: 'complete'
                }
              : msg
          )
        )
      );
    } catch (error: any) {
      console.error('Error running RAG diagnostics:', error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error running RAG diagnostics: ${error.message || 'Unknown error'}`,
        timestamp: Date.now(),
        status: 'error',
        metadata: {
          isSystemMessage: true,
          isError: true
        }
      };
      
      // Add the error message to the thread
      setGroupedMessages(prev => [...prev, [errorMessage]]);
    }
  };

  // Listen for diagnostics event
  useEffect(() => {
    const handleDiagnosticsEvent = (event: Event) => {
      if ((event as CustomEvent).detail) {
        handleRunRagDiagnostics();
      }
    };
    
    // Add event listener
    document.addEventListener('run-rag-diagnostics', handleDiagnosticsEvent);
    
    // Clean up
    return () => {
      document.removeEventListener('run-rag-diagnostics', handleDiagnosticsEvent);
    };
  }, [messages]);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.2 }}
      ref={ref}
      className={`fixed right-0 top-0 bottom-0 ${isMobile ? 'w-full' : 'w-[1000px]'} 
        bg-white dark:bg-gray-950 shadow-xl z-50 
        border-l border-gray-200 dark:border-gray-800
        flex flex-col h-screen`}
    >
      <div className="flex h-full w-full">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          {/* Header Section */}
          <CustomThreadHeader
            onClose={onClose}
            onClearChat={onClearChat}
            onNewChat={onNewChat}
            isKnowledgeBaseVisible={isKnowledgeBaseVisible}
            onKnowledgeBaseToggle={onKnowledgeBaseToggle}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            isLoadingSessions={isLoadingSessions}
            onRetry={onRetry}
            onDeleteSession={onDeleteSession}
            messages={messages}
            isMobile={isMobile}
          />

          {/* Messages Section */}
          <div 
            ref={setRefs}
            className={`flex-1 overflow-y-auto ${isMobile ? 'px-1' : 'px-2'} py-1 transition-all`}
            onScroll={handleScroll}
          >
            {/* Show welcome screen if specified */}
            {showWelcomeScreen && welcomeScreenRenderer ? (
              <div className="h-full">
                {welcomeScreenRenderer()}
              </div>
            ) : (
              <>
                {/* Load more messages button */}
                {hasMoreMessages && (
                  <div className="flex justify-center pt-2 pb-1">
                    <button 
                      onClick={onLoadMoreMessages}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors"
                    >
                      Load earlier messages
                    </button>
                  </div>
                )}

                {/* Error message if needed */}
                {error && (
                  <div className="px-4 py-3 mx-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400 dark:text-red-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                          {
                            error.includes("Session is not valid") ? 
                              "This chat session is not available in the current view." :
                            error.includes("different organization") ?
                              "This chat belongs to a different organization." :
                            error.includes("different dashboard") ?
                              "This chat belongs to a different dashboard." :
                            error
                          }
                        </h3>
                        {(error.includes("Session is not valid") || error.includes("different")) && (
                          <div className="mt-2 text-sm text-red-700 dark:text-red-500">
                            <p>Try selecting another chat session, creating a new one, or switching to the appropriate dashboard or organization.</p>
                            {onNewChat && (
                              <button
                                onClick={onNewChat}
                                className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md"
                              >
                                Create New Chat
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Loading spinner */}
                {isLoading && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 my-8"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
                  </div>
                )}
                
                {/* Grouped messages */}
                {groupedMessages.map((group, groupIndex) => (
                  <MessageGroup
                    key={`group-${groupIndex}-${group[0]?.id || 'empty'}`}
                    messages={group}
                    onRegenerate={onMessageRegenerate}
                    onCopy={onMessageCopy}
                    onEdit={onMessageEdit}
                    onDelete={onMessageDelete}
                    showMetadata={uiConfig.showMetadata}
                    showAvatar={uiConfig.showAvatars}
                    isLastGroup={groupIndex === groupedMessages.length - 1}
                    messageAlignment={uiConfig.messageAlignment}
                    bubbleStyle="modern"
                    accentColor="purple"
                    isMobile={isMobile}
                  />
                ))}
                
                {/* Scroll to bottom button */}
                {renderScrollToBottomButton()}
                
                {/* Scroll to bottom indicator */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Composer Section */}
          <div className="flex-none border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className={`${isMobile ? 'p-2' : 'p-4'}`}>
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
                className={`${isMobile ? 'min-h-[50px] max-h-[150px]' : 'min-h-[60px] max-h-[200px]'}`}
                isMobile={isMobile}
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

        {/* Knowledge Base Sidebar - show as a slide-in panel on mobile */}
        {isMobile ? (
          <AnimatePresence>
            {isKnowledgeBaseVisible && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex"
                data-testid="kb-mobile-panel"
              >
                {/* Transparent overlay to close when clicking outside */}
                <div 
                  className="absolute inset-0 bg-black bg-opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Direct DOM event handling to ensure it captures the click
                    e.nativeEvent.stopImmediatePropagation();
                    
                    console.log('[Knowledge Base] Overlay clicked, attempting to close...');
                    if (typeof onKnowledgeBaseToggle === 'function') {
                      try {
                        // Force immediate execution
                        window.setTimeout(() => {
                          onKnowledgeBaseToggle();
                          console.log('[Knowledge Base] onKnowledgeBaseToggle called from overlay');
                        }, 0);
                      } catch (error) {
                        console.error('[Knowledge Base] Error executing onKnowledgeBaseToggle from overlay:', error);
                      }
                    } else {
                      console.error('[Knowledge Base] onKnowledgeBaseToggle is not a function');
                    }
                  }}
                  onTouchStart={(e) => {
                    // Also handle touch events for mobile
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Knowledge Base] Overlay touched, attempting to close...');
                    if (typeof onKnowledgeBaseToggle === 'function') {
                      window.setTimeout(() => onKnowledgeBaseToggle(), 0);
                    }
                  }}
                  aria-label="Close knowledge base"
                  data-testid="kb-overlay"
                />
                
                <div 
                  className="relative ml-auto w-full max-w-[85%] h-full flex flex-col bg-white dark:bg-gray-900 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Mobile Knowledge Base Header */}
                  <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 bg-white dark:bg-gray-900">
                    <h2 className="text-base font-semibold flex items-center text-gray-800 dark:text-gray-100">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Knowledge Base
                    </h2>
                    
                    {/* Mobile close button - styling updated to match UI */}
                    <button
                      onClick={(e) => {
                        // Prevent default and stop propagation
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Direct DOM event handling
                        e.nativeEvent.stopImmediatePropagation();
                        
                        // Log the event for debugging
                        console.log('[Knowledge Base] Mobile close button clicked');
                        
                        // Call the toggle function directly with enhanced error handling
                        if (typeof onKnowledgeBaseToggle === 'function') {
                          try {
                            // Force immediate execution
                            window.setTimeout(() => {
                              onKnowledgeBaseToggle();
                              console.log('[Knowledge Base] onKnowledgeBaseToggle successfully called');
                            }, 0);
                          } catch (error) {
                            console.error('[Knowledge Base] Error in onKnowledgeBaseToggle:', error);
                          }
                        } else {
                          console.error('[Knowledge Base] onKnowledgeBaseToggle is not a function');
                        }
                      }}
                      className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200 shadow-sm z-30 transition-colors"
                      aria-label="Close knowledge base"
                      data-testid="kb-mobile-close-button"
                      type="button"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <X size={18} strokeWidth={2} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden relative z-10">
                    <KnowledgeSidebar
                      onItemSelect={(item) => {
                        handleKnowledgeItemSelect(item);
                        // Close the panel after selecting an item on mobile
                        if (onKnowledgeBaseToggle) {
                          onKnowledgeBaseToggle();
                        }
                      }}
                      isMobile={true}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div
            className={`flex-none transition-all duration-300 border-l border-gray-200 dark:border-gray-800
              ${isKnowledgeBaseVisible ? 'w-[350px]' : 'w-0 overflow-hidden'}`}
          >
            <KnowledgeSidebar
              onItemSelect={handleKnowledgeItemSelect}
              isMobile={false}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {renderScrollToBottomButton() && (
          <div key="scroll-button">
            {renderScrollToBottomButton()}
          </div>
        )}
        {renderDeleteConfirmation() && (
          <div key="delete-confirmation">
            {renderDeleteConfirmation()}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

Thread.displayName = 'Thread';

// ... existing code ... 