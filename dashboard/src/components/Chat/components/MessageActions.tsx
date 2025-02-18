import React from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface MessageActionsProps {
  onCopy: () => void;
  onReload: () => void;
  isRunning?: boolean;
  className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  onCopy,
  onReload,
  isRunning,
  className,
}) => {
  return (
    <div className={cn("flex gap-1", className)}>
      <button
        onClick={onCopy}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
        title="Copy message"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={onReload}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        title="Regenerate response"
        disabled={isRunning}
      >
        <RefreshCw className={cn("w-4 h-4", isRunning && "animate-spin")} />
      </button>
    </div>
  );
}; 