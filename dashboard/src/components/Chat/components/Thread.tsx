import { forwardRef, useEffect, useState, useRef, useCallback } from 'react';
import type { ChatMessage, ChatSettings, ChatUIConfig } from '../types';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import { Composer, MessageGroup, ThreadHeader } from '.';
import { Tab } from '@headlessui/react';
import { ChatHistory } from './ChatHistory';

export interface ThreadProps {
  messages: ChatMessage[];
  onMessageRegenerate: (message: ChatMessage) => void;
  onMessageCopy: (message: ChatMessage) => void;
  onMessageEdit?: (message: ChatMessage, newContent: string) => void;
  onMessageDelete?: (message: ChatMessage) => void;
  onClose: () => void;
  onSettingsClick: () => void;
  onClearChat: () => void;
  onCancelGeneration?: () => void;
  isGenerating: boolean;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (message: string, attachments?: File[]) => void;
  settings: ChatSettings;
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
  onSettingsClick,
  onClearChat,
  onCancelGeneration,
  isGenerating,
  isLoading,
  error,
  onSubmit,
  settings,
  uiConfig,
  participants,
  onMessageRestore,
  activeSessionId,
  sessions,
  onSessionSelect,
  isLoadingSessions,
  onRetry,
  onNewChat,
}, ref) => {
  const [groupedMessages, setGroupedMessages] = useState<ChatMessage[][]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const { ref: inViewRef, inView } = useInView({ 
    threshold: 0,
    rootMargin: '0px 0px -100px 0px'
  });
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

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

  const handleSessionSelect = (sessionId: string) => {
    onSessionSelect(sessionId);
    // Switch to chat tab when selecting a session
    setActiveTab('chat');
  };

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
      // Switch to chat tab when creating a new chat
      setActiveTab('chat');
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-[800px] 
        bg-white shadow-xl z-50 border-l border-gray-200
        flex flex-col h-screen"
    >
      {/* Static Header */}
      <div className="flex-none border-b border-gray-200">
        <ThreadHeader
          participants={participants}
          isGenerating={isGenerating}
          onClose={onClose}
          onSettingsClick={onSettingsClick}
          onClearChat={onClearChat}
          onCancelGeneration={onCancelGeneration}
        />
      </div>

      <Tab.Group 
        defaultIndex={0} 
        selectedIndex={activeTab === 'chat' ? 0 : activeTab === 'history' ? 1 : 2} 
        onChange={(index) => setActiveTab(index === 0 ? 'chat' : index === 1 ? 'history' : 'knowledge')}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Tab List */}
        <div className="flex-none border-b border-gray-200">
          <Tab.List className="flex px-4">
            <Tab className={({ selected }) => `
              px-4 py-2 text-sm font-medium transition-all duration-200
              focus:outline-none relative group
              ${selected 
                ? 'text-gray-900 border-b-2 border-purple-500' 
                : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'}
            `}>
              <span className="relative z-10">Chat</span>
              {isGenerating && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
              )}
            </Tab>
            <Tab className={({ selected }) => `
              px-4 py-2 text-sm font-medium transition-all duration-200
              focus:outline-none relative group
              ${selected 
                ? 'text-gray-900 border-b-2 border-purple-500' 
                : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'}
            `}>
              <span className="relative z-10 flex items-center">
                History
                {isLoadingSessions && (
                  <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
                )}
              </span>
            </Tab>
            <Tab className={({ selected }) => `
              px-4 py-2 text-sm font-medium transition-all duration-200
              focus:outline-none relative group
              ${selected 
                ? 'text-gray-900 border-b-2 border-purple-500' 
                : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'}
            `}>
              <span className="relative z-10">Knowledge</span>
            </Tab>
          </Tab.List>
        </div>

        <Tab.Panels className="flex-1 overflow-hidden">
          <Tab.Panel className="h-full flex flex-col">
            {/* Messages Container */}
            <div
              ref={setRefs}
              className="flex-1 overflow-y-auto p-4 space-y-4"
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

            {/* Composer */}
            <div className="flex-none p-4 border-t border-gray-200">
              <Composer
                onSubmit={onSubmit}
                isGenerating={isGenerating}
                disabled={isGenerating || isLoading}
                placeholder="Type your message..."
                streaming={settings.streaming}
                suggestions={messages[messages.length - 1]?.metadata?.suggestions}
                mentionableUsers={participants}
                allowAttachments={uiConfig.enableFileAttachments}
                allowVoiceInput={true}
                maxAttachmentSize={10 * 1024 * 1024}
                supportedFileTypes={['image/*', 'application/pdf', 'text/*']}
              />
            </div>
          </Tab.Panel>

          <Tab.Panel className="h-full">
            <ChatHistory
              sessions={sessions?.map(session => ({
                id: session.id,
                title: session.title,
                lastMessage: session.last_message,
                timestamp: new Date(session.updated_at).getTime(),
                messageCount: session.message_count
              })) || []}
              activeSessionId={activeSessionId || null}
              onSessionSelect={handleSessionSelect}
              isLoading={isLoadingSessions}
              error={error}
              onRetry={onRetry}
              onNewChat={handleNewChat}
            />
          </Tab.Panel>

          <Tab.Panel className="h-full p-4">
            <div className="text-center text-gray-500">
              Knowledge Base (Coming Soon)
            </div>
          </Tab.Panel>
        </Tab.Panels>

        <AnimatePresence>
          {renderScrollToBottomButton()}
        </AnimatePresence>
      </Tab.Group>
    </motion.div>
  );
});

Thread.displayName = 'Thread'; 