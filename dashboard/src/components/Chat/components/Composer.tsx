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
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
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
      handleSubmit(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleMentionClick = (user: { id: string; name: string }) => {
    const textBeforeCursor = message.slice(0, textareaRef.current?.selectionStart || 0);
    const textAfterCursor = message.slice(textareaRef.current?.selectionEnd || 0);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const newMessage = `${textBeforeCursor.slice(0, lastAtIndex)}@${user.name} ${textAfterCursor}`;
    setMessage(newMessage);
    setShowMentions(false);
  };

  return (
    <form 
      ref={composerRef}
      onSubmit={handleSubmit} 
      className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm"
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
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setMessage(e.target.value);
              const lastAtIndex = e.target.value.lastIndexOf('@');
              if (lastAtIndex !== -1 && lastAtIndex === e.target.selectionStart - 1) {
                setShowMentions(true);
                setMentionQuery('');
              } else if (lastAtIndex !== -1) {
                const query = e.target.value.slice(lastAtIndex + 1, e.target.selectionStart);
                setMentionQuery(query);
              } else {
                setShowMentions(false);
              }
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled || isGenerating}
            className={`
              w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 
              rounded-xl resize-none focus:outline-none focus:ring-2 
              focus:ring-indigo-500 dark:focus:ring-indigo-400
              disabled:opacity-60 disabled:cursor-not-allowed
              text-gray-900 dark:text-white placeholder-gray-500 
              dark:placeholder-gray-400
              min-h-[44px] max-h-[120px] overflow-y-auto
              ${isGenerating ? 'pr-24' : 'pr-12'}
              transition-all duration-200
            `}
            rows={1}
          />

          <div className="absolute right-2 bottom-2 flex items-center space-x-1">
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
                title={isRecording ? 'Stop recording' : 'Start recording'}
                disabled={disabled || isGenerating}
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </motion.button>
            )}

            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!message.trim() || disabled || isGenerating}
              className={`
                p-2 rounded-lg transition-colors
                ${message.trim() && !disabled && !isGenerating
                  ? 'text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300'
                  : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'}
                hover:bg-gray-100 dark:hover:bg-gray-700
              `}
              title="Send message"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
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
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        multiple
        accept={supportedFileTypes.join(',')}
        className="hidden"
      />

      <AnimatePresence>
        {showMentions && mentionableUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full mb-2 w-full"
          >
            <div className="max-h-48 overflow-y-auto p-2 bg-white dark:bg-gray-800 
              rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
            >
              {mentionableUsers
                .filter(user => user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                .map(user => (
                  <motion.button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      const textBeforeCursor = message.slice(0, textareaRef.current?.selectionStart || 0);
                      const textAfterCursor = message.slice(textareaRef.current?.selectionEnd || 0);
                      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                      const newMessage = `${textBeforeCursor.slice(0, lastAtIndex)}@${user.name} ${textAfterCursor}`;
                      setMessage(newMessage);
                      setShowMentions(false);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center space-x-2 p-2 hover:bg-gray-100 
                      dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 
                        flex items-center justify-center text-sm font-medium text-gray-600 
                        dark:text-gray-300"
                      >
                        {user.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-gray-700 dark:text-gray-300">{user.name}</span>
                  </motion.button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isGenerating && (
        <div className="absolute right-4 -top-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400
              bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm
              border border-gray-200 dark:border-gray-700"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4"
            >
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6V12L16 14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
            <span>{streaming ? 'AI is typing...' : 'Generating...'}</span>
          </motion.div>
        </div>
      )}
    </form>
  );
}; 