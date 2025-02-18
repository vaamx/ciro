import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatMessage } from '../types';
import { MessageMarkdown } from './MessageMarkdown';
import { formatTimestamp } from '../utils/formatTimestamp';
import { 
  TrashIcon, 
  PaperAirplaneIcon,
  CheckIcon,
  ClockIcon
} from './icons';

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  showAvatar?: boolean;
  showMetadata?: boolean;
  messageAlignment?: 'left' | 'right';
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  onEdit,
  onDelete,
  showAvatar = true,
  showMetadata = false,
  messageAlignment = 'right',
  isFirstInGroup = false,
  isLastInGroup = false,
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

  const messageVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: 'spring',
        damping: 25,
        stiffness: 300
      }
    },
    exit: { opacity: 0, y: -20, scale: 0.95 }
  };

  const actionBarVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: 'spring',
        damping: 20,
        stiffness: 300
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={messageVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`
        flex items-start space-x-3 group relative
        ${messageAlignment === 'right' ? 'flex-row-reverse space-x-reverse' : ''}
        ${!isFirstInGroup ? 'mt-1' : ''}
        ${!isLastInGroup ? 'mb-1' : ''}
      `}
    >
      <div className="flex-1 max-w-2xl space-y-1">
        <div className={`
          relative rounded-2xl p-4
          ${messageAlignment === 'right' ? 'ml-auto' : 'mr-auto'}
          bg-gradient-to-br from-indigo-500 to-purple-600 text-white
          shadow-sm hover:shadow-md
          transform transition-all duration-200
          ${isHovered ? 'scale-[1.01]' : ''}
        `}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full p-2 rounded-lg bg-white/10 text-white 
                  placeholder-white/60 focus:outline-none focus:ring-2 
                  focus:ring-white/50"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 rounded-lg bg-white/20 text-white 
                    hover:bg-white/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="px-3 py-1 rounded-lg bg-white/20 text-white 
                    hover:bg-white/30 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <MessageMarkdown content={message.content} />
          )}

          <AnimatePresence>
            {isHovered && !isEditing && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={actionBarVariants}
                className="absolute -top-3 right-4 flex items-center space-x-2 
                  bg-white dark:bg-gray-800 px-2 py-1 rounded-full shadow-lg 
                  border border-gray-100 dark:border-gray-700"
              >
                {onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-gray-500 hover:text-gray-700 
                      dark:text-gray-400 dark:hover:text-gray-300 rounded-full 
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Edit message"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                )}

                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="p-1 text-gray-500 hover:text-red-500 
                      dark:text-gray-400 dark:hover:text-red-400 rounded-full 
                      hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Delete message"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showMetadata && message.timestamp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`
              flex items-center space-x-2 text-xs text-gray-500 
              dark:text-gray-400 ${messageAlignment === 'right' ? 'justify-end' : ''}
            `}
          >
            <span className="flex items-center space-x-1">
              {message.status === 'complete' && <CheckIcon className="w-3 h-3 text-green-500" />}
              {(message.status === 'loading' || message.status === 'streaming') && <ClockIcon className="w-3 h-3" />}
              <span>{formatTimestamp(message.timestamp)}</span>
            </span>
          </motion.div>
        )}
      </div>

      {showAvatar && (
        <motion.div 
          className={`
            flex-shrink-0 w-8 h-8 rounded-full 
            bg-gradient-to-r from-indigo-500 to-purple-600
            flex items-center justify-center
            shadow-lg ring-2 ring-white dark:ring-gray-800
            ${isFirstInGroup ? '' : 'opacity-0'}
          `}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}; 