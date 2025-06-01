import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatSettings, type ChatUIConfig, type ChatMessage } from './types';
import { Thread } from './components/Thread';
import { useChat } from './providers/ChatProvider';
import { KnowledgeSidebar } from '../knowledge/KnowledgeSidebar';
import { useKnowledge } from '../../providers/KnowledgeProvider';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { MessageSquareIcon, ArrowRightIcon, Building2, Trash2Icon } from 'lucide-react';
import { Composer } from './components/Composer';
import { emergencyStorageCleanup } from '../../services/chat-recovery';
import { Button } from '@/components/ui/button';

// Redesigned WelcomeScreen component to be more responsive and compact
const WelcomeScreen: React.FC<{
  onSendMessage: (message: string) => void;
}> = ({ onSendMessage }) => {
  // Example prompts that users can click on
  const examplePrompts = [
    "Analyze our quarterly sales data and show me the trends",
    "Summarize the key points from our annual report",
    "Create a visualization of our customer demographics"
  ];

  // Feature categories with icons and descriptions
  const features = [
    {
      icon: "📊",
      title: "Data Analysis",
      items: ["Analyze datasets", "Find patterns", "Generate reports"]
    },
    {
      icon: "🔍",
      title: "Knowledge Base",
      items: ["Search documents", "Extract information", "Answer questions"]
    },
    {
      icon: "💡",
      title: "Creative Assistance",
      items: ["Generate ideas", "Brainstorm solutions", "Draft content"]
    }
  ];

  return (
    <div className="flex flex-col justify-center items-center h-full overflow-auto bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl w-full mx-auto px-6 flex flex-col justify-center items-center py-8">
        {/* Centered welcome header with improved styling */}
        <div className="text-center mb-8">
          <div className="mb-5 bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-2xl shadow-lg inline-flex transform hover:scale-105 transition-all duration-300 hover:shadow-purple-300/20 dark:hover:shadow-purple-500/20">
            <MessageSquareIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 mb-3">
            Welcome to your AI Assistant!
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
            I'm here to help you analyze data, answer questions, and generate insights.
          </p>
        </div>

        {/* Features in a more compact grid layout */}
        <div className="w-full max-w-3xl mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-800/60 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-700/50 transform hover:-translate-y-1"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <ul className="text-left text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
                  {feature.items.map((item, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-purple-500 mr-1.5 text-lg">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Example prompts with enhanced styling and interactions */}
        <div className="w-full max-w-2xl">
          <h3 className="text-sm font-medium text-center text-gray-800 dark:text-gray-200 mb-3">
            Try asking me:
          </h3>
          <div className="space-y-2.5">
            {examplePrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => onSendMessage(prompt)}
                className="group w-full text-left p-3 bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl text-gray-700 dark:text-gray-200 transition-all duration-200 border border-gray-200 dark:border-gray-700/50 hover:border-purple-200 dark:hover:border-purple-700 text-sm shadow-sm hover:shadow-md"
                style={{ 
                  animationDelay: `${index * 150 + 300}ms`,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div className="flex items-center">
                  <span className="mr-2 text-purple-500 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                  <span>"{prompt}"</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to generate a title from a message
const generateTitleFromMessage = (message: string): string => {
  // Truncate the message to a reasonable length for a title
  const truncatedMessage = message.slice(0, 60).trim();
  
  // If the message is already short, use it as is
  if (truncatedMessage.length < 30) {
    return truncatedMessage;
  }
  
  // Otherwise, try to find a natural breakpoint (period, question mark, etc.)
  const naturalBreak = truncatedMessage.match(/[.!?]/);
  if (naturalBreak && naturalBreak.index && naturalBreak.index > 15) {
    return truncatedMessage.slice(0, naturalBreak.index + 1);
  }
  
  // If no natural breakpoint, find the last complete word
  const lastSpaceIndex = truncatedMessage.lastIndexOf(' ');
  if (lastSpaceIndex > 0) {
    return truncatedMessage.slice(0, lastSpaceIndex) + '...';
  }
  
  // Fallback to the truncated message with ellipsis
  return truncatedMessage + '...';
};

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: Partial<ChatSettings>;
  uiConfig?: Partial<ChatUIConfig>;
}

// Function to detect Excel files by extension or name
function isExcelDataSource(fileName: string): boolean {
  if (!fileName) return false;
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith('.xlsx') || 
         lowerName.endsWith('.xls') || 
         lowerName.endsWith('.csv') || 
         lowerName.includes('excel') ||
         lowerName.includes('spreadsheet');
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  isOpen, 
  onClose
}) => {
  // Use a state to track if we're on a mobile device
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Add responsive resize handler
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className={`fixed right-0 top-0 h-full ${isMobile ? 'w-full' : 'w-[820px]'} bg-background shadow-xl pointer-events-auto border-l border-gray-200 dark:border-gray-800`}
          style={{ 
            position: 'fixed',
            zIndex: 99999,
            isolation: 'isolate',
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden'
          }}
        >
          <div style={{ position: 'relative', zIndex: 99999, height: '100%' }}>
            <ChatPanelContent 
              onClose={onClose}
              isMobile={isMobile}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ChatPanelContentProps {
  onClose: () => void;
  isMobile?: boolean;
}

export const ChatPanelContent: React.FC<ChatPanelContentProps> = ({ 
  onClose,
  isMobile = false
}) => {
  const {
    messages,
    activeSessionId,
    isGenerating,
    sendMessage,
    selectSession,
    sessions,
    isLoadingSessions,
    deleteSession,
    retryLoad,
    createNewSessionImmediately,
    _emergency
  } = useChat();

  // Remove or comment out the unused queryDataSources
  // const { queryDataSources } = useRag();
  const { activeSource, setActiveSource } = useKnowledge();
  const { isAuthenticated, user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { currentDashboard } = useDashboard();
  const [isKnowledgeBaseVisible, setIsKnowledgeBaseVisible] = useState(true);
  const [localError, setError] = useState<string | null>(null);
  const [hasMoreMessages] = useState(false);
  const [isTitleUpdated, setIsTitleUpdated] = useState(false);
  const [isLoading] = useState(false);
  
  // Add state for processing mode preference
  const [processingPreference, setProcessingPreference] = useState<'auto' | 'rag' | 'code'>('auto');
  
  // Mock participants for mentions (can be replaced with real data)
  const participants = useMemo(() => [], []);
  
  // Add a ref to track if we've already tried to create a session
  const sessionCreationAttempted = React.useRef(false);
  
  // Function to handle processing preference change
  const handleProcessingPreferenceChange = (newPreference: 'auto' | 'rag' | 'code') => {
    setProcessingPreference(newPreference);
    
    // Show feedback to user
    if (window.notificationContext) {
      const modeLabels = {
        auto: 'Automatic (Smart Routing)',
        rag: 'Information Retrieval (RAG)',
        code: 'Code Execution & Analysis'
      };
      
      window.notificationContext.showNotification({
        type: 'info',
        message: `Processing mode set to: ${modeLabels[newPreference]}`
      });
    }
  };
  
  // Original handleSendMessage function with processing preference added
  const handleSendMessage = async (message: string, attachments?: File[]) => {
    try {
      // Update the chat title if this is the first user message in a new chat
      // and the title hasn't been updated yet
      if (
        activeSessionId && 
        messages && 
        // Only count user messages, not welcome or system messages
        messages.filter(m => m.role === 'user').length === 0 && 
        !isTitleUpdated
      ) {
        const generatedTitle = generateTitleFromMessage(message);
        
        // Only update if we have a proper title
        if (generatedTitle && generatedTitle.length > 0) {
          // Update with the title, last message, and message count
          updateSessionTitle(
            activeSessionId, 
            generatedTitle, 
            message, // Use the current message as the last message
            1 // Set message count to 1 for the first message
          );
          setIsTitleUpdated(true);
        }
      } else if (activeSessionId && sessions) {
        // For subsequent messages, update the session metadata
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession) {
          // Update just the last message and message count
          const newMessageCount = (currentSession.message_count || 0) + 1;
          
          // Create context object
          const context = {
            organization_id: currentOrganization?.id,
            dashboard_id: currentDashboard?.id
          };
          
          apiService.updateChatSession(
            activeSessionId,
            currentSession.title,
            message, // Use the current message as the last message
            newMessageCount,
            context
          ).then(() => {
            // Update the sessions list
            const updatedSessions = sessions.map(session => 
              session.id === activeSessionId ? { 
                ...session, 
                last_message: message,
                message_count: newMessageCount
              } : session
            );
            _emergency.setSessions(updatedSessions);
          }).catch(error => {
            console.error('Error updating session metadata:', error);
          });
        }
      }
      
      if (!message || message.trim() === '') {
        console.error('Cannot send empty message');
        return;
      }
      
      // Make data source selection optional - users can chat without selecting a specific data source
      // This allows for general conversation and app context discussions
      let dataSourceMetadata = {};
      
      if (activeSource) {
        // If a data source is selected, use it for enhanced RAG capabilities
        // Store the active source ID in localStorage for the API service to use
        localStorage.setItem('selectedDataSources', JSON.stringify([activeSource.id]));
        
        // Log collection info for debugging
        const collectionName = `datasource_${activeSource.id}`;
        console.log('Using data source:', activeSource.name, 'ID:', activeSource.id);
        console.log('Querying Qdrant collection:', collectionName);
        
        // Determine data source type from file name if not explicitly provided
        let dataSourceType = (activeSource as any).dataSourceType;
        
        // If we don't have a datasource type, try to detect it from the filename
        if (!dataSourceType && activeSource.name) {
          const fileName = activeSource.name.toLowerCase();
          // Use our enhanced Excel detection function
          if (isExcelDataSource(fileName)) {
            dataSourceType = 'excel';
            console.log('Detected Excel data source from filename:', fileName);
          } else if (fileName.endsWith('.pdf')) {
            dataSourceType = 'pdf';
          } else if (fileName.endsWith('.csv')) {
            dataSourceType = 'csv';
          } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            dataSourceType = 'docx';
          } else {
            // Default to qdrant collection if can't detect
            dataSourceType = 'qdrant';
          }
        }
        
        // Make sure we have a default data source type
        if (!dataSourceType) {
          dataSourceType = 'qdrant';
        }
        
        // Enhanced metadata for better visualization
        dataSourceMetadata = {
          dataSourceId: activeSource.id,
          dataSourceName: activeSource.name,
          dataSourceType: dataSourceType,
          collectionName: collectionName,
          collectionId: activeSource.id,
          useEnhancedVisualization: true,
          streamResponse: true, // Enable streaming response mode
        };
        
        console.log('Data source type:', dataSourceType || 'unknown');
      } else {
        // No data source selected - clear any previous selection and allow general chat
        localStorage.removeItem('selectedDataSources');
        console.log('No data source selected - using general chat mode');
        
        dataSourceMetadata = {
          useGeneralMode: true,
          streamResponse: true,
        };
      }

      // Enhanced metadata for processing
      const enhancedMetadata = {
        ...dataSourceMetadata,
        // Add processing preference options
        preferCodeExecution: processingPreference === 'code',
        preferRAG: processingPreference === 'rag',
        // Add attachments if provided
        attachments: attachments ? attachments.map(file => ({
          type: 'file' as const,
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size
        })) : []
      };
      
      // Create user message object for immediate display
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        status: 'complete',
        metadata: enhancedMetadata
      };
      
      // Generate unique ID for the assistant message
      const assistantMessageId = `assistant-${Date.now()}`;
      
      // Show typing indicator with enhanced thinking process
      const typingMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: 'Thinking...',
        timestamp: Date.now(),
        status: 'loading',
        metadata: {
          ...enhancedMetadata,
          isTyping: true,
          showThinking: true, // Enable thinking process visualization
          useStreamingResponse: true // Use new streamed response mode
        }
      };
      
      // Add the user message to the messages array
      const updatedMessages = [...messages, userMessage];
      _emergency.setMessages(updatedMessages);
      
      // Add the typing message after a short delay
      setTimeout(() => {
        const messagesWithTyping = [...updatedMessages, typingMessage];
        _emergency.setMessages(messagesWithTyping);

        // DISABLED: Fake streaming effect that was causing infinite loop
        // This was preventing the real API call from being made
        /*
        let streamedContent = '';
        let streamCounter = 0;
        const fullResponse = 'I\'m analyzing your data and preparing a response...';
        
        // Simulate streaming at character level
        const streamInterval = setInterval(() => {
          if (streamCounter < fullResponse.length) {
            streamedContent += fullResponse.charAt(streamCounter);
            streamCounter++;
            
            // Update the message with the current streamed content
            const updatedTypingMessage: ChatMessage = {
              ...typingMessage,
              content: streamedContent,
            metadata: {
                ...typingMessage.metadata,
                streamingContent: streamedContent,
                partialResponse: true,
                streamTimestamp: Date.now()
              }
            };
            
            // Find the typing message and update it
            const updatedStreamingMessages = messagesWithTyping.map(msg => 
              msg.id === assistantMessageId ? updatedTypingMessage : msg
            );
        
          // Update the messages state
            _emergency.setMessages(updatedStreamingMessages);
          } else {
            // Once streaming is done, clear the interval
            clearInterval(streamInterval);
        }
        }, 50); // Stream a character every 50ms for a natural effect
        */
      }, 300);

      // Call the standard sendMessage function from the provider with processing preference
      await sendMessage(message);
        
      } catch (error) {
       console.error('Error sending message:', error);
       setError(`Error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}`);
     }
   };
   
  // Function to handle canceling ongoing generation
  const handleCancelGeneration = useCallback(() => {
    if (isGenerating) {
      try {
        // Signal cancellation to stop the response stream
        // Use any type assertion to access the dynamically added abortController property
        const controller = (window as any).abortController;
        if (controller) {
          console.log('Canceling AI response generation...');
          controller.abort();
          (window as any).abortController = null;
        }
        
        // Add a system message indicating cancellation
        const systemMessage: ChatMessage = {
          id: `cancel-${Date.now()}`,
          role: 'system',
          content: 'Response generation was canceled.',
          timestamp: Date.now(),
          status: 'complete',
          metadata: { isSystemMessage: true }
        };
        
        // Update the messages
        _emergency.setMessages([...messages, systemMessage]);
      } catch (error) {
        console.error('Error canceling generation:', error);
      }
    }
  }, [isGenerating, messages, _emergency]);

  // Check if user is authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquareIcon className="h-5 w-5 text-violet-500" />
            Chat
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            aria-label="Close chat panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm">
            <div className="mb-6 bg-violet-100 dark:bg-violet-900/30 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <MessageSquareIcon className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">Authentication Required</h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Please log in to access the chat functionality. Authentication is required to view and create chat sessions.
            </p>
            <div className="flex flex-col space-y-4">
              <a href="/login" className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">
                Sign In
              </a>
              <button 
                onClick={onClose} 
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if an organization is selected
  if (!currentOrganization?.id) {
    return (
      <div className="flex flex-col h-full bg-background" style={{ position: 'relative', zIndex: 99999 }}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-background" style={{ position: 'relative', zIndex: 99999 }}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquareIcon className="h-5 w-5 text-violet-500" />
            Chat
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            aria-label="Close chat panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-gray-900" style={{ position: 'relative', zIndex: 99999 }}>
          <div className="text-center max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm">
            <div className="mb-6 bg-violet-100 dark:bg-violet-900/30 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <Building2 className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">Organization Required</h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Please select an organization to access the chat functionality. Chat sessions are associated with organizations.
            </p>
            <div className="flex flex-col space-y-4">
              <a href="/organizations" className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">
                Go to Organizations
              </a>
              <button 
                onClick={onClose} 
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close Chat Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fix handleNewChat to prevent re-renders and double creation
  const handleNewChat = () => {
    try {
      console.log('Manually creating new chat via button');
      // Set the creation flag to true to prevent other effects from creating sessions
      sessionCreationAttempted.current = true;
      
      // Use createNewSessionImmediately instead of createSession
      createNewSessionImmediately(true, false)
        .then((newSession) => {
          console.log('Created new chat session successfully', newSession);
          
          // Clear any error messages
          setError(null);
          
          if (newSession) {
            // Instead of reloading the page, explicitly set the active session
            // and reset the messages state to show the welcome message
            _emergency.setMessages([]);
            _emergency.setActiveSessionId(newSession.id);
            
            // Add the new session to the session list without causing re-renders
            if (newSession && sessions) {
              // Check if session already exists
              const sessionExists = sessions.some(s => s.id === newSession.id);
              if (!sessionExists) {
                // Create a new array with the new session added
                const updatedSessions = [newSession, ...sessions];
                _emergency.setSessions(updatedSessions);
              }
            }
            
            // Reset the title updated flag for the new session
            setIsTitleUpdated(false);
          }
        })
        .catch((error) => {
          console.error("Error creating new chat:", error);
          setError(`Failed to create new chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
    } catch (error) {
      console.error("Error creating new chat:", error);
      setError(`Failed to create new chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add back the critical useEffect for initial session creation
  useEffect(() => {
    // Create a new chat session when component mounts if needed, but only once
    const initializeChat = async () => {
      // Skip if we've already tried to create a session or if a session exists or if loading
      if (sessionCreationAttempted.current || activeSessionId || isLoadingSessions) {
        console.log('Skipping chat initialization: already attempted, session exists, or loading');
        return;
      }
      
      try {
        console.log('Initial chat session creation attempt');
        // Mark as attempted BEFORE the async operation to prevent race conditions
        sessionCreationAttempted.current = true;
        await createNewSessionImmediately(true, false);
      } catch (error) {
        console.error('Error initializing chat:', error);
        
        // Handle localStorage errors specially
        if (error instanceof DOMException && 
            (error.name === 'QuotaExceededError' || error.code === 22)) {
          // Try emergency cleanup
          console.warn('Storage full when initializing chat. Attempting cleanup...');
          try {
            emergencyStorageCleanup();
            
            // Show user-friendly error
            showStorageWarning();
          } catch (cleanupError) {
            console.error('Failed to clean up storage:', cleanupError);
          }
        }
      }
    };
    
    // Add a small delay to let other initialization happen first
    const timer = setTimeout(() => {
      initializeChat();
    }, 100);
    
    // Clean up timer on unmount
    return () => clearTimeout(timer);
  }, [activeSessionId, createNewSessionImmediately, isLoadingSessions]);

  // Add useEffect to handle existing sessions but no active session
  useEffect(() => {
    // Skip if loading sessions or no sessions
    if (isLoadingSessions || !sessions || sessions.length === 0) {
      return;
    }
    
    // If we have sessions but no active session, select the first one
    if (!activeSessionId) {
      console.log('No active session but we have sessions, selecting the first one');
      selectSession(sessions[0].id).catch(err => {
        console.error('Failed to select first session:', err);
      });
    }
  }, [sessions, activeSessionId, selectSession, isLoadingSessions]);

  // Handle knowledge item selection - now adapted for data sources
  const handleKnowledgeItemSelect = (dataSource: any) => {
    // If it's a data source with an id property, treat it as a data source
    if (dataSource && dataSource.id) {
      // Check if we're selecting the same data source
      if (activeSource?.id === dataSource.id) {
        console.log('Selected the same data source, skipping update');
        return;
      }
      
      console.log('Selected data source:', dataSource.name, 'ID:', dataSource.id);
      
      // Check if this is a new chat with no messages
      const isNewEmptyChat = !messages || messages.length === 0;
      
      // *** CRITICAL FLAG: Tell the app not to create a new session when changing data sources ***
      localStorage.setItem('changing_data_source', 'true');
      
      // Record timestamp before changing data source to help recovery mechanism
      localStorage.setItem('last_data_source_change', Date.now().toString());
      
      // Set the active source in the knowledge provider
      setActiveSource(dataSource);
      
      // Get file type for better display
      let fileType = 'data source';
      const sourceAny = dataSource as any;
      
      if (sourceAny.metadata && sourceAny.metadata.fileType) {
        fileType = sourceAny.metadata.fileType.toLowerCase();
      } else if (dataSource.name) {
        // For names like "file.docx_2025-03-05T08-31-45.417Z", extract the actual extension
        
        // First, check for common file extensions patterns in the name
        const extensionMatches = dataSource.name.match(/\.(csv|xlsx?|docx?|pdf|txt|json)/i);
        if (extensionMatches && extensionMatches[1]) {
          fileType = extensionMatches[1].toLowerCase();
        } else {
          // Fallback to original method
          const nameParts = dataSource.name.split('.');
          if (nameParts.length > 1) {
            fileType = nameParts[nameParts.length - 1].toLowerCase();
          }
        }
        
        // For Qdrant Collections with timestamp names like "file.csv_2025-03-05T09-40-28.773Z"
        const timestampMatch = dataSource.name.match(/\.(csv|xlsx?|docx?|pdf|txt|json)_\d{4}-\d{2}-\d{2}/i);
        if (timestampMatch && timestampMatch[1]) {
          fileType = timestampMatch[1].toLowerCase();
        }
      }
      
      // If we have messages, add a system message about the data source change
      if (!isNewEmptyChat) {
        // Get current messages
        const currentMessages = [...messages];
        
        // Create a system message about the data source change
        const sourceInfoMessage: ChatMessage = {
          id: `source-change-${Date.now()}`,
          role: 'system',
          content: `Switched to data source: ${dataSource.name} (${fileType})`,
          timestamp: Date.now(),
          status: 'complete',
          metadata: {
            isSystemMessage: true,
            dataSourceId: dataSource.id,
            dataSourceName: dataSource.name,
            dataSourceType: fileType
          }
        };
        
        // Add the system message to the current messages
        currentMessages.push(sourceInfoMessage);
        
        // Explicitly add the current session ID to help recovery mechanism
        if (activeSessionId && sourceInfoMessage.metadata) {
          sourceInfoMessage.metadata.sessionId = activeSessionId;
        }
        
        // Use _emergency.setMessages since that's available in this component's scope
        _emergency.setMessages(currentMessages);
      } else {
        // For new empty chats, we don't need to add a system message
        // but we need to ensure the welcome screen stays visible
        console.log('Switching data source in new empty chat, preserving welcome screen');
        
        // Set a flag to indicate we're preserving the welcome screen
        localStorage.setItem('preserve_welcome_screen', 'true');
        
        // If there are no messages, ensure we keep it that way to show welcome screen
        _emergency.setMessages([]);
      }
      
      // Clear the changing_data_source flag after a short delay
      setTimeout(() => {
        localStorage.removeItem('changing_data_source');
        localStorage.removeItem('preserve_welcome_screen');
      }, 2000);
    } 
    // If it's a knowledge item with content, treat it as before
    else if (dataSource && typeof dataSource.content === 'string') {
      sendMessage(dataSource.content);
    }
  };

  // Update the toggleKnowledgeBase function to use a single visibility state
  const toggleKnowledgeBase = () => {
    try {
      console.log('[ChatPanel] Toggling Knowledge Base, current state:', { isKnowledgeBaseVisible });
      
      // Use a single state variable for both mobile and desktop
      const newValue = !isKnowledgeBaseVisible;
      console.log(`[ChatPanel] Setting knowledge base visibility to: ${newValue}`);
      setIsKnowledgeBaseVisible(newValue);
    } catch (error) {
      console.error('[ChatPanel] Error toggling Knowledge Base:', error);
    }
  };

  // Handle data source changes
  useEffect(() => {
    // If we have an active source but no messages, ensure welcome screen is preserved
    if (activeSource && (!messages || messages.length === 0)) {
      console.log('Active source with no messages, preserving welcome screen');
      
      // Check if we're changing data sources
      const changingDataSource = localStorage.getItem('changing_data_source') === 'true';
      if (changingDataSource) {
        // Set the preserve welcome screen flag
        localStorage.setItem('preserve_welcome_screen', 'true');
        
        // Clear the flags after a short delay
        setTimeout(() => {
          localStorage.removeItem('changing_data_source');
          localStorage.removeItem('preserve_welcome_screen');
        }, 2000);
      }
    }
  }, [activeSource, messages]);

  // Add this function to handle session title updates
  const updateSessionTitle = async (
    sessionId: string,
    title: string,
    lastMessage: string,
    messageCount: number
  ) => {
    try {
      // Create context object for API call with correct types
      const context = {
        // Organization ID should be a number
        organization_id: localStorage.getItem('currentOrganizationId') ? 
          Number(localStorage.getItem('currentOrganizationId')) : undefined,
        // Dashboard ID should be a string
        dashboard_id: localStorage.getItem('currentDashboardId') || undefined
      };
      
      // Call the API service to update the session
      await apiService.updateChatSession(
        sessionId,
        title,
        lastMessage,
        messageCount,
        context
      );
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };

  // Show storage warning once per session
  const showStorageWarning = () => {
    // Set error state with a user-friendly message about storage limitations
    setError(
      "Your browser's storage is full. Old chat history has been cleared to make room for new conversations. " +
      "If this happens frequently, consider exporting important chats or clearing more history manually."
    );

    // Optionally show a more visible alert (you can customize this based on your UI components)
    alert(
      "Storage Limit Reached\n\n" +
      "Your browser's storage is full. Some old chat history has been automatically cleared.\n\n" +
      "To prevent this in the future:\n" +
      "- Clear more chat history manually\n" +
      "- Export important conversations\n" +
      "- Use fewer/smaller attachments in chats"
    );
  };

  // Add a new function to clear all chat history
  const handleClearAllChatHistory = useCallback(() => {
    if (window.confirm('This will delete ALL chat history from your browser. This cannot be undone. Continue?')) {
      try {
        // Get all localStorage keys
        const allKeys = Object.keys(localStorage);
        
        // Filter keys related to chat
        const chatKeys = allKeys.filter(key => 
          key.startsWith('chat_') || 
          key.includes('session')
        );
        
        // Delete each chat key
        chatKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        console.log(`Cleared ${chatKeys.length} chat items from localStorage`);
        
        // Show success message
        alert(`Successfully cleared ${chatKeys.length} chat items from your browser storage.`);
        
        // Reload the page to refresh everything
        window.location.reload();
      } catch (error) {
        console.error('Error clearing chat history:', error);
        alert('Failed to clear chat history: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex h-full overflow-hidden">
        {/* Conditionally show knowledge sidebar based on device type and visibility states */}
        {((!isMobile && isKnowledgeBaseVisible) || (isMobile && isKnowledgeBaseVisible)) && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={`${isMobile ? 'absolute inset-0 z-10' : 'w-80'} h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex-shrink-0`}
          >
            <div className={`${isMobile ? 'block' : 'hidden'} p-2 text-right`}>
              <button 
                onClick={toggleKnowledgeBase}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
            <KnowledgeSidebar 
              onItemSelect={(item) => {
                handleKnowledgeItemSelect(item);
              }} 
            />
          </motion.div>
        )}
        
        <div className="flex-1 overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <Thread
              messages={messages || []}
              onMessageRegenerate={() => {}}
              onMessageCopy={() => {}}
              onClose={onClose}
              onClearChat={() => {}}
              isGenerating={false}
              isLoading={isGenerating}
              error={localError}
              onSubmit={handleSendMessage}
              uiConfig={{
                showAvatars: true,
                showMetadata: true,
                showReactions: true,
                enableFileAttachments: true,
                messageSpacing: 'comfortable',
                theme: 'system',
                accentColor: 'purple',
                messageAlignment: 'left',
                enableMarkdownSupport: true,
                enableCodeHighlighting: true,
                isMobile: isMobile
              }}
              activeSessionId={activeSessionId}
              sessions={sessions}
              onSessionSelect={selectSession}
              isLoadingSessions={isLoadingSessions}
              onRetry={retryLoad}
              onNewChat={handleNewChat}
              onKnowledgeItemSelect={handleKnowledgeItemSelect}
              isKnowledgeBaseVisible={isKnowledgeBaseVisible}
              onKnowledgeBaseToggle={toggleKnowledgeBase}
              onLoadMoreMessages={() => {}}
              hasMoreMessages={hasMoreMessages}
              showWelcomeScreen={messages.length === 0}
              welcomeScreenRenderer={() => (
                <WelcomeScreen onSendMessage={handleSendMessage} />
              )}
              onDeleteSession={deleteSession}
            />
          </div>
        </div>
      </div>
      <div className="flex-none border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className={`${isMobile ? 'p-2' : 'p-4'}`}>
          {/* Add processing preference toggle */}
          <div className="flex items-center justify-center mb-2">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center text-xs font-medium">
              <button
                onClick={() => handleProcessingPreferenceChange('auto')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  processingPreference === 'auto'
                    ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => handleProcessingPreferenceChange('rag')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  processingPreference === 'rag'
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                RAG
              </button>
              <button
                onClick={() => handleProcessingPreferenceChange('code')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  processingPreference === 'code'
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Code
              </button>
            </div>
          </div>
          
          <Composer
            onSubmit={handleSendMessage}
            isGenerating={isGenerating}
            disabled={isGenerating || isLoading}
            placeholder="Type your message..."
            suggestions={messages[messages.length - 1]?.metadata?.suggestions}
            mentionableUsers={participants}
            className={`${isMobile ? 'min-h-[50px] max-h-[150px]' : 'min-h-[60px] max-h-[200px]'}`}
            isMobile={isMobile}
          />
          
          <div className="flex items-center justify-between mt-2">
            {isGenerating ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="animate-pulse">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
                <span>Generating response...</span>
                {<button
                  onClick={handleCancelGeneration}
                  className="text-sm text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  Cancel
                </button>}
              </div>
            ) : (
              <div></div>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearAllChatHistory} 
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              <Trash2Icon className="h-3 w-3 mr-1" />
              Clear Cache
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};