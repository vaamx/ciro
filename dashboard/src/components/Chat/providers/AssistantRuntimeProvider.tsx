import React, { createContext, useContext, useCallback } from 'react';
import { type ChatMessage } from '../types';

interface AssistantRuntimeContextValue {
  messages: ChatMessage[];
  onMessageRegenerate: (message: ChatMessage) => void;
  onMessageCopy: (message: ChatMessage) => void;
  isGenerating: boolean;
  onSubmit: (message: string) => void;
}

const AssistantRuntimeContext = createContext<AssistantRuntimeContextValue | null>(null);

export const useAssistantRuntime = () => {
  const context = useContext(AssistantRuntimeContext);
  if (!context) {
    throw new Error('useAssistantRuntime must be used within an AssistantRuntimeProvider');
  }
  return context;
};

interface AssistantRuntimeProviderProps {
  children: React.ReactNode;
  messages: ChatMessage[];
  onMessageRegenerate: (message: ChatMessage) => void;
  onMessageCopy: (message: ChatMessage) => void;
  isGenerating: boolean;
  onSubmit: (message: string) => void;
}

export const AssistantRuntimeProvider: React.FC<AssistantRuntimeProviderProps> = ({
  children,
  messages,
  onMessageRegenerate,
  onMessageCopy,
  isGenerating,
  onSubmit,
}) => {
  const handleRegenerate = useCallback((message: ChatMessage) => {
    onMessageRegenerate(message);
  }, [onMessageRegenerate]);

  const handleCopy = useCallback((message: ChatMessage) => {
    onMessageCopy(message);
  }, [onMessageCopy]);

  const handleSubmit = useCallback((message: string) => {
    onSubmit(message);
  }, [onSubmit]);

  return (
    <AssistantRuntimeContext.Provider
      value={{
        messages,
        onMessageRegenerate: handleRegenerate,
        onMessageCopy: handleCopy,
        isGenerating,
        onSubmit: handleSubmit,
      }}
    >
      {children}
    </AssistantRuntimeContext.Provider>
  );
}; 