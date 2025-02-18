import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatSettings, type ChatUIConfig } from './types';
import { Thread } from './components/Thread';
import { ChatProvider, useChat } from './providers/ChatProvider';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: Partial<ChatSettings>;
  uiConfig?: Partial<ChatUIConfig>;
}

const defaultSettings: ChatSettings = {
  model: 'gpt-4o',
  temperature: 0.7,
  streaming: true,
  contextLength: 4096,
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
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
            <ChatPanelContent onClose={onClose} />
          </ChatProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ChatPanelContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    messages,
    isGenerating,
    isLoadingSessions,
    isLoadingMessages,
    error,
    sendMessage,
    regenerateMessage,
    clearChat,
    settings,
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    retryLoad
  } = useChat();

  // Ensure all required fields are present with fallbacks
  const currentSettings: Partial<ChatSettings> = {
    model: settings.model || defaultSettings.model,
    temperature: settings.temperature ?? defaultSettings.temperature,
    streaming: settings.streaming ?? defaultSettings.streaming,
    systemPrompt: settings.systemPrompt || '',
  };

  const handleNewChat = () => {
    createSession('New Chat');
  };

  return (
    <Thread
      messages={messages}
      isGenerating={isGenerating}
      isLoading={isLoadingMessages}
      error={error}
      onSubmit={sendMessage}
      onMessageRegenerate={regenerateMessage}
      onClearChat={clearChat}
      onClose={onClose}
      onSettingsClick={() => {/* TODO: Implement settings */}}
      onMessageCopy={(message) => {
        navigator.clipboard.writeText(message.content);
      }}
      settings={currentSettings as ChatSettings}
      uiConfig={{
        showMetadata: true,
        showAvatars: true,
        showReactions: true,
        messageAlignment: 'left',
        messageSpacing: 'comfortable',
        enableFileAttachments: true,
        accentColor: 'purple'
      }}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSessionSelect={selectSession}
      isLoadingSessions={isLoadingSessions}
      onRetry={retryLoad}
      onNewChat={handleNewChat}
    />
  );
};