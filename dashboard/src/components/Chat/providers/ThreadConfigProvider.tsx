import React, { createContext, useContext } from 'react';
import { assistantConfig } from '../config/assistant';

// Create a context for the thread configuration
const ThreadConfigContext = createContext(assistantConfig);

// Hook to use the thread configuration
export const useThreadConfig = () => useContext(ThreadConfigContext);

interface ThreadConfigProviderProps {
  children: React.ReactNode;
}

export const ThreadConfigProvider: React.FC<ThreadConfigProviderProps> = ({ children }) => {
  return (
    <ThreadConfigContext.Provider value={assistantConfig}>
      {children}
    </ThreadConfigContext.Provider>
  );
}; 