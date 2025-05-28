import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageComponent, MessageGroupingUtils } from './MessageComponent';
import { Composer } from './Composer';
import { WelcomeScreen } from './WelcomeScreen';
import { ErrorBoundary } from './ErrorBoundary';
import type { ChatMessage, ChatUIConfig } from '../types';

export interface ThreadViewProps {
  messages: ChatMessage[];
  onMessageRegenerate?: (messageId: string) => void;
  onMessageCopy?: (messageId: string, content: string) => void;
  onMessageEdit?: (messageId: string, newContent: string) => void;
  onMessageDelete?: (messageId: string) => void;
  onMessageRestore?: (messageId: string) => void;
  isGenerating: boolean;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (message: string, attachments?: File[]) => void;
  uiConfig: ChatUIConfig & { streamSpeed?: number };
  showWelcomeScreen?: boolean;
  activeSessionId?: string | null;
  isMobile?: boolean;
  className?: string;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  messages,
  onMessageRegenerate,
  onMessageCopy,
  onMessageEdit,
  onMessageDelete,
  onMessageRestore,
  isGenerating,
  isLoading = false,
  error,
  onSubmit,
  uiConfig,
  showWelcomeScreen = false,
  activeSessionId,
  isMobile = false,
  className = ''
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or when generating
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Auto-scroll for new assistant messages or when generating
      if (lastMessage.role === 'assistant' || isGenerating) {
        scrollToBottom();
      }
    }
  }, [messages.length, isGenerating, scrollToBottom]);

  // Handle message submission
  const handleSubmit = useCallback((content: string, attachments?: File[]) => {
    onSubmit(content, attachments);
    // Scroll to bottom when user sends a message
    setTimeout(() => scrollToBottom('instant'), 100);
  }, [onSubmit, scrollToBottom]);

  // Calculate message grouping for better visual organization
  const messagesWithGrouping = MessageGroupingUtils.calculateGrouping(messages);

  // Optimize rendering for performance with large message lists
  const optimizedMessages = MessageGroupingUtils.optimizeForRendering(messagesWithGrouping, 100);

  // Render welcome screen when no messages
  if (showWelcomeScreen && messages.length === 0 && !isLoading) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 overflow-hidden">
          <WelcomeScreen onSendMessage={handleSubmit} />
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Composer 
            onSubmit={handleSubmit}
            isGenerating={isGenerating}
            disabled={isGenerating}
            placeholder="Ask me anything..."
            allowAttachments={uiConfig.enableFileAttachments}
            isMobile={isMobile}
          />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`flex flex-col h-full ${className}`}>
        {/* Messages Container */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50"
        >
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Messages List */}
            <AnimatePresence mode="popLayout">
              {optimizedMessages.map((messageWithGrouping, index) => {
                const { grouping, ...message } = messageWithGrouping as any;
                
                return (
                  <motion.div
                    key={message.id || `message-${index}`}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ 
                      layout: { type: 'spring', stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                      y: { duration: 0.2 }
                    }}
                    className={`
                      ${grouping?.isFirstInGroup ? 'mt-6' : 'mt-2'}
                      ${grouping?.isLastInGroup ? 'mb-6' : 'mb-2'}
                    `}
                  >
                    <MessageComponent
                      message={message}
                      onRegenerate={onMessageRegenerate}
                      onCopy={onMessageCopy}
                      onEdit={onMessageEdit}
                      onDelete={onMessageDelete}
                      onRestore={onMessageRestore}
                      isStreaming={isGenerating && index === optimizedMessages.length - 1}
                      uiConfig={uiConfig}
                      isMobile={isMobile}
                      isInGroup={grouping?.isInGroup}
                      isFirstInGroup={grouping?.isFirstInGroup}
                      isLastInGroup={grouping?.isLastInGroup}
                      previousMessage={grouping?.previousMessage}
                      nextMessage={grouping?.nextMessage}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Error State */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
              >
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                        Error generating response
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Composer */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <Composer 
            onSubmit={handleSubmit}
            isGenerating={isGenerating}
            disabled={isGenerating}
            placeholder={
              activeSessionId 
                ? "Continue the conversation..." 
                : "Start a new conversation..."
            }
            allowAttachments={uiConfig.enableFileAttachments}
            isMobile={isMobile}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}; 