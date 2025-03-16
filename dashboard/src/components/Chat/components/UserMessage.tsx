import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatMessage } from '../types';
import { MessageMarkdown } from './MessageMarkdown';
import { formatTimestamp } from '../utils/formatTimestamp';
import { ClockIcon } from './icons';

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onReact?: (reaction: string) => void;
  onReply?: () => void;
  onPin?: () => void;
  onBookmark?: () => void;
  showAvatar?: boolean;
  showMetadata?: boolean;
  showReactions?: boolean;
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  accentColor?: string;
  isInGroup?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isMobile?: boolean;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  onEdit,
  onDelete,
  onReact,
  onReply,
  onPin,
  onBookmark,
  showAvatar = true,
  showMetadata = false,
  showReactions = false,
  messageAlignment = 'right',
  bubbleStyle = 'modern',
  accentColor = 'blue',
  isInGroup = false,
  isFirstInGroup = false,
  isLastInGroup = false,
  isMobile = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);

  const handleEditSubmit = () => {
    if (onEdit && editedContent !== message.content) {
      onEdit(editedContent);
    }
    setIsEditing(false);
  };

  // Define animation variants
  const messageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  // Get bubble style classes based on the bubbleStyle prop
  const getBubbleStyles = () => {
    switch (bubbleStyle) {
      case 'minimal':
        return `bg-transparent border-none px-1 py-1 shadow-none`;
      case 'classic':
        return `bg-${accentColor}-100 dark:bg-${accentColor}-900/30 rounded-lg px-3 py-2 shadow-sm border border-${accentColor}-200 dark:border-${accentColor}-800/40`;
      case 'modern':
      default:
        return `bg-${accentColor}-50 dark:bg-${accentColor}-900/20 rounded-xl px-4 py-3 shadow-sm border border-${accentColor}-100 dark:border-${accentColor}-800/60`;
    }
  };

  const renderAvatar = () => {
    if (!showAvatar || !isFirstInGroup) return null;
    
    return (
      <div className={`flex-shrink-0 ${messageAlignment === 'right' ? 'ml-3 order-2' : 'mr-3 order-1'}`}>
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-${accentColor}-500 to-${accentColor === 'blue' ? 'indigo' : accentColor}-600 flex items-center justify-center text-white shadow-md ring-2 ring-${accentColor}-100 dark:ring-${accentColor}-900/30`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    if (isEditing) {
      return (
        <div className={`bg-white dark:bg-gray-800 p-3 rounded-xl border border-${accentColor}-200 dark:border-${accentColor}-900/30 w-full`}>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className={`w-full p-2 bg-${accentColor}-50 dark:bg-${accentColor}-900/20 border border-${accentColor}-200 dark:border-${accentColor}-800/60 rounded-md focus:outline-none focus:ring-2 focus:ring-${accentColor}-500 dark:focus:ring-${accentColor}-600 resize-none ${isMobile ? 'text-base' : 'text-sm'}`}
            rows={Math.max(3, editedContent.split('\n').length)}
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={() => setIsEditing(false)}
              className={`px-3 py-1 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${isMobile ? 'text-base py-2 px-4' : ''}`}
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              className={`px-3 py-1 text-sm text-white bg-${accentColor}-600 dark:bg-${accentColor}-700 rounded-md hover:bg-${accentColor}-700 dark:hover:bg-${accentColor}-600 transition-colors ${isMobile ? 'text-base py-2 px-4' : ''}`}
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={getBubbleStyles()}>
        <div className={`prose ${isMobile ? 'prose-base' : 'prose-sm'} dark:prose-invert max-w-none prose-p:leading-relaxed`}>
          <MessageMarkdown content={message.content} />
        </div>
      </div>
    );
  };

  const renderReactions = () => {
    if (!showReactions) return null;
    
    const reactions = ['👍', '❤️', '😂', '😮', '👏'];
    
    return (
      <div className="flex items-center space-x-1 mt-1 justify-end">
        {reactions.map(reaction => (
          <button
            key={reaction}
            onClick={() => onReact && onReact(reaction)}
            className={`p-1 text-xs rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isMobile ? 'text-base p-1.5' : ''}`}
          >
            {reaction}
          </button>
        ))}
      </div>
    );
  };

  const renderMessageActions = () => {
    if (isEditing) return null;

    return (
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`absolute -top-3 ${messageAlignment === 'right' ? 'right-0' : 'left-0'} flex space-x-1`}
          >
            {onEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className={`p-1 rounded-md bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-${accentColor}-600 dark:hover:text-${accentColor}-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors ${isMobile ? 'p-1.5' : ''}`}
                aria-label="Edit message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}>
                  <path d="M16.862 4.487A1.5 1.5 0 0015 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9.5a.5.5 0 00-1 0V19a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h10.862z" />
                  <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0zm5 0a.5.5 0 00-1 0 2.5 2.5 0 01-5 0 .5.5 0 00-1 0z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className={`p-1 rounded-md bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors ${isMobile ? 'p-1.5' : ''}`}
                aria-label="Delete message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}>
                  <path d="M16 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9z" />
                </svg>
              </button>
            )}
            {onReply && (
              <button
                onClick={onReply}
                className={`p-1 rounded-md bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-${accentColor}-600 dark:hover:text-${accentColor}-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors ${isMobile ? 'p-1.5' : ''}`}
                aria-label="Reply to message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              </button>
            )}
            {onPin && (
              <button
                onClick={onPin}
                className={`p-1 rounded-md bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-${accentColor}-600 dark:hover:text-${accentColor}-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors ${isMobile ? 'p-1.5' : ''}`}
                aria-label="Pin message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
              </button>
            )}
            {onBookmark && (
              <button
                onClick={onBookmark}
                className={`p-1 rounded-md bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-${accentColor}-600 dark:hover:text-${accentColor}-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors ${isMobile ? 'p-1.5' : ''}`}
                aria-label="Bookmark message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderMessageMetadata = () => {
    if (!showMetadata) return null;

    return (
      <div className={`flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'} ${isMobile ? 'text-sm' : ''}`}>
        <ClockIcon className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} mr-1`} />
        <span>{formatTimestamp(message.timestamp || 0)}</span>
      </div>
    );
  };

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`group relative flex w-full max-w-full ${
        isFirstInGroup ? 'mt-6' : 'mt-1'
      } ${isLastInGroup ? 'mb-6' : 'mb-1'} ${
        isInGroup ? 'pl-4 border-l-2 border-gray-100 dark:border-gray-800' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex items-start w-full ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'}`}>
        {/* Avatar (right-aligned messages have avatar on the right) */}
        {messageAlignment === 'left' && renderAvatar()}
        
        {/* Message content */}
        <div className={`relative flex-1 ${isMobile ? 'max-w-[90%]' : 'max-w-[85%]'} ${messageAlignment === 'right' ? 'text-right' : 'text-left'} ${
          messageAlignment === 'right' ? 'mr-2' : 'ml-2'
        } ${!showAvatar || !isFirstInGroup ? (messageAlignment === 'right' ? 'mr-11' : 'ml-11') : ''}`}>
          {renderMessageContent()}
          {renderReactions()}
          {renderMessageMetadata()}
          {renderMessageActions()}
        </div>
        
        {/* Avatar (right-aligned messages have avatar on the right) */}
        {messageAlignment === 'right' && renderAvatar()}
      </div>
    </motion.div>
  );
}; 