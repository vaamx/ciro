import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  status?: 'idle' | 'loading' | 'success' | 'error';
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  height?: number;
  theme?: 'light' | 'dark';
  animated?: boolean;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  status = 'loading',
  showPercentage = true,
  showLabel = true,
  label = 'Processing',
  height = 8,
  theme = 'light',
  animated = true,
  className = ''
}) => {
  const [displayedProgress, setDisplayedProgress] = useState(0);
  
  // Animate progress
  useEffect(() => {
    if (animated) {
      // Start from current displayed progress and animate to target
      const startValue = displayedProgress;
      const endValue = progress;
      const duration = 500; // ms
      const interval = 10; // ms
      const steps = duration / interval;
      const increment = (endValue - startValue) / steps;
      
      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        const newProgress = startValue + (increment * currentStep);
        
        if (currentStep >= steps) {
          clearInterval(timer);
          setDisplayedProgress(endValue);
        } else {
          setDisplayedProgress(newProgress);
        }
      }, interval);
      
      return () => clearInterval(timer);
    } else {
      setDisplayedProgress(progress);
    }
  }, [progress, animated]);
  
  // Determine colors based on theme and status
  const getColors = () => {
    const baseColors = {
      light: {
        background: '#e5e7eb',
        idle: '#9ca3af',
        loading: '#3b82f6',
        success: '#10b981',
        error: '#ef4444',
        text: '#1f2937'
      },
      dark: {
        background: '#374151',
        idle: '#6b7280',
        loading: '#60a5fa',
        success: '#34d399',
        error: '#f87171',
        text: '#f3f4f6'
      }
    };
    
    const colors = baseColors[theme];
    
    return {
      background: colors.background,
      progress: colors[status],
      text: colors.text
    };
  };
  
  const colors = getColors();
  
  // Determine label text
  const getStatusLabel = () => {
    switch (status) {
      case 'idle':
        return 'Waiting';
      case 'loading':
        return label;
      case 'success':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return label;
    }
  };
  
  // Animation variants
  const progressVariants = {
    initial: { width: '0%' },
    animate: { 
      width: `${displayedProgress}%`,
      transition: { duration: animated ? 0.5 : 0 }
    }
  };
  
  const pulseVariants: Variants = {
    initial: { opacity: 0.6 },
    animate: { 
      opacity: 1,
      transition: { 
        repeat: Infinity, 
        repeatType: "reverse" as const, 
        duration: 1 
      }
    }
  };
  
  return (
    <div className={`progress-indicator ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span 
            className="text-sm font-medium"
            style={{ color: colors.text }}
          >
            {getStatusLabel()}
          </span>
          
          {showPercentage && (
            <span 
              className="text-sm font-medium"
              style={{ color: colors.text }}
            >
              {Math.round(displayedProgress)}%
            </span>
          )}
        </div>
      )}
      
      <div 
        className="progress-bar-bg rounded-full overflow-hidden"
        style={{ 
          height: `${height}px`, 
          backgroundColor: colors.background 
        }}
      >
        <motion.div
          className="progress-bar rounded-full h-full"
          style={{ backgroundColor: colors.progress }}
          initial="initial"
          animate="animate"
          variants={status === 'loading' && animated ? pulseVariants : {}}
        >
          <motion.div
            className="h-full"
            initial="initial"
            animate="animate"
            variants={progressVariants}
          />
        </motion.div>
      </div>
      
      {status === 'error' && (
        <p className="text-xs mt-1" style={{ color: colors.progress }}>
          An error occurred. Please try again.
        </p>
      )}
    </div>
  );
};

// Multi-step progress indicator
interface Step {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  progress: number;
}

interface MultiStepProgressProps {
  steps: Step[];
  currentStepIndex: number;
  theme?: 'light' | 'dark';
  className?: string;
}

export const MultiStepProgress: React.FC<MultiStepProgressProps> = ({
  steps,
  currentStepIndex,
  theme = 'light',
  className = ''
}) => {
  return (
    <div className={`multi-step-progress ${className}`}>
      {steps.map((step, index) => (
        <div 
          key={step.id}
          className={`step mb-4 ${index === currentStepIndex ? 'current' : ''}`}
        >
          <div className="flex items-center mb-1">
            <div 
              className={`step-number w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs font-medium ${
                step.status === 'success' 
                  ? 'bg-green-500 text-white' 
                  : step.status === 'error'
                  ? 'bg-red-500 text-white'
                  : index <= currentStepIndex
                  ? 'bg-blue-500 text-white'
                  : theme === 'light' 
                  ? 'bg-gray-200 text-gray-700' 
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {step.status === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span 
              className={`step-label text-sm font-medium ${
                index <= currentStepIndex
                  ? theme === 'light' ? 'text-gray-900' : 'text-white'
                  : theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          
          {index <= currentStepIndex && (
            <div className="ml-8">
              <ProgressIndicator
                progress={step.progress}
                status={step.status}
                showLabel={false}
                theme={theme}
                height={4}
              />
            </div>
          )}
          
          {index < steps.length - 1 && (
            <div 
              className="step-connector ml-3 h-4 w-px"
              style={{ 
                backgroundColor: theme === 'light' ? '#e5e7eb' : '#4b5563',
                marginBottom: '-4px'
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}; 