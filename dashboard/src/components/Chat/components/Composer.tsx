import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ComposerProps {
  onSubmit: (message: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isGenerating?: boolean;
  streaming?: boolean;
  suggestions?: string[];
  mentionableUsers?: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  allowAttachments?: boolean;
  allowVoiceInput?: boolean;
  maxAttachmentSize?: number;
  supportedFileTypes?: string[];
  className?: string;
  isMobile?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  onSubmit,
  disabled = false,
  placeholder = 'Type a message...',
  isGenerating = false,
  streaming = false,
  suggestions = [],
  mentionableUsers = [],
  allowAttachments = false,
  allowVoiceInput = false,
  maxAttachmentSize = 5 * 1024 * 1024,
  supportedFileTypes = ['image/*', 'application/pdf'],
  className = '',
  isMobile = false,
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isGenerating) {
      onSubmit(message.trim(), attachments.length > 0 ? attachments : undefined);
      setMessage('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions || showMentions) {
        return; // Don't submit if suggestions or mentions are open
      }
      handleSubmit(e);
    } else if (e.key === '@') {
      setShowMentions(true);
      setShowSuggestions(false);
    } else if (e.key === '/' && cursorPosition === 0) {
      setShowSuggestions(true);
      setShowMentions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowMentions(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const insertSuggestion = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
  };

  const insertMention = (user: { id: string; name: string }) => {
    const before = message.slice(0, cursorPosition);
    const after = message.slice(cursorPosition);
    setMessage(`${before}@${user.name} ${after}`);
    setShowMentions(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
    
    if (files.length > 0) {
      const validFiles = files.filter(file => {
        const isValidType = supportedFileTypes.some(type => {
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.replace('/*', ''));
          }
          return file.type === type;
        });
        const isValidSize = file.size <= maxAttachmentSize;
        return isValidType && isValidSize;
      });
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <motion.form
      ref={composerRef}
      className={`relative ${className}`}
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative bg-gray-100 dark:bg-gray-800 rounded-md p-1 pl-2 pr-6 flex items-center text-sm text-gray-700 dark:text-gray-300"
            >
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                type="button"
                className="absolute right-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => removeAttachment(index)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main composer input */}
      <div className={`flex items-end border ${isGenerating ? 'border-indigo-300 dark:border-indigo-800' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden pr-1 transition`}>
        {/* Text area for message */}
        <textarea
          ref={textareaRef}
          className={`flex-1 py-2 pl-3 pr-2 resize-none focus:outline-none bg-transparent text-gray-900 dark:text-gray-100 ${isMobile ? 'text-base' : 'text-sm'} max-h-32 min-h-[2.5rem]`}
          placeholder={isGenerating ? "Assistant is responding..." : placeholder}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled || isGenerating}
          rows={1}
        />

        <div className="absolute right-2 bottom-2 flex items-center space-x-1">
          {streaming && (
            <div className="flex items-center space-x-1 mr-2">
              <div className={`w-${isMobile ? '1.5' : '2'} h-${isMobile ? '1.5' : '2'} bg-indigo-500 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
              <div className={`w-${isMobile ? '1.5' : '2'} h-${isMobile ? '1.5' : '2'} bg-indigo-500 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
              <div className={`w-${isMobile ? '1.5' : '2'} h-${isMobile ? '1.5' : '2'} bg-indigo-500 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
            </div>
          )}
          
          {/* File attachment button */}
          {allowAttachments && (
            <motion.label
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                ${isMobile ? 'p-1.5' : 'p-2'} rounded-lg transition-colors cursor-pointer
                text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
              `}
              htmlFor="file-upload"
              aria-label="Attach file"
              title="Attach file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept={supportedFileTypes?.join(',')}
                onChange={(e) => {
                  if (e.target.files) {
                    const files = Array.from(e.target.files);
                    const validFiles = files.filter(file => {
                      const isValidType = supportedFileTypes.some(type => {
                        if (type.endsWith('/*')) {
                          return file.type.startsWith(type.replace('/*', ''));
                        }
                        return file.type === type;
                      });
                      const isValidSize = file.size <= maxAttachmentSize;
                      return isValidType && isValidSize;
                    });
                    setAttachments(prev => [...prev, ...validFiles]);
                    e.target.value = ''; // Reset input
                  }
                }}
                disabled={disabled || isGenerating}
              />
            </motion.label>
          )}
          
          {allowVoiceInput && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsRecording(!isRecording)}
              className={`
                ${isMobile ? 'p-1.5' : 'p-2'} rounded-lg transition-colors
                ${isRecording 
                  ? 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 animate-pulse' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}
                hover:bg-gray-100 dark:hover:bg-gray-700
              `}
            >
              <svg className={`w-${isMobile ? '4' : '5'} h-${isMobile ? '4' : '5'}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto
              bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 
              dark:border-gray-700 z-10"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => insertSuggestion(suggestion)}
                className={`w-full ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'} text-left hover:bg-gray-100 dark:hover:bg-gray-700
                  text-gray-900 dark:text-white ${isMobile ? 'text-xs' : 'text-sm'}`}
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}

        {/* Mentions Dropdown */}
        {showMentions && mentionableUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto
              bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 
              dark:border-gray-700 z-10"
          >
            {mentionableUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700
                  flex items-center space-x-2"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {user.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-sm text-gray-900 dark:text-white">{user.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
};
