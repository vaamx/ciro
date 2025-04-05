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
        return `bg-${accentColor}-100 dark:bg-${accentColor}-900/30 rounded-lg px-2 py-2 shadow-sm border border-${accentColor}-200 dark:border-${accentColor}-800/40`;
      case 'modern':
      default:
        return `bg-${accentColor}-50 dark:bg-${accentColor}-900/20 rounded-xl px-3 py-3 shadow-sm border border-${accentColor}-100 dark:border-${accentColor}-800/60 backdrop-blur-[2px]`;
    }
  };

  const renderAvatar = () => {
    if (!showAvatar || !isFirstInGroup) return null;
    
    // Moderately spaced avatar and message bubble
    const avatarContainerClasses = messageAlignment === 'right' ? 'ml-2 order-2' : 'mr-2 order-1';
    
    // Enhanced color classes with more vibrant gradients
    let bgColorClass = 'bg-blue-500';
    let ringColorClass = 'ring-blue-100 dark:ring-blue-900/30';
    
    if (accentColor === 'blue') {
      bgColorClass = 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600';
    } else if (accentColor === 'green') {
      bgColorClass = 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600';
      ringColorClass = 'ring-emerald-100 dark:ring-emerald-900/30';
    } else if (accentColor === 'purple') {
      bgColorClass = 'bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600';
      ringColorClass = 'ring-violet-100 dark:ring-violet-900/30';
    } else if (accentColor === 'red') {
      bgColorClass = 'bg-gradient-to-br from-rose-400 via-red-500 to-orange-600';
      ringColorClass = 'ring-rose-100 dark:ring-rose-900/30';
    } else if (accentColor === 'yellow') {
      bgColorClass = 'bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-600';
      ringColorClass = 'ring-amber-100 dark:ring-amber-900/30';
    } else if (accentColor === 'pink') {
      bgColorClass = 'bg-gradient-to-br from-pink-400 via-fuchsia-500 to-purple-600';
      ringColorClass = 'ring-pink-100 dark:ring-pink-900/30';
    }
    
    return (
      <div className={`flex-shrink-0 ${avatarContainerClasses} flex items-center`}>
        <div className={`w-10 h-10 rounded-full ${bgColorClass} flex items-center justify-center text-white shadow-lg ring-2 ${ringColorClass} overflow-hidden relative transition-all hover:scale-105 duration-300`}>
          {/* Enhanced stylized avatar with more sophisticated effects */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-30"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-40 mix-blend-overlay"></div>
          
          {/* Light reflection effect */}
          <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-white/30 rounded-full blur-sm transform -translate-y-1/2"></div>
          
          <span className="text-base font-bold relative z-10 tracking-wider drop-shadow-sm">U</span>
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
      className={`
        relative group
        flex flex-col
        w-full
        text-sm md:text-base
        ${isFirstInGroup ? 'pt-1' : 'pt-0.5'}
        ${isLastInGroup ? 'pb-1' : 'pb-0.5'}
        ${isInGroup ? 'pl-3 border-l-2 border-gray-100 dark:border-gray-800' : ''}
      `}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={messageVariants}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {isEditing ? (
        <div className="flex flex-col space-y-2 mx-2">
          <textarea
            className="p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full resize-none"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={Math.max(3, editedContent.split('\n').length)}
            autoFocus
          />
          <div className="flex justify-end space-x-2">
            <button
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
            <button
              className={`px-3 py-1 bg-${accentColor}-500 text-white rounded-md hover:bg-${accentColor}-600`}
              onClick={handleEditSubmit}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className={`flex items-start space-x-2 w-full ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'}`}>
          {renderAvatar()}
          
          <div className={`relative flex-1 min-w-0 ${isMobile ? 'max-w-[95%]' : 'max-w-[95%]'} ${messageAlignment === 'right' ? 'ml-auto' : 'mr-auto'}`}>
            <div className={`
              flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400
              ${messageAlignment === 'right' ? 'justify-end' : 'justify-start'}
              ${!showAvatar ? 'pr-6' : ''}
              ${isMobile ? 'text-sm' : ''}
            `}>
              {message.timestamp && showMetadata && (
                <div className="flex items-center opacity-70">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  <span>{formatTimestamp(message.timestamp)}</span>
                </div>
              )}
              {showAvatar && (
                <span className="font-medium">You</span>
              )}
            </div>
            <div className={`transition-all duration-200 ${getBubbleStyles()} hover:shadow-md`}>
              <div className={`prose ${isMobile ? 'prose-base' : 'prose-sm'} dark:prose-invert max-w-none prose-p:leading-relaxed`}>
                <MessageMarkdown content={message.content} />
              </div>
            </div>
            {renderReactions()}
            {renderMessageMetadata()}
            {renderMessageActions()}
          </div>
        </div>
      )}
    </motion.div>
  );
}; 