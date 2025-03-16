import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ChartBarIcon, StopIcon, ClipboardIcon, ArrowPathIcon } from './icons';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopGeneration?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onAttachmentUpload?: (file: File) => void;
  recentPrompts?: string[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopGeneration,
  isGenerating = false,
  placeholder = 'Send a message...',
  disabled = false,
  autoFocus = false,
  onAttachmentUpload,
  recentPrompts = [],
}) => {
  const [message, setMessage] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isGenerating) {
      onSendMessage(message);
      setMessage('');
      setAttachment(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachment(files[0]);
      if (onAttachmentUpload) {
        onAttachmentUpload(files[0]);
      }
    }
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-lg focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-200 dark:focus-within:ring-violet-900/30"
      >
        {attachment && (
          <div className="flex items-center px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/30">
            <div className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{attachment.name}</span>
              <span className="ml-2 text-gray-500 dark:text-gray-400">({Math.round(attachment.size / 1024)} KB)</span>
            </div>
            <button
              type="button"
              onClick={removeAttachment}
              className="ml-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isGenerating}
          autoFocus={autoFocus}
          rows={1}
          className="w-full resize-none py-3.5 pl-4 pr-24 bg-transparent text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none text-base"
          style={{ minHeight: '50px', maxHeight: '200px' }}
        />

        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {/* Recent prompts button */}
          {recentPrompts.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPrompts(!showPrompts)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Recent prompts"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
              
              {showPrompts && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-2 right-0 w-64 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 py-2 z-10"
                >
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    Recent prompts
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {recentPrompts.map((prompt, index) => (
                      <button
                        key={index}
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors truncate"
                        onClick={() => {
                          setMessage(prompt);
                          setShowPrompts(false);
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                          }
                        }}
                      >
                        {prompt.length > 40 ? `${prompt.substring(0, 40)}...` : prompt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Attachment button */}
          {onAttachmentUpload && (
            <button
              type="button"
              onClick={triggerFileUpload}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Attach file"
            >
              <ClipboardIcon className="w-4 h-4" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"
          />

          {/* Analytical example button */}
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors duration-200 opacity-80 hover:opacity-100 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md"
            onClick={() => {
              setMessage("Analyze the sales data for the last quarter and compare it with the previous quarter. Show the trends and highlight key insights. Visualize the comparison and include growth metrics.");
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
          >
            <ChartBarIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Try analytical query</span>
          </button>

          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm"
              disabled={disabled}
              aria-label="Stop generation"
            >
              <StopIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              className={`p-2 rounded-lg transition-all duration-200 shadow-sm ${
                !message.trim() || disabled
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800 hover:shadow-md'
              }`}
              disabled={!message.trim() || disabled}
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
      
      <div className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
        <span className="opacity-75">Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 font-sans">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 font-sans">Shift+Enter</kbd> for new line</span>
      </div>
    </div>
  );
}; 