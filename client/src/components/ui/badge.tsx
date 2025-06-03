import React from 'react';
import { cn } from '../../utils/cn';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'paid' | 'overdue';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children, className = '' }) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
      case 'paid':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'error':
      case 'overdue':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'warning':
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className={cn(
      'px-2.5 py-0.5 rounded-full text-xs font-medium',
      getVariantClasses(),
      className
    )}>
      {children}
    </div>
  );
}; 