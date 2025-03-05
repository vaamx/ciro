import React from 'react';
import { DataSource as KnowledgeDataSource } from '../../types/knowledge';

interface KnowledgeSourceSelectorProps {
  source: KnowledgeDataSource;
  isSelected: boolean;
  onSelect: (sourceId: string) => void;
}

export const KnowledgeSourceSelector: React.FC<KnowledgeSourceSelectorProps> = ({
  source,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect(source.id)}
      className={`
        p-3 rounded-lg cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}
        border
        flex items-center justify-between
      `}
    >
      <div className="flex items-center gap-3">
        <div className="text-xl">{source.icon || 'database'}</div>
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {source.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {source.type}
          </p>
        </div>
      </div>
      
      {isSelected && (
        <div className="text-blue-500 dark:text-blue-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}; 