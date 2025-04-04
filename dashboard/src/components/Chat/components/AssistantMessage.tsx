import React, { useState, useRef, useEffect } from 'react';
import { type ChatMessage } from '../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { PDFResponseAdapter } from './PDFResponseAdapter';
import { MessageMarkdown } from './MessageMarkdown';
import { motion } from 'framer-motion';
import { copyToClipboard } from '../../../utils/clipboard';
import { 
  detectDocumentType, 
  DocumentType, 
  needsVisualization
} from '../utils/documentTypeHandlers';
import { TableVisualization } from './TableVisualization';
import { DocumentRenderer } from './DocumentRenderer';
import { VisualizationAdapter } from './VisualizationAdapter';
import { ThinkingProcess, ThinkingStep } from './ThinkingProcess';
// Removing unused imports
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import remarkMath from 'remark-math';
// import rehypeKatex from 'rehype-katex';
// Import from the correct location or remove if not used
// import { CodeBlock } from '../../Code/CodeBlock';

// Simple Avatar component
const Avatar = ({ size = 'md', name = '', src = '', className = '' }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  
  return (
    <div 
      className={`flex items-center justify-center rounded-full ${sizeClass} ${className}`}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="rounded-full w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

// We can simplify by removing unused imports/interfaces
interface AssistantMessageProps {
  message: ChatMessage;
  onCopy: () => void;
  onReload?: () => void;
  showMetadata?: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isRunning?: boolean;
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  accentColor?: string;
  isInGroup?: boolean;
  isMobile?: boolean;
}

// Add these at the file level, outside the component
const stripJsonCache = new Map<string, string>();

// Helper functions
const stripJsonFromContent = (content: string): string => {
  // Use cache to avoid repeating the same stripping operation
  if (stripJsonCache.has(content)) {
    return stripJsonCache.get(content)!;
  }

  try {
    // Check if the content is JSON format
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(content);
        // If it has a content property, return that
        if (parsed.content) {
          stripJsonCache.set(content, parsed.content);
          return parsed.content;
        }
      } catch (e) {
        // Not valid JSON, continue with original content
      }
    }
    
    // If it contains embedded JSON, try to extract main text
    if (content.includes('{') && content.includes('}')) {
      // Try to extract any text before JSON
      const beforeJson = content.split('{')[0].trim();
      if (beforeJson.length > 0) {
        stripJsonCache.set(content, beforeJson);
        return beforeJson;
      }
      
      // Try to extract any text after JSON
      const afterJson = content.split('}').pop()?.trim();
      if (afterJson && afterJson.length > 0) {
        stripJsonCache.set(content, afterJson);
        return afterJson;
      }
    }
    
    // Just return original content
    stripJsonCache.set(content, content);
    return content;
  } catch (error) {
    console.error('Error stripping JSON:', error);
    return content;
  }
};

// Cached refs to prevent redundant processing
interface ProcessedRef {
  pdf: boolean;
  qdrant: boolean;
  content: boolean;
  debug: boolean;
}

