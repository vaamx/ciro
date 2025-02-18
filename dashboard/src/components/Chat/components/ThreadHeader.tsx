import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, Cog6ToothIcon, StopIcon, ChevronDownIcon, ShareIcon, StarIcon } from './icons';
import { Menu } from '@headlessui/react';

export interface ThreadHeaderProps {
  onClose: () => void;
  onSettingsClick: () => void;
  onClearChat: () => void;
  onCancelGeneration?: () => void;
  isGenerating?: boolean;
  participants?: {
    id: string;
    name: string;
    avatar?: string;
    isTyping?: boolean;
  }[];
}

export const ThreadHeader: React.FC<ThreadHeaderProps> = ({
  onClose,
  onSettingsClick,
  onClearChat,
  onCancelGeneration,
  isGenerating = false,
  participants,
}) => {
  const [isStarred, setIsStarred] = useState(false);
  const onlineParticipants = participants?.filter(p => !p.isTyping) || [];
  const title = participants?.length === 1 
    ? participants[0].name
    : participants?.length ? `${participants.length} participants` : 'Chat';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="aui-thread-header flex items-center justify-between px-6 py-4 
        border-b border-gray-100 dark:border-gray-700 
        bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm 
        sticky top-0 z-10"
    >
      <div className="flex items-center space-x-3">
        {participants?.length === 1 && participants[0].avatar ? (
          <div className="relative">
            <img
              src={participants[0].avatar}
              alt={`${participants[0].name}'s avatar`}
              className="w-8 h-8 rounded-full ring-2 ring-offset-2 ring-gray-100 dark:ring-gray-700"
            />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 
            flex items-center justify-center text-white shadow-md">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <div>
            <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <span>{title}</span>
              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
            </h2>
            {onlineParticipants.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {onlineParticipants.length} online
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {onCancelGeneration && isGenerating && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={onCancelGeneration}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
              dark:hover:text-gray-300 rounded-full hover:bg-gray-100 
              dark:hover:bg-gray-700 transition-all duration-200"
            title="Stop generating"
          >
            <StopIcon className="w-5 h-5" />
          </motion.button>
        )}

        <button
          onClick={() => setIsStarred(!isStarred)}
          className={`p-2 rounded-full transition-all duration-200 ${
            isStarred 
              ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          } hover:bg-gray-100 dark:hover:bg-gray-700`}
          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
        >
          <StarIcon className="w-5 h-5" />
        </button>

        <button
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
            dark:hover:text-gray-300 rounded-full hover:bg-gray-100 
            dark:hover:bg-gray-700 transition-all duration-200"
          title="Share conversation"
        >
          <ShareIcon className="w-5 h-5" />
        </button>

        <Menu as="div" className="relative">
          <Menu.Button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
            dark:hover:text-gray-300 rounded-full hover:bg-gray-100 
            dark:hover:bg-gray-700 transition-all duration-200">
            <Cog6ToothIcon className="w-5 h-5" />
          </Menu.Button>
          <AnimatePresence>
            <Menu.Items
              className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 
                rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 
                py-1 z-50"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Menu.Item as="button"
                  onClick={onSettingsClick}
                  className={({ active }) => `
                    w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300
                    ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
                  `}
                >
                  Settings
                </Menu.Item>
                <Menu.Item as="button"
                  onClick={onClearChat}
                  className={({ active }) => `
                    w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400
                    ${active ? 'bg-gray-100 dark:bg-gray-700' : ''}
                  `}
                >
                  Clear conversation
                </Menu.Item>
              </motion.div>
            </Menu.Items>
          </AnimatePresence>
        </Menu>

        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
            dark:hover:text-gray-300 rounded-full hover:bg-gray-100 
            dark:hover:bg-gray-700 transition-all duration-200"
          title="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}; 