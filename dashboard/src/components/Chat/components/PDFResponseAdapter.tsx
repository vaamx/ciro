import React from 'react';
import { MessageMarkdown } from './MessageMarkdown';
import { ChatMessage } from '../types';
import { extractDocumentContent } from '../utils/documentTypeHandlers';

/**
 * Props for PDFResponseAdapter component
 */
interface PDFResponseAdapterProps {
  message: ChatMessage;
}

/**
 * Simplified adapter that directly renders PDF content without complex visualizations
 */
export const PDFResponseAdapter: React.FC<PDFResponseAdapterProps> = ({ message }) => {
  // Only log when the component initially renders
  React.useEffect(() => {
    console.log('PDFResponseAdapter rendering for ID:', message.id);
  }, [message.id]);
  
  // Extract content from the message
  const content = extractDocumentContent(message);
  
  return (
    <div className="pdf-response-container chat-message assistant-message" data-message-id={message.id}>
      <div className="pdf-content p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="pdf-header mb-2 pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-2">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">PDF Document Information</h3>
        </div>
        
        <div className="pdf-content-text">
          <MessageMarkdown content={content} />
        </div>
        
        {message.metadata?.filename && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Source: {message.metadata.filename}
          </div>
        )}
      </div>
    </div>
  );
};

// Export the component directly
export default PDFResponseAdapter; 