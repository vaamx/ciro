import { useState, useEffect } from 'react';
import { RagService } from '../services/rag/RagService';

export function useApiKeyCheck() {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if API key is available in environment variables
    const checkApiKey = () => {
      const hasKey = !!import.meta.env.VITE_OPENAI_API_KEY || RagService.hasApiKey();
      setHasApiKey(hasKey);
      
      // If no API key is set, show the modal
      if (!hasKey) {
        console.warn('No OpenAI API key found in environment variables');
        setShowApiKeyModal(true);
      }
      
      setIsLoading(false);
    };
    
    checkApiKey();
    
    // Listen for API key errors
    const handleApiKeyError = (event: ErrorEvent) => {
      if (
        event.message.includes('OpenAI API key') || 
        event.message.includes('API key not configured')
      ) {
        setShowApiKeyModal(true);
        setHasApiKey(false);
      }
    };

    window.addEventListener('error', handleApiKeyError);
    
    return () => {
      window.removeEventListener('error', handleApiKeyError);
    };
  }, []);

  const handleApiKeySuccess = () => {
    setShowApiKeyModal(false);
    setHasApiKey(true);
  };

  return {
    showApiKeyModal,
    setShowApiKeyModal,
    hasApiKey,
    isLoading,
    handleApiKeySuccess
  };
} 