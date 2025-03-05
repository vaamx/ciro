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
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  return (
    <form 
      ref={composerRef}
      onSubmit={handleSubmit} 
      className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}
    >
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700"
          >
            {attachments.map((file, index) => (
              <div
                key={index}
                className="group relative bg-gray-50 dark:bg-gray-700 rounded-lg 
                  px-3 py-1 pr-8 flex items-center space-x-2"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full
                    text-gray-500 hover:text-gray-700 dark:text-gray-400 
                    dark:hover:text-gray-300 hover:bg-gray-100 
                    dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </motion.div>
        )}

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
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700
                  text-gray-900 dark:text-white text-sm"
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

      <div className="relative flex items-end space-x-2 p-2">
        {allowAttachments && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 
              dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 
              dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            title="Attach file"
            disabled={disabled || isGenerating}
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
          </motion.button>
        )}

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={streaming ? 'AI is typing...' : placeholder}
            disabled={disabled || isGenerating}
            className={`
              w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 
              rounded-xl resize-none focus:outline-none focus:ring-2 
              focus:ring-indigo-500 dark:focus:ring-indigo-400
              disabled:opacity-60 disabled:cursor-not-allowed
              text-gray-900 dark:text-white placeholder-gray-500 
              dark:placeholder-gray-400
              min-h-[44px] max-h-[120px] overflow-y-auto
              ${isGenerating || streaming ? 'pr-24' : 'pr-12'}
              transition-all duration-200
            `}
            rows={1}
          />

          <div className="absolute right-2 bottom-2 flex items-center space-x-1">
            {streaming && (
              <div className="flex items-center space-x-1 mr-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            {allowVoiceInput && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsRecording(!isRecording)}
                className={`
                  p-2 rounded-lg transition-colors
                  ${isRecording 
                    ? 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 animate-pulse' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}
                  hover:bg-gray-100 dark:hover:bg-gray-700
                `}
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
