import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatSettings, type ChatUIConfig } from './types';
import { Thread } from './components/Thread';
import { ChatProvider, useChat } from './providers/ChatProvider';
import { KnowledgeItem } from '../../types/knowledge';
import { useRag } from '../../hooks/useRag';
import { KnowledgeSidebar } from '../knowledge/KnowledgeSidebar';
import { useKnowledge } from '../../providers/KnowledgeProvider';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: Partial<ChatSettings>;
  uiConfig?: Partial<ChatUIConfig>;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  isOpen, 
  onClose
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-[800px] bg-background shadow-lg z-[60]"
        >
          <ChatProvider>
            <ChatPanelContent 
              onClose={onClose}
            />
          </ChatProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ChatPanelContentProps {
  onClose: () => void;
}

export const ChatPanelContent: React.FC<ChatPanelContentProps> = ({ 
  onClose
}) => {
  const {
    messages,
    isGenerating,
    isLoadingSessions,
    isLoadingMessages,
    error,
    sendMessage,
    regenerateMessage,
    clearChat,
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    deleteSession,
    retryLoad
  } = useChat();

  const { queryDataSources } = useRag();
  const { activeSource } = useKnowledge();
  const isKnowledgeBaseVisible = true;

  const handleNewChat = () => {
    createSession('New Chat');
  };

  const handleKnowledgeItemSelect = (item: KnowledgeItem) => {
    // Insert the knowledge item content into the chat
    if (typeof item.content === 'string') {
      sendMessage(item.content);
    }
  };

  const handleSendMessage = async (message: string) => {
    try {
      if (!activeSource) {
        throw new Error('No data source selected');
      }

      // Send user message immediately
      await sendMessage(message);

      // Query data sources and get AI response
      const response = await queryDataSources(message);
      if (!response) {
        throw new Error('No response from data sources');
      }

      // Send the AI response
      await sendMessage(response, true);

    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error processing message';
      await sendMessage(`Error: ${errorMessage}`, true);
    }
  };

  return (
    <div className="flex h-full relative">
      <div 
        className="absolute inset-0 flex"
        style={{ right: isKnowledgeBaseVisible ? '350px' : '0' }}
      >
        <div className="w-full h-full overflow-auto px-6">
          <div className="max-w-full break-words">
            <Thread
              messages={messages}
              isGenerating={isGenerating}
              isLoading={isLoadingMessages}
              error={error}
              onSubmit={handleSendMessage}
              onMessageRegenerate={regenerateMessage}
              onClearChat={clearChat}
              onClose={onClose}
              onNewChat={handleNewChat}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSessionSelect={selectSession}
              isLoadingSessions={isLoadingSessions}
              onRetry={retryLoad}
              onKnowledgeItemSelect={handleKnowledgeItemSelect}
              onMessageCopy={(message) => {
                if (typeof message.content === 'string') {
                  navigator.clipboard.writeText(message.content);
                }
              }}
              onMessageDelete={(message) => {
                const sessionId = message.metadata?.sessionId;
                if (message.metadata?.isSessionDelete && typeof sessionId === 'string') {
                  deleteSession(sessionId);
                }
              }}
              uiConfig={{
                showMetadata: true,
                showAvatars: true,
                showReactions: true,
                messageAlignment: 'left',
                messageSpacing: 'comfortable',
                enableFileAttachments: true,
                accentColor: 'purple'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Knowledge Base Sidebar */}
      <div
        className={`absolute right-0 top-0 h-full flex-none border-l border-gray-200 dark:border-gray-800 bg-background transition-all duration-300`}
        style={{ width: isKnowledgeBaseVisible ? '350px' : '0' }}
      >
        <KnowledgeSidebar
          onItemSelect={handleKnowledgeItemSelect}
        />
      </div>
    </div>
  );
};