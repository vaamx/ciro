import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ComposerProps {
  onSubmit: (message: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isGenerating?: boolean;
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
  allowAttachments = false,
  allowVoiceInput = false,
  maxAttachmentSize = 5 * 1024 * 1024,
  supportedFileTypes = ['image/*', 'application/pdf'],
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
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
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8 14a1 1 0 110-2 1 1 0 010 2zM12 10a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