interface ExtractionRef {
  id: string | null;
  content: string | null;
  metadata: Record<string, any> | null;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ 
  message, 
  onCopy, 
  onReload, 
  showMetadata = false,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  isRunning = false,
  messageAlignment = 'left',
  bubbleStyle = 'modern',
  accentColor = 'violet',
  isInGroup = false,
  isMobile = false
}: AssistantMessageProps) => {
  const [isContentReady, setIsContentReady] = useState<boolean>(false);
  const { showNotification } = useNotification();
  const [streamingContent, setStreamingContent] = useState<string>('');
  
  // Get bubble style classes based on the bubbleStyle prop
  const getBubbleStyles = () => {
    switch (bubbleStyle) {
      case 'minimal':
        return `bg-transparent dark:bg-transparent border-none px-1 py-1 shadow-none`;
      case 'classic':
        return `bg-white dark:bg-gray-800 rounded-lg px-2 py-1.5 shadow-sm border border-gray-100 dark:border-gray-700`;
      case 'modern':
      default:
        return `bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden`;
    }
  };
  
  // Refs to track processing state
  const processedRef = useRef<ProcessedRef>({
    pdf: false,
    qdrant: false,
    content: false,
    debug: false
  });
  
  // Ref to track extracted content
  const extractionRef = useRef<ExtractionRef>({
    id: null,
    content: null,
    metadata: null
  });
  
  // Log message rendering
  useEffect(() => {
    console.log(`Rendering message: ${message.id} ${message.role} ${message.status}`);
  }, [message.id, message.role, message.status]);
  
  // Extract content from message - always call this hook, never conditionally
  useEffect(() => {
    if (!message || !message.content) return;
    
    console.log(`Extracting content from message: ${message.id}`);
    
    // Convert content to string if needed
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
    
    console.log(`Extracted content length: ${content.length}`);
    
    // Store extracted content in ref
    extractionRef.current = {
      id: message.id,
      content: content,
      metadata: message.metadata || null
    };
    
    // Mark content as processed
    processedRef.current.content = true;
    
    // Set content ready state after a short delay to ensure all processing is complete
    const timer = setTimeout(() => {
      setIsContentReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [message]);
  
  // Detect document type
  const docType = detectDocumentType(message);

  // Check if this is a simple welcome message
  const isSimpleWelcome = message.metadata?.isSimpleWelcome === true;
  
  // Check if this is a loading message
  const isSimpleLoading = message.metadata?.isSimpleLoading === true;
  const isLoading = message.status === 'loading' || message.metadata?.isLoading === true;
  const suppressVisualization = message.metadata?.suppressVisualization === true;
  const forceSimpleDisplay = message.metadata?.forceSimpleDisplay === true;
  const skipEnhancedVisualization = message.metadata?.skipEnhancedVisualization === true;
  
  // Determine if we should use simple display
  const useSimpleDisplay = isSimpleWelcome || isSimpleLoading || forceSimpleDisplay || 
                          suppressVisualization || skipEnhancedVisualization;

  // Only log rendering once per message - always call this hook, never conditionally
  useEffect(() => {
    if (!processedRef.current.debug) {
      console.log('Rendering message:', message.id, message.role, 
        isSimpleWelcome ? '(simple welcome)' : '',
        isSimpleLoading ? '(simple loading)' : '',
        isLoading ? '(loading)' : '',
        useSimpleDisplay ? '(simple display)' : '',
        message.status);
      processedRef.current.debug = true;
    }
  }, [message.id, message.role, isSimpleWelcome, isSimpleLoading, isLoading, useSimpleDisplay, message.status]);

  // Handle early return for content not ready - IMPORTANT: Do this after all hooks are called
  const shouldRenderContent = isContentReady || message.status !== 'complete';
  
  // Access the extracted content
  const extractedContent = extractionRef.current.content || (
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  );

  // Handle copy action
  const handleCopy = () => {
    if (message.content) {
      const content = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content, null, 2);
      
      const success = copyToClipboard(content);
      if (success) {
        showNotification({
          type: 'success',
          message: 'Message content copied to clipboard'
        });
        onCopy();
      } else {
        showNotification({
          type: 'error',
          message: 'Failed to copy content'
        });
      }
    }
  };

  // Process PDF response - specialized handler
  function processPdfResponse() {
    try {
      // Only log processing once per message
      if (!processedRef.current.pdf) {
        console.log('Processing PDF response for message:', message.id);
        processedRef.current.pdf = true;
      }
      
      // For loading state, show appropriate indicator
      if (message.status === 'loading') {
        return (
          <div className="flex items-center space-x-2 p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        );
      }
      
      // Render the PDF response
      return (
        <PDFResponseAdapter message={message} />
      );
    } catch (error) {
      console.error('Error rendering PDF response:', error);
      return (
        <div className="text-red-500 p-2 rounded bg-red-50 dark:bg-red-900/20">
          Error rendering PDF response
        </div>
      );
    }
  }

  // Function to process Qdrant responses - simplified to avoid dependencies on removed components
  function processQdrantResponse() {
    // Mark as processed to prevent repeated processing
    processedRef.current.qdrant = true;
    
    try {
      if (message.status === 'loading') {
        return (
          <div className="flex items-center space-x-2 p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        );
      }
    
      // Use VisualizationAdapter for Qdrant responses to get enhanced visualizations
      console.log('Processing Qdrant response with VisualizationAdapter');
      
      // Always return the content, even if there's an error later
      const safeContent = message.content ? (
        typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
      ) : "No content received from server.";
      
      // Ensure we're not showing "No analysis available" when we have content
      if (!safeContent || safeContent.trim() === '' || safeContent === "No analysis available") {
        // If no usable content, display a more helpful error
        return (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
            <p className="text-red-600 dark:text-red-400 text-sm">
              No analysis available. Please try a different query.
            </p>
            {renderDiagnosticsButton()}
          </div>
        );
      }
      
      // If we have content, render the visualization adapter
      return (
        <div className="rag-response-container">
          <VisualizationAdapter 
            message={message} 
            messageId={message.id}
          />
        </div>
      );
    } catch (error) {
      console.error('Error rendering Qdrant response:', error);
      
      // Fallback to simple markdown rendering on any error
      return (
        <>
          <MessageMarkdown content={stripJsonFromContent(message.content)} />
          {renderDiagnosticsButton()}
        </>
      );
    }
  }

  // Process tabular data (Excel/CSV)
  function processTabularData() {
    try {
      if (message.status === 'loading') {
        return (
          <div className="flex items-center space-x-2 p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        );
      }
      
      // If we need visualization, try the visualization adapter first
      if (needsVisualization(message)) {
        try {
          return (
            <VisualizationAdapter 
              message={message} 
              messageId={message.id}
            />
          );
        } catch (error) {
          console.error('Error rendering visualization adapter:', error);
          // Fall back to table visualization
          try {
            return (
              <TableVisualization 
                content={extractedContent} 
                message={message} 
                messageId={message.id}
              />
            );
          } catch (tableError) {
            console.error('Error rendering table visualization:', tableError);
            // Fall back to markdown rendering
            return <MessageMarkdown content={extractedContent} />;
          }
        }
      }
      
      // Default to markdown rendering
      return <MessageMarkdown content={extractedContent} />;
    } catch (error) {
      console.error('Error rendering tabular data:', error);
      return (
        <div className="text-red-500 p-2 rounded bg-red-50 dark:bg-red-900/20">
          Error rendering data
        </div>
      );
    }
  }

  // Process document responses based on file type
  function processDocumentResponse() {
    const { type } = docType;
    
    try {
      // For loading state, show appropriate indicator
      if (message.status === 'loading') {
        return (
          <div className="flex items-center space-x-2 p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        );
      }
      
      // For all document types, first check if we should use visualization adapter
      if (needsVisualization(message)) {
        return (
          <VisualizationAdapter 
            message={message} 
            messageId={message.id}
          />
        );
      }
      
      // Otherwise, use specific renderer based on document type
      switch (type) {
        case DocumentType.PDF:
          return <PDFResponseAdapter message={message} />;
        case DocumentType.EXCEL:
        case DocumentType.CSV:
          return <TableVisualization content={extractedContent} message={message} messageId={message.id} />;
        case DocumentType.DOCX:
          return <DocumentRenderer content={extractedContent} type="docx" messageId={message.id} />;
        case DocumentType.QDRANT:
          return <VisualizationAdapter message={message} messageId={message.id} />;
        default:
          return <MessageMarkdown content={extractedContent} />;
      }
    } catch (error) {
      console.error('Error processing document response:', error);
      return <MessageMarkdown content={extractedContent} />;
    }
  }

  // Check if this is a Qdrant response
  // const isQdrantResponse = 
  //   docType.type === DocumentType.QDRANT || 
  //   message.metadata?.dataSourceType === 'qdrant' ||
  //   message.metadata?.collectionName ||
  //   message.metadata?.isQdrantResponse;
  
  // Diagnostics button helper
  const renderDiagnosticsButton = () => {
    // Always return null to remove the diagnostics button
    return null;
    
    // Only show for Qdrant responses
    // if (!isQdrantResponse) return null;
    // 
    // return (
    //   <div className="mt-3 flex justify-start">
    //     <button
    //       onClick={() => {
    //         // Dispatch a custom event that Thread.tsx can listen for
    //         const event = new CustomEvent('run-rag-diagnostics', {
    //           detail: { messageId: message.id }
    //         });
    //         document.dispatchEvent(event);
    //       }}
    //       className={`px-3 py-1 text-xs font-medium text-${accentColor}-600 bg-${accentColor}-50 rounded-md hover:bg-${accentColor}-100 dark:bg-${accentColor}-900/30 dark:text-${accentColor}-400 dark:hover:bg-${accentColor}-800/40 focus:outline-none focus:ring-1 focus:ring-${accentColor}-500 ${isMobile ? 'text-sm px-4 py-2' : ''}`}
    //     >
    //       Run RAG Diagnostics
    //     </button>
    //   </div>
    // );
  };

  // Add steps for thinking process
  const thinkingSteps: ThinkingStep[] = [
    {
      id: 'understand',
      content: 'Understanding your question',
      type: 'analyze',
      completed: false
    },
    {
      id: 'retrieve',
      content: 'Retrieving relevant information',
      type: 'lookup',
      completed: false
    },
    {
      id: 'analyze',
      content: 'Analyzing data connections',
      type: 'reason',
      completed: false
    },
    {
      id: 'formulate',
      content: 'Formulating response',
      type: 'calculate',
      completed: false
    },
    {
      id: 'visualize',
      content: 'Preparing visualizations',
      type: 'insight',
      completed: false
    }
  ];

  // Simulate streaming effect for loaded messages
  useEffect(() => {
    if (message.status === 'complete' && message.content && typeof message.content === 'string') {
      // Immediately set streaming content for already loaded messages
      setStreamingContent(message.content);
    }
  }, [message.status, message.content]);

  // Handle the Message content rendering
  const renderMessageContent = () => {
    // For loading state, show thinking process
    if (isLoading) {
      return (
        <ThinkingProcess 
          isThinking={true}
          steps={thinkingSteps}
          displayStyle={isMobile ? 'minimal' : 'standard'}
          streamingContent={streamingContent}
        />
      );
    }

    // For special document types, use specialized renderers
    if (docType.type === DocumentType.PDF) {
      return processPdfResponse();
    } else if (docType.type === DocumentType.QDRANT) {
      return processQdrantResponse();
    } else if (docType.type === DocumentType.EXCEL || docType.type === DocumentType.CSV) {
      return processTabularData();
    } else if (docType.type === DocumentType.DOCX) {
      return processDocumentResponse();
    }

    // For simple text responses
    return (
      <MessageMarkdown content={stripJsonFromContent(extractedContent)} />
    );
  };

  // If content is not ready and message is complete, render a loading placeholder instead of null
  if (!shouldRenderContent) {
    return (
      <motion.div
        className={`
          relative group
          flex flex-col
          w-full
          text-sm md:text-base
          ${isFirstInGroup ? 'pt-2' : 'pt-1'}
          ${isLastInGroup ? 'pb-2' : 'pb-1'}
          ${isInGroup ? 'pl-4 border-l-2 border-gray-100 dark:border-gray-800' : ''}
        `}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className={`flex items-start space-x-2 sm:space-x-4 ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'}`}>
          {showAvatar && messageAlignment === 'left' && (
            <div className="flex-shrink-0 mt-1">
              <Avatar 
                size="sm" 
                name="AI" 
                src="/ai-avatar.svg"
                className={`bg-${accentColor}-500/10 text-${accentColor}-600 ring-2 ring-${accentColor}-500/20`}
              />
            </div>
          )}
          
          <div className={`flex-1 min-w-0 space-y-0.5 ${isMobile ? 'max-w-[90%]' : 'max-w-[85%]'}`}>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
          
          {showAvatar && messageAlignment === 'right' && (
            <div className="flex-shrink-0 mt-1">
              <Avatar 
                size="sm" 
                name="AI" 
                src="/ai-avatar.svg"
                className={`bg-${accentColor}-500/10 text-${accentColor}-600 ring-2 ring-${accentColor}-500/20`}
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Render the message
  return (
    <motion.div
      className={`
        relative group
        flex flex-col
        w-full
        text-sm md:text-base
        ${isFirstInGroup ? 'pt-1' : 'pt-0.5'}
        ${isLastInGroup ? 'pb-1' : 'pb-0.5'}
        ${isInGroup ? 'pl-2 border-l-2 border-gray-100 dark:border-gray-800' : ''}
      `}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      data-message-id={message.id}
      data-message-type="assistant"
      data-content-type={docType.type}
    >
      <div className={`flex items-start space-x-1.5 ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'}`}>
        {showAvatar && messageAlignment === 'left' && (
          <div className="flex-shrink-0 mt-1">
            <Avatar 
              size="sm" 
              name="AI" 
              src="/ai-avatar.svg"
              className={`bg-${accentColor}-500/10 text-${accentColor}-600 ring-2 ring-${accentColor}-500/20`}
            />
          </div>
        )}
        
        <div className={`flex-1 min-w-0 space-y-0.5 ${isMobile ? 'max-w-[95%]' : 'max-w-[95%]'}`}>
          <div className={`
            flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400
            ${!showAvatar ? 'pl-6' : ''}
            ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'}
            ${isMobile ? 'text-sm' : ''}
          `}>
            {showAvatar && (
              <span className="font-medium">AI Assistant</span>
            )}
            {message.timestamp && (
              <span className="opacity-70">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          
          <div className={`
            relative
            ${getBubbleStyles()}
            transform 
            transition-all duration-200
          `}>
            <div className="relative">
              {renderMessageContent()}
              
              {/* Add diagnostics button for Qdrant responses */}
              {renderDiagnosticsButton()}
            </div>
            
            {/* Message Actions */}
            <div className={`
              absolute 
              top-1.5 right-1.5
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200
              flex items-center space-x-1
              z-10
            `}>
              <button
                onClick={handleCopy}
                className={`
                  p-1 rounded-full 
                  text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
                  bg-white/80 dark:bg-gray-800/80 
                  hover:bg-white dark:hover:bg-gray-800
                  shadow-sm
                  transition-all duration-150
                  ${isMobile ? 'p-1.5' : 'p-0.5'}
                `}
                aria-label="Copy content"
                title="Copy content"
              >
                <svg className={`${isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              
              {onReload && (
                <button
                  onClick={onReload}
                  className={`
                    p-1 rounded-full 
                    text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
                    bg-white/80 dark:bg-gray-800/80 
                    hover:bg-white dark:hover:bg-gray-800
                    shadow-sm
                    transition-all duration-150
                    ${isMobile ? 'p-1.5' : 'p-0.5'}
                  `}
                  aria-label="Regenerate response"
                  title="Regenerate response"
                  disabled={isRunning}
                >
                  <svg className={`${isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Metadata display */}
          {showMetadata && message.metadata && (
            <motion.div 
              className={`text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1 ${messageAlignment === 'right' ? 'text-right' : 'text-left'} ${isMobile ? 'text-sm' : ''}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              {/* Removing model information display as requested */}
              {/* {message.metadata.model && (
                <div>Model: {message.metadata.model}</div>
              )}
              {message.metadata.tokens && (
                <div>Tokens: {message.metadata.tokens}</div>
              )}
              {message.metadata.time && (
                <div>Time: {message.metadata.time.toFixed(2)}s</div>
              )}
              {docType.type !== DocumentType.UNKNOWN && (
                <div>Type: {docType.type}</div>
              )} */}
            </motion.div>
          )}
        </div>
        
        {showAvatar && messageAlignment === 'right' && (
          <div className="flex-shrink-0 mt-1">
            <Avatar 
              size="sm" 
              name="AI" 
              src="/ai-avatar.svg"
              className={`bg-${accentColor}-500/10 text-${accentColor}-600 ring-2 ring-${accentColor}-500/20`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};