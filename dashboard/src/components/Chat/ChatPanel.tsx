import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatSettings, type ChatUIConfig, type ChatMessage } from './types';
import { Thread } from './components/Thread';
import { useChat } from './providers/ChatProvider';
// Remove unused import
// import { useRag } from '../../hooks/useRag';
import { KnowledgeSidebar } from '../knowledge/KnowledgeSidebar';
import { useKnowledge } from '../../providers/KnowledgeProvider';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { MessageSquareIcon, ArrowRightIcon, Building2 } from 'lucide-react';
import { recoverFromBlankChatScreen } from '../../services/chat-recovery';

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
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isTitleUpdated, setIsTitleUpdated] = useState(false);
  
  // Track chat titles locally since we don't have direct API access
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({});

  // Error handling and recovery
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  
  // Debug logs for sessions and active session ID
  useEffect(() => {
    console.log('ChatPanel - Available Sessions:', sessions);
    console.log('ChatPanel - Active Session ID:', activeSessionId);
    console.log('ChatPanel - Messages Count:', messages?.length || 0);
    console.log('ChatPanel - Loading States:', {
      isLoadingSessions,
      isLoadingMessages: isGenerating
    });
  }, [sessions, activeSessionId, messages, isLoadingSessions, isGenerating]);

  // Reset state when switching between chats
  useEffect(() => {
    if (activeSessionId) {
      console.log('Active session changed to:', activeSessionId);
      
      // Reset title updated flag
      setIsTitleUpdated(false);
      
      // Reset error state
      setError(null);
      
      // Reset local state
      setHasMoreMessages(false);
    }
  }, [activeSessionId]);

  // Force session reload if sessions are empty
  useEffect(() => {
    if (!isLoadingSessions && (!sessions || sessions.length === 0)) {
      console.log('No sessions available. Attempting to reload...');
      // Try to reload sessions if we have a retry function
      if (retryLoad) {
        retryLoad();
      }
    }
  }, [sessions, isLoadingSessions, retryLoad]);

  // Update session title function
  const updateSessionTitle = (
    sessionId: string, 
    title: string, 
    lastMessage?: string, 
    messageCount?: number
  ) => {
    // Update local state to track titles
    setChatTitles(prev => ({
      ...prev,
      [sessionId]: title
    }));
    
    console.log(`Updating title for session ${sessionId} to "${title}"`);
    
    // Call the API to update the title
    if (sessionId && title && currentOrganization?.id) {
      try {
        // Create context object
        const context = {
          organization_id: currentOrganization.id,
          dashboard_id: currentDashboard?.id
        };
        
        console.log(`Sending update for session ${sessionId} with context:`, context);
        
        apiService.updateChatSession(
          sessionId, 
          title, 
          lastMessage, 
          messageCount, 
          context
        )
          .then((updatedSession) => {
            console.log(`Successfully updated session ${sessionId}:`, updatedSession);
            
            // Show success notification
            if (window.notificationContext) {
              window.notificationContext.showNotification({
                type: 'success',
                message: 'Chat title has been updated'
              });
            }
            
            // Update the session in the sessions list
            if (sessions) {
              const updatedSessions = sessions.map(session => 
                session.id === sessionId ? { 
                  ...session, 
                  title,
                  last_message: lastMessage !== undefined ? lastMessage : session.last_message,
                  message_count: messageCount !== undefined ? messageCount : session.message_count
                } : session
              );
              console.log(`Updating sessions list with updated session ${sessionId}`);
              _emergency.setSessions(updatedSessions);
            }
          }).catch(error => {
            console.error(`Error updating chat title for session ${sessionId}:`, error);
            if (window.notificationContext) {
              window.notificationContext.showNotification({
                type: 'error',
                message: 'Failed to update chat title'
              });
            }
          });
      } catch (error) {
        console.error(`Error in updateSessionTitle for session ${sessionId}:`, error);
      }
    } else {
      console.error('Missing required parameters for updateSessionTitle:', {
        sessionId,
        title,
        organizationId: currentOrganization?.id
      });
    }
  };

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

  // Update the code in the useEffect that handles case with no sessions
  useEffect(() => {
    // If we have sessions but no active session, select the first one
    if (sessions && sessions.length > 0 && !activeSessionId) {
      console.log('No active session but we have sessions, selecting the first one');
      selectSession(sessions[0].id).catch(err => {
        console.error('Failed to select first session:', err);
      });
    }
    
    // Only create a new session if we have no sessions at all
    if (sessions.length === 0) {
      createNewSessionImmediately(true, true).catch(err => {
        console.error('Failed to create session:', err);
      });
    }
  }, [sessions, activeSessionId, createNewSessionImmediately, selectSession]);

  // Handle new chat button click - simplified
  const handleNewChat = () => {
    try {
      // Use createNewSessionImmediately instead of createSession
      createNewSessionImmediately(true, true)
        .then(() => {
          console.log('Created new chat session successfully');
          // Clear any error messages
          setError(null);
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

  const handleSendMessage = async (message: string) => {
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
      
      if (!activeSource) {
        setError('Please select a data source from the Knowledge Base sidebar');
        return;
      }

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
      const enhancedMetadata = {
        dataSourceId: activeSource.id,
        dataSourceName: activeSource.name,
        dataSourceType: dataSourceType,
        collectionName: collectionName,
        collectionId: activeSource.id,
        useEnhancedVisualization: true,
        streamResponse: true // Enable streaming response mode
      };
      
      console.log('Data source type:', dataSourceType || 'unknown');
      
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

        // Set up a simple manual streaming effect
        // This is a temporary solution until the backend supports real streaming
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
      }, 300);

      // Call the standard sendMessage function from the provider
        await sendMessage(message);
        
      } catch (error) {
      console.error('Error sending message:', error);
      setError(`Error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Reset the isTitleUpdated flag when switching to a new chat
  useEffect(() => {
    if (activeSessionId && (!messages || messages.length === 0)) {
      setIsTitleUpdated(false);
    }
  }, [activeSessionId, messages]);

  // Add handle load more messages function
  const handleLoadMoreMessages = async () => {
    if (!activeSessionId) return;
    
    try {
      const session = sessions.find(s => s.id === activeSessionId);
      const context = {
        organization_id: session?.organization_id,
        dashboard_id: session?.dashboard_id
      };
      
      // Use the existing apiService instance
      const fullHistory = await apiService.getChatHistoryComplete(activeSessionId, context);
      
      // Update messages in Chat context if we got more
      if (fullHistory.length > messages.length) {
        _emergency.setMessages(fullHistory);
        console.log(`Loaded ${fullHistory.length} messages (added ${fullHistory.length - messages.length} more)`);
        
        // Hide the load more button if we've loaded all messages
        if (fullHistory.length >= (session?.message_count || 0)) {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      setError('Failed to load more messages');
    }
  };

  // Check if we should show the load more button when messages change
  useEffect(() => {
    if (activeSessionId && sessions.length > 0 && messages.length > 0) {
      const currentSession = sessions.find(s => s.id === activeSessionId);
      if (currentSession && currentSession.message_count) {
        // Show load more button if we have fewer messages than the session's message count
        const shouldShowLoadMore = messages.length < currentSession.message_count;
        setHasMoreMessages(shouldShowLoadMore);
        
        if (shouldShowLoadMore) {
          console.log(`Showing load more button: ${messages.length} of ${currentSession.message_count} messages loaded`);
        }
      }
    }
  }, [activeSessionId, sessions, messages]);

  // Check if we should show the welcome screen
  const showWelcomeScreen = useMemo(() => {
    // Always show welcome screen if there are no messages and we're not loading sessions
    if (!isLoadingSessions && (!messages || messages.length === 0)) {
      return true;
    }
    
    // Check if we're preserving the welcome screen during data source switching
    const preserveWelcomeScreen = localStorage.getItem('preserve_welcome_screen') === 'true';
    if (preserveWelcomeScreen) {
      console.log('Preserving welcome screen during data source switch');
      return true;
    }
    
    return false;
  }, [isLoadingSessions, messages]);

  // Ensure the sessions data is properly processed
  const processedSessions = useMemo(() => {
    if (!sessions) return [];
    
    return sessions.map(session => {
      // Override session titles with our locally tracked ones
      if (chatTitles[session.id]) {
        return { ...session, title: chatTitles[session.id] };
      }
      
      // If this is a new chat with no title, try to generate one from the first message
      // BUT only if there are actual messages in the chat
      if (session.id === activeSessionId && 
          (!session.title || session.title === 'New Chat' || session.title.startsWith('Chat ')) && 
          messages && messages.length > 0 && 
          messages.some(msg => msg.role === 'user') && // Only if there's at least one user message
          !isTitleUpdated) {
        
        // Find the first user message
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        
        if (firstUserMessage && typeof firstUserMessage.content === 'string') {
          // Generate a title from the first user message
          const generatedTitle = generateTitleFromMessage(firstUserMessage.content);
          
          // Only update if we have a meaningful title
          if (generatedTitle && generatedTitle.length > 3) {
            console.log(`Generating title "${generatedTitle}" from first message`);
            
            // Update the title via API
            updateSessionTitle(session.id, generatedTitle);
            setIsTitleUpdated(true);
            return { ...session, title: generatedTitle };
          }
        }
      }
      
      return session;
    });
  }, [sessions, activeSessionId, chatTitles, messages, isTitleUpdated]);

  useEffect(() => {
    // Add event listener for handling follow-up questions
    const handleFollowUpQuestion = (event: CustomEvent) => {
      if (event.detail && event.detail.message) {
        handleSendMessage(event.detail.message);
      }
    };
    
    // Add listener for the custom event
    document.addEventListener('send-message', handleFollowUpQuestion as EventListener);
    
    // Add listener for visualization enhancement
    const handleEnhanceVisualization = (event: CustomEvent) => {
      if (!event.detail || !event.detail.messageId || !event.detail.visualization) return;
      
      // Find the message to enhance
      const messageIndex = messages.findIndex(m => m.id === event.detail.messageId);
      if (messageIndex === -1) return;
      
      // Clone messages and update the one that needs enhancement
      const updatedMessages = [...messages];
      const message = { ...updatedMessages[messageIndex] };
      
      // Add or update visualization metadata
      message.metadata = message.metadata || {};
      
      // Get document type from metadata or detect it
      const dataSourceType = message.metadata.dataSourceType || 
                            message.metadata.content_type || 
                            (message.metadata.filename && message.metadata.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 
                            (message.metadata.filename && message.metadata.filename.toLowerCase().endsWith('.csv') ? 'csv' : 
                            (message.metadata.filename && message.metadata.filename.toLowerCase().endsWith('.xlsx') ? 'excel' : 
                            (message.metadata.collectionName ? 'qdrant' : 'unknown'))));
                            
      // Create the visualization data
      const visualizationData = {
        type: event.detail.visualization.type || 'bar',
        data: event.detail.visualization.data || [],
        xKey: event.detail.visualization.xKey,
        yKey: event.detail.visualization.yKey,
        series: event.detail.visualization.series,
        title: event.detail.visualization.title,
        xAxisLabel: event.detail.visualization.xAxisLabel,
        yAxisLabel: event.detail.visualization.yAxisLabel,
        preserveType: true  // Add explicit flag to preserve the visualization type
      };
      
      // Update message metadata for better visualization
      message.metadata.visualization = event.detail.visualization;
      message.metadata.visualizationData = visualizationData;
      message.metadata.dataSourceType = dataSourceType;
      message.metadata.hasVisualization = true;
      message.metadata.useEnhancedVisualization = true;
      
      // Store the original requested visualization type to ensure it's respected
      if (event.detail.visualization.type) {
        message.metadata.requestedVisualizationType = event.detail.visualization.type;
        
        // Log the requested visualization type for debugging
        console.log(`[DEBUG] Setting requested visualization type: ${event.detail.visualization.type}`);
      }
      
      // Update the message
      updatedMessages[messageIndex] = message;
      
      // Update messages state using the emergency method
      if (_emergency && _emergency.setMessages) {
        _emergency.setMessages(updatedMessages);
      }
    };
    
    // Add listener for the visualization enhancement event
    document.addEventListener('enhance-visualization', handleEnhanceVisualization as EventListener);
    
    // Clean up the event listeners when component unmounts
    return () => {
      document.removeEventListener('send-message', handleFollowUpQuestion as EventListener);
      document.removeEventListener('enhance-visualization', handleEnhanceVisualization as EventListener);
    };
  }, [messages, handleSendMessage, _emergency]);

  // Check for blank screen issue on component mount
  useEffect(() => {
    // Only try recovery once
    if (!recoveryAttempted) {
      setRecoveryAttempted(true);
      
      // Skip recovery if we're changing data sources
      const changingDataSource = localStorage.getItem('changing_data_source') === 'true';
      if (changingDataSource) {
        console.log('Data source change in progress, skipping blank chat detection');
        return;
      }
      
      // Check if this is happening shortly after a data source change
      const lastDataSourceChange = localStorage.getItem('last_data_source_change');
      if (lastDataSourceChange) {
        const changeTime = parseInt(lastDataSourceChange, 10);
        const timeSinceChange = Date.now() - changeTime;
        
        // If a data source was changed in the last 3 seconds, ignore recovery
        if (timeSinceChange < 3000) {
          console.log('Data source was recently changed, skipping blank chat detection');
          return;
        }
      }
      
      // If there are no messages displayed but we should have some, try recovery
      const needsRecovery = messages.length > 0 && 
        document.querySelectorAll('.chat-message').length === 0;
        
      if (needsRecovery) {
        console.warn('Detected possible blank chat screen, attempting recovery...');
        
        // Try to recover using our recovery service
        const recovered = recoverFromBlankChatScreen();
        if (!recovered) {
          // If automatic recovery failed, try emergency reset of chat state
          console.warn('Automatic recovery failed, trying emergency reset...');
          
          // Mark this as a non-reload recovery to prevent page refresh
          localStorage.setItem('non_reload_recovery', 'true');
          
          // Use emergency message setter as a last resort
          _emergency.setMessages([...messages]);
        }
      }
    }
  }, [messages, recoveryAttempted, _emergency]);

  // Simplified check for stuck messages
  useEffect(() => {
    if (messages.length > 0) {
      // Handle stuck loading messages after a reasonable timeout
      const stuckMessagesTimer = setTimeout(() => {
        // Look for messages that have been in loading state too long
        const stuckMessages = messages.filter(msg =>
          msg.status === 'loading' && 
          Date.now() - (msg.timestamp || 0) > 15000 // 15 seconds is enough time for response
        );
        
        if (stuckMessages.length > 0) {
          console.log('Found stuck loading messages, transitioning to complete state');
          
          // Update stuck messages to complete state
          const updatedMessages = messages.map(msg => {
            if (stuckMessages.some(stuck => stuck.id === msg.id)) {
              return {
                ...msg,
                status: 'complete' as const,
                // Update content if it's just "Thinking..."
                content: msg.content === 'Thinking...' ? 
                  'The system processed your request. Please see the information below.' : 
                  msg.content
              };
            }
            return msg;
          });
          
          // Update messages with fixed status
          _emergency.setMessages(updatedMessages);
        }
      }, 15000); // Check after 15 seconds
      
      return () => clearTimeout(stuckMessagesTimer);
    }
  }, [messages, _emergency]);

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
            sessions={processedSessions}
            onSessionSelect={selectSession}
            isLoadingSessions={isLoadingSessions}
            onRetry={retryLoad}
            onNewChat={handleNewChat}
            onKnowledgeItemSelect={handleKnowledgeItemSelect}
            isKnowledgeBaseVisible={isKnowledgeBaseVisible}
            onKnowledgeBaseToggle={toggleKnowledgeBase}
            onLoadMoreMessages={handleLoadMoreMessages}
            hasMoreMessages={hasMoreMessages}
            showWelcomeScreen={showWelcomeScreen}
            welcomeScreenRenderer={() => (
              <WelcomeScreen onSendMessage={handleSendMessage} />
            )}
            onDeleteSession={deleteSession}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
};