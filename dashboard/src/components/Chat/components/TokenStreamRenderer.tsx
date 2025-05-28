import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageMarkdown } from './MessageMarkdown';

interface TokenStreamRendererProps {
  content: string;
  isStreaming: boolean;
  isComplete: boolean;
  streamSpeed?: number; // tokens per second
  showCursor?: boolean;
  onStreamComplete?: () => void;
  className?: string;
}

interface StreamState {
  displayedContent: string;
  currentIndex: number;
  isAnimating: boolean;
}

export const TokenStreamRenderer: React.FC<TokenStreamRendererProps> = ({
  content,
  isStreaming,
  isComplete,
  streamSpeed = 50, // Default 50 tokens per second
  showCursor = true,
  onStreamComplete,
  className = ''
}) => {
  const [streamState, setStreamState] = useState<StreamState>({
    displayedContent: '',
    currentIndex: 0,
    isAnimating: false
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');
  const startTimeRef = useRef<number>(0);

  // Calculate optimal token interval based on speed
  const tokenInterval = Math.max(1000 / streamSpeed, 10); // Minimum 10ms between tokens

  // Break content into tokens (words and punctuation)
  const tokenizeContent = useCallback((text: string): string[] => {
    // Simple tokenization - split by spaces and punctuation while preserving them
    return text.split(/(\s+|[.,!?;:\-\(\)\[\]{}])/).filter(token => token.length > 0);
  }, []);

  // Reset stream state when content changes significantly
  useEffect(() => {
    if (content !== lastContentRef.current) {
      const contentDiff = content.length - lastContentRef.current.length;
      
      // If new content is significantly different (not just appended), reset
      if (contentDiff < 0 || !content.startsWith(lastContentRef.current)) {
        setStreamState({
          displayedContent: '',
          currentIndex: 0,
          isAnimating: false
        });
        startTimeRef.current = Date.now();
      }
      
      lastContentRef.current = content;
    }
  }, [content]);

  // Handle streaming animation
  useEffect(() => {
    if (!isStreaming && !streamState.isAnimating) {
      return;
    }

    const tokens = tokenizeContent(content);
    
    if (tokens.length === 0) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start streaming animation
    setStreamState(prev => ({ ...prev, isAnimating: true }));

    intervalRef.current = setInterval(() => {
      setStreamState(prev => {
        const nextIndex = prev.currentIndex + 1;
        
        if (nextIndex >= tokens.length) {
          // Streaming complete
          clearInterval(intervalRef.current!);
          onStreamComplete?.();
          
          return {
            displayedContent: content,
            currentIndex: tokens.length,
            isAnimating: false
          };
        }

        // Build displayed content up to current index
        const displayedContent = tokens.slice(0, nextIndex).join('');

        return {
          displayedContent,
          currentIndex: nextIndex,
          isAnimating: true
        };
      });
    }, tokenInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [content, isStreaming, streamSpeed, tokenInterval, tokenizeContent, onStreamComplete]);

  // Handle immediate completion when not streaming
  useEffect(() => {
    if (!isStreaming && isComplete && streamState.displayedContent !== content) {
      setStreamState({
        displayedContent: content,
        currentIndex: tokenizeContent(content).length,
        isAnimating: false
      });
    }
  }, [isStreaming, isComplete, content, streamState.displayedContent, tokenizeContent]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const shouldShowCursor = showCursor && (isStreaming || streamState.isAnimating);
  const contentToRender = streamState.displayedContent || content;

  return (
    <div className={`relative ${className}`}>
      {/* Main content */}
      <div className="relative">
        <MessageMarkdown content={contentToRender} />
        
        {/* Animated cursor */}
        <AnimatePresence>
          {shouldShowCursor && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [1, 0, 1] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="inline-block w-0.5 h-5 bg-purple-500 dark:bg-purple-400 ml-1 align-text-bottom"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Stream progress indicator (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && streamState.isAnimating && (
        <div className="absolute top-0 right-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
          {streamState.currentIndex} / {tokenizeContent(content).length}
        </div>
      )}
    </div>
  );
};

// Enhanced typing indicator component
export interface TypingIndicatorProps {
  isVisible: boolean;
  variant?: 'dots' | 'wave' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  message?: string;
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isVisible,
  variant = 'dots',
  size = 'md',
  color = 'purple',
  message = 'AI is thinking...',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const containerClasses = {
    sm: 'space-x-1',
    md: 'space-x-1.5',
    lg: 'space-x-2'
  };

  const renderDots = () => (
    <div className={`flex items-center ${containerClasses[size]}`}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`
            ${sizeClasses[size]} 
            bg-${color}-500 dark:bg-${color}-400 
            rounded-full
          `}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.2,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );

  const renderWave = () => (
    <div className={`flex items-end ${containerClasses[size]}`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <motion.div
          key={index}
          className={`
            w-1 bg-${color}-500 dark:bg-${color}-400 rounded-t
          `}
          animate={{
            height: ['8px', '16px', '8px']
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: index * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <motion.div
      className={`
        ${sizeClasses[size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'lg']}
        bg-${color}-500 dark:bg-${color}-400 
        rounded-full
      `}
      animate={{
        scale: [1, 1.3, 1],
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );

  const renderVariant = () => {
    switch (variant) {
      case 'wave':
        return renderWave();
      case 'pulse':
        return renderPulse();
      case 'dots':
      default:
        return renderDots();
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`flex items-center space-x-3 ${className}`}
        >
          {renderVariant()}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 