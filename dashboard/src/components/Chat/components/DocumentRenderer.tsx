import React from 'react';
import { MessageMarkdown } from './MessageMarkdown';

interface DocumentRendererProps {
  content: string;
  type: 'pdf' | 'docx' | 'text' | string;
  messageId: string;
}

/**
 * Document Renderer Component
 * 
 * Renders different document types (PDF, DOCX, etc.) with appropriate formatting
 */
export const DocumentRenderer: React.FC<DocumentRendererProps> = ({
  content,
  type,
  messageId
}) => {
  // Document icon based on type
  const getDocumentIcon = () => {
    switch (type) {
      case 'pdf':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'docx':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 2a1 1 0 011-1h6a1 1 0 010 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div
      className="w-full"
      data-message-id={messageId}
      data-content-type={type}
    >
      <div className="mb-2 flex items-center space-x-2">
        {getDocumentIcon()}
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {type.toUpperCase()} Document Content
        </span>
      </div>
      
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <MessageMarkdown content={content} />
      </div>
    </div>
  );
}; 