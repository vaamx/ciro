import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ThinkingStep {
  id: string;
  content: string;
  type: 'analyze' | 'reason' | 'lookup' | 'calculate' | 'insight' | 'plan';
  completed: boolean;
}

interface ThinkingProcessProps {
  /** Whether the thinking process is active */
  isThinking: boolean;
  /** Steps in the thinking process */
  steps?: ThinkingStep[];
  /** Content being currently generated */
  streamingContent?: string;
  /** Whether to auto-generate thinking steps */
  autoGenerateSteps?: boolean;
  /** Callback when thinking is complete */
  onThinkingComplete?: () => void;
  /** Visual style: minimal, standard, or detailed */
  displayStyle?: 'minimal' | 'standard' | 'detailed';
}

const defaultThinkingSteps: ThinkingStep[] = [
  {
    id: 'step-1',
    content: 'Understanding query and context',
    type: 'analyze',
    completed: false
  },
  {
    id: 'step-2',
    content: 'Retrieving relevant knowledge',
    type: 'lookup',
    completed: false
  },
  {
    id: 'step-3',
    content: 'Analyzing data and formulating response',
    type: 'reason',
    completed: false
  },
  {
    id: 'step-4',
    content: 'Verifying answer accuracy',
    type: 'calculate',
    completed: false
  },
  {
    id: 'step-5',
    content: 'Generating final response',
    type: 'insight',
    completed: false
  }
];

// Icons for different thinking step types
const getStepIcon = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'analyze':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    case 'lookup':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'reason':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'calculate':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    case 'insight':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'plan':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

const getStepColor = (type: ThinkingStep['type']) => {
  switch (type) {
    case 'analyze':
      return 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    case 'lookup':
      return 'text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
    case 'reason':
      return 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
    case 'calculate':
      return 'text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    case 'insight':
      return 'text-rose-500 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30';
    case 'plan':
      return 'text-teal-500 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30';
    default:
      return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
  }
};

// A pulsing dot animation for steps in progress
const PulsingDot = () => {
  return (
    <div className="flex items-center h-4">
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-current"
        animate={{ 
          scale: [1, 1.5, 1],
          opacity: [0.7, 1, 0.7] 
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};

export const ThinkingProcess: React.FC<ThinkingProcessProps> = ({
  isThinking = true,
  steps: providedSteps,
  streamingContent = '',
  autoGenerateSteps = true,
  onThinkingComplete,
  displayStyle = 'standard'
}) => {
  const [currentSteps, setCurrentSteps] = useState<ThinkingStep[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Initialize steps from props or defaults
  useEffect(() => {
    // Use provided steps if available, otherwise use defaults
    const stepsToUse = providedSteps || (autoGenerateSteps ? defaultThinkingSteps : []);
    setCurrentSteps(stepsToUse);
  }, [providedSteps, autoGenerateSteps]);

  // Handle step progression
  useEffect(() => {
    if (!isThinking) {
      // Mark all steps as complete when thinking is done
      setCurrentSteps(prev => prev.map(step => ({ ...step, completed: true })));
      if (onThinkingComplete) onThinkingComplete();
      return;
    }

    if (currentSteps.length === 0) return;

    // Progress through steps with appropriate timing
    const timer = setTimeout(() => {
      if (activeStepIndex < currentSteps.length) {
        // Mark current step as completed
        setCurrentSteps(prev => 
          prev.map((step, idx) => 
            idx === activeStepIndex ? { ...step, completed: true } : step
          )
        );
        
        // Move to next step
        setActiveStepIndex(prev => {
          const next = prev + 1;
          return next < currentSteps.length ? next : prev;
        });
      }
    }, Math.random() * 1000 + 700); // Random time between 700-1700ms for more natural progression

    return () => clearTimeout(timer);
  }, [isThinking, activeStepIndex, currentSteps.length, onThinkingComplete]);

  // Don't render anything if not thinking and in minimal mode
  if (!isThinking && displayStyle === 'minimal' && !streamingContent) {
    return null;
  }

  // Minimal display just shows a spinner or progress bar
  if (displayStyle === 'minimal') {
    return (
      <div className="flex flex-col space-y-2 p-2 max-w-2xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
              initial={{ width: "0%" }}
              animate={{ 
                width: isThinking 
                  ? `${Math.min(90, (activeStepIndex / currentSteps.length) * 100)}%` 
                  : "100%" 
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {isThinking && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Thinking...</span>
          )}
        </div>
        
        {streamingContent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
          >
            {streamingContent}
          </motion.div>
        )}
      </div>
    );
  }

  // Standard display shows steps with icons
  return (
    <div className="thinking-process-container bg-white dark:bg-gray-850 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Thinking Process
          {isThinking && (
            <motion.span 
              className="ml-auto text-xs text-blue-500 dark:text-blue-400 font-normal"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Processing...
            </motion.span>
          )}
        </h3>
      </div>
      
      <div className="p-3">
        {/* Step list */}
        <div className="space-y-2 mb-3">
          <AnimatePresence initial={false}>
            {currentSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-2 p-2 rounded-md ${
                  index === activeStepIndex && isThinking
                    ? getStepColor(step.type)
                    : 'bg-gray-50 dark:bg-gray-800'
                } ${
                  step.completed
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${
                  index === activeStepIndex && isThinking
                    ? 'bg-white dark:bg-gray-700 bg-opacity-80'
                    : step.completed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-500 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {step.completed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : index === activeStepIndex && isThinking ? (
                    <PulsingDot />
                  ) : (
                    getStepIcon(step.type)
                  )}
                </div>
                <span className="text-sm">{step.content}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Streaming content display */}
        {streamingContent && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
          >
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response:</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {streamingContent}
              {isThinking && (
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block ml-1"
                >
                  ▌
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}; 