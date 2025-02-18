import React from 'react';
import { ThreadConfigProvider as AUIThreadConfigProvider } from '@assistant-ui/react-ui';
import { assistantConfig } from '../config/assistant';

interface ThreadConfigProviderProps {
  children: React.ReactNode;
}

export const ThreadConfigProvider: React.FC<ThreadConfigProviderProps> = ({ children }) => {
  return (
    <AUIThreadConfigProvider config={assistantConfig}>
      {children}
    </AUIThreadConfigProvider>
  );
}; 