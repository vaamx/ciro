import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ChatMessage } from '../types';
import { MessageMarkdown } from './MessageMarkdown';
import { formatTimestamp } from '../utils/formatTimestamp';
import { 
  PaperAirplaneIcon,
  CheckIcon,
  ClockIcon
} from './icons';

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (content: string) => void;
  showAvatar?: boolean;
  showMetadata?: boolean;
  messageAlignment?: 'left' | 'right';
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  onEdit,
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
        flex items-start gap-3 group relative
        ${messageAlignment === 'right' ? 'flex-row-reverse' : ''}
        ${!isFirstInGroup ? 'mt-1' : ''}
        ${!isLastInGroup ? 'mb-1' : ''}
      `}
    >
      <div className={`
        flex flex-col items-end flex-1 max-w-2xl space-y-1
        ${messageAlignment === 'right' ? 'text-right' : 'text-left'}
      `}>
        <div className={`
          relative px-4 py-2 w-fit ml-auto
          text-white/90 dark:text-white/90
          transform transition-all duration-200 ease-out
          ${isHovered ? 'translate-x-1' : ''}
          prose prose-sm prose-invert
          prose-p:text-white/90 dark:prose-p:text-white/90
          prose-strong:text-white dark:prose-strong:text-white
          prose-em:text-white/80 dark:prose-em:text-white/80
          prose-code:text-white/90 dark:prose-code:text-white/90
          prose-code:bg-white/10 dark:prose-code:bg-white/10
          prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5
          prose-code:text-[13px] prose-code:font-medium
          prose-pre:bg-white/10 dark:prose-pre:bg-white/10
          prose-pre:rounded-xl prose-pre:shadow-sm
          prose-a:text-violet-300 dark:prose-a:text-violet-300
          prose-a:no-underline hover:prose-a:underline
        `}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full p-2 rounded-lg bg-white/10 text-white/90 
                  placeholder-white/60 focus:outline-none focus:ring-2 
                  focus:ring-white/20 dark:focus:ring-white/20
                  resize-none dark:placeholder-white/40
                  shadow-inner"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 rounded-lg bg-white/10 text-white/90 
                    hover:bg-white/20 transition-colors shadow-inner"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="px-3 py-1 rounded-lg bg-white/10 text-white/90 
                    hover:bg-white/20 transition-colors shadow-inner font-medium"
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
                  bg-gray-900/80 dark:bg-gray-800/90 px-2 py-1 rounded-full 
                  shadow-lg border border-white/10
                  backdrop-blur-sm z-10"
              >
                {onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-gray-400 hover:text-white 
                      rounded-full hover:bg-white/10
                      transition-all duration-200"
                    title="Edit message"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
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
              flex items-center space-x-2 text-xs text-gray-400/80
              dark:text-gray-500/80 ${messageAlignment === 'right' ? 'justify-end' : ''}
              opacity-0 group-hover:opacity-100 transition-opacity
              select-none
            `}
          >
            <span className="flex items-center space-x-1">
              {message.status === 'complete' && <CheckIcon className="w-3 h-3 text-emerald-500/80" />}
              {(message.status === 'loading' || message.status === 'streaming') && <ClockIcon className="w-3 h-3" />}
              <span>{formatTimestamp(message.timestamp)}</span>
            </span>
          </motion.div>
        )}
      </div>

      {showAvatar && (
        <motion.div 
          className={`
            flex-shrink-0 w-8 h-8 rounded-full overflow-hidden
            bg-gradient-to-br from-violet-500/80 via-indigo-500/80 to-purple-500/80
            dark:from-violet-400/80 dark:via-indigo-400/80 dark:to-purple-400/80
            flex items-center justify-center
            shadow-lg ring-1 ring-white/20 dark:ring-white/10
            ${isFirstInGroup ? '' : 'opacity-0'}
            transform-gpu transition-all duration-200
            group-hover:shadow-violet-500/20 dark:group-hover:shadow-violet-400/20
          `}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <svg
            className="w-5 h-5 text-white/90"
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