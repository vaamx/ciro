import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, ClockIcon, ExclamationCircleIcon } from './icons';
import { type MessageStatus } from '../types';

interface MessageStatusProps {
  status: MessageStatus;
  className?: string;
}

export const MessageStatusIndicator: React.FC<MessageStatusProps> = ({ 
  status,
  className = ''
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckIcon className="w-4 h-4 text-green-500 dark:text-green-400" />;
      case 'loading':
      case 'streaming':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <ClockIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </motion.div>
        );
      case 'error':
        return <ExclamationCircleIcon className="w-4 h-4 text-red-500 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'complete':
        return 'Sent';
      case 'loading':
        return 'Sending...';
      case 'streaming':
        return 'Receiving...';
      case 'error':
        return 'Failed to send';
      default:
        return '';
    }
  };

  if (!status || status === 'complete') return null;

  return (
    <div className={`flex items-center space-x-1 text-xs ${className}`}>
      {getStatusIcon()}
      <span className="text-gray-500 dark:text-gray-400">{getStatusText()}</span>
    </div>
  );
}; 