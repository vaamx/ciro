import React, { useState, useMemo } from 'react';
import { useChat } from '../components/Chat/providers/ChatProvider';
import { ThreadsContainer } from '../components/Chat/components/ThreadsContainer';
import { Thread } from '../components/Chat/components/Thread';
import { ChatProvider } from '../components/Chat/providers/ChatProvider';
import { AnimatePresence } from 'framer-motion';
import type { ChatUIConfig } from '../components/Chat/types';

// Define Thread interface for ThreadsContainer
interface ThreadInfo {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  messageCount: number;
  isUnread?: boolean;
}

const ThreadsWrapper: React.FC = () => {
  const { 
    sessions, 
    messages,
    sendMessage,
    isGenerating,
    selectSession,
    deleteSession,
    createSession,
    isLoadingSessions,
    clearChat,
    createNewSessionImmediately
  } = useChat();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const threads: ThreadInfo[] = useMemo(() => sessions.map(session => ({
    id: session.id,
    title: session.title,
    lastMessage: session.last_message,
    timestamp: new Date(session.updated_at),
    messageCount: session.message_count,
    isUnread: false // You might want to implement this based on your logic
  })), [sessions]);

  const handleThreadSelect = async (threadId: string) => {
    console.log(`Opening chat for thread: ${threadId}`);
    setSelectedThreadId(threadId);
    await selectSession(threadId);
    setIsChatOpen(true);
  };

  const handleThreadDelete = async (threadId: string) => {
    await deleteSession(threadId);
    
    // If the deleted thread was open, close the chat interface
    if (selectedThreadId === threadId) {
      setIsChatOpen(false);
      setSelectedThreadId(null);
    }
  };

  const handleNewThread = async () => {
    const newSession = await createSession('New Thread');
    if (newSession) {
      console.log(`Created new thread: ${newSession.id}, opening chat...`);
      setSelectedThreadId(newSession.id);
      setIsChatOpen(true);
    }
  };

  const handleCloseChatInterface = () => {
    setIsChatOpen(false);
    setSelectedThreadId(null);
  };

  const handleClearChat = () => {
    clearChat();
  };

  const handleNewChatFromInterface = async () => {
    try {
      // Create a new session and open it
      const newSession = await createNewSessionImmediately(false, false);
      if (newSession) {
        console.log(`Created new chat session: ${newSession.id}`);
        setSelectedThreadId(newSession.id);
        // Chat interface stays open but switches to the new session
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  // Fix onSubmit handler to match expected signature
  const handleSubmit = (message: string, _attachments?: File[]) => {
    // Call sendMessage with just the message content as it expects
    sendMessage(message);
  };

  // Chat UI configuration - fix animations property and remove invalid properties
  const uiConfig: ChatUIConfig = {
    showAvatars: true,
    showTimestamps: true,
    showMetadata: false,
    enableCodeHighlighting: true,
    enableFileAttachments: true,
    messageAlignment: 'left' as const,
    theme: 'light',
    animations: {
      messageTransition: true,
      typingIndicator: true,
      scrollBehavior: 'smooth' as const
    }
  };

  if (isLoadingSessions) {
    return (
      <div className="flex items-center justify-center h-full">
        {/* Replace with a more Lobe-like loader if available */}
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <>
      <ThreadsContainer 
        threads={threads}
        activeThreadId={selectedThreadId || undefined}
        onThreadSelect={handleThreadSelect}
        onThreadDelete={handleThreadDelete}
        onNewThread={handleNewThread}
        className="p-0"
      />

      {/* Chat Interface Overlay */}
      <AnimatePresence>
        {isChatOpen && selectedThreadId && (
          <Thread
            messages={messages}
            onMessageRegenerate={(message) => {
              // Handle message regeneration
              console.log('Regenerate message:', message);
            }}
            onMessageCopy={(message) => {
              // Handle message copy
              navigator.clipboard.writeText(typeof message.content === 'string' ? message.content : JSON.stringify(message.content));
            }}
            onMessageEdit={(message, newContent) => {
              // Handle message edit
              console.log('Edit message:', message, newContent);
            }}
            onMessageDelete={(message) => {
              // Handle message delete
              console.log('Delete message:', message);
            }}
            onClose={handleCloseChatInterface}
            onClearChat={handleClearChat}
            onCancelGeneration={() => {
              // Handle cancel generation
              console.log('Cancel generation');
            }}
            isGenerating={isGenerating}
            isLoading={false}
            error={null}
            onSubmit={handleSubmit}
            uiConfig={uiConfig}
            participants={[]}
            onMessageRestore={(messages) => {
              // Handle message restore
              console.log('Restore messages:', messages);
            }}
            activeSessionId={selectedThreadId}
            sessions={sessions}
            onSessionSelect={async (sessionId: string) => {
              await selectSession(sessionId);
              setSelectedThreadId(sessionId);
            }}
            isLoadingSessions={isLoadingSessions}
            onRetry={() => {
              // Handle retry
              console.log('Retry loading sessions');
            }}
            onNewChat={handleNewChatFromInterface}
            onKnowledgeItemSelect={() => {
              // Handle knowledge item select
              console.log('Knowledge item selected');
            }}
            isKnowledgeBaseVisible={true}
            onKnowledgeBaseToggle={() => {
              // Handle knowledge base toggle
              console.log('Knowledge base toggle');
            }}
            onLoadMoreMessages={() => {
              // Handle load more messages
              console.log('Load more messages');
            }}
            hasMoreMessages={false}
            onForceEndLoading={() => {
              // Handle force end loading
              console.log('Force end loading');
            }}
            onSkipLoadingAndStartNewChat={() => {
              // Handle skip loading and start new chat
              handleNewChatFromInterface();
            }}
            showWelcomeScreen={messages.length === 0}
            welcomeScreenRenderer={() => (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-6 rounded-full mb-6">
                  <svg className="w-12 h-12 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Welcome to Chat
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                  Start a conversation by typing your message below. I'm here to help with any questions or tasks you have.
                </p>
              </div>
            )}
            onDeleteSession={async (sessionId: string) => {
              await deleteSession(sessionId);
              // If the deleted session was the active one, close the interface
              if (sessionId === selectedThreadId) {
                setIsChatOpen(false);
                setSelectedThreadId(null);
              }
            }}
            isMobile={window.innerWidth < 768}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export const ThreadsPage: React.FC = () => {
  return (
    // Wrap with ChatProvider if not already provided higher up the tree
    <ChatProvider>
      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950">
        {/* Main content area - Lobe Chat has a more integrated header */}
        <div className="flex-1 overflow-hidden">
          <ThreadsWrapper />
        </div>
      </div>
    </ChatProvider>
  );
}; 