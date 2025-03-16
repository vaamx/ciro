import React from 'react';
import { motion } from 'framer-motion';
import { DataSource as KnowledgeDataSource } from '../../types/knowledge';
import { FILE_TYPE_ICONS } from '../DataSources/AddDataSourceWizard'; 
import { Database, FileType, FolderOpen, ExternalLink, Check, ChevronRight } from 'lucide-react';

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
  // Get appropriate icon based on source type
  const renderIcon = () => {
    // If source has a direct icon URL, use it
    if (source.icon && source.icon.startsWith('data:')) {
      return <img src={source.icon} alt={source.type} className="w-6 h-6 object-contain" />;
    }
    
    // Check for metadata.iconType
    if (source.originalSource?.metadata?.iconType) {
      // This maps to file types in AddDataSourceWizard
      const iconType = source.originalSource.metadata.iconType;
      if (iconType === 'csv') return <img src={FILE_TYPE_ICONS.csv} alt="CSV" className="w-6 h-6" />;
      if (iconType === 'xlsx' || iconType === 'file-spreadsheet') return <img src={FILE_TYPE_ICONS.excel} alt="Excel" className="w-6 h-6" />;
      if (iconType === 'pdf') return <img src={FILE_TYPE_ICONS.pdf} alt="PDF" className="w-6 h-6" />;
      if (iconType === 'docx') return <img src={FILE_TYPE_ICONS.docx} alt="Word" className="w-6 h-6" />;
      if (iconType === 'json' || iconType === 'file-code') return <img src={FILE_TYPE_ICONS.json} alt="JSON" className="w-6 h-6" />;
      if (iconType === 'snowflake') return <img src={FILE_TYPE_ICONS.snowflake} alt="Snowflake" className="w-6 h-6" />;
    }

    // If no specific icon, use a default based on type
    switch (source.type) {
      case 'database':
        // Check if it's a snowflake database
        if (source.dataSourceType === 'snowflake' || 
            (source.originalSource?.metadata?.warehouseType === 'snowflake')) {
          return <img src={FILE_TYPE_ICONS.snowflake} alt="Snowflake" className="w-6 h-6" />;
        }
        return <Database className="w-6 h-6 text-blue-500" />;
      case 'local-files':
        return <FolderOpen className="w-6 h-6 text-amber-500" />;
      case 'storage':
        return <FolderOpen className="w-6 h-6 text-green-500" />;
      case 'api':
        return <ExternalLink className="w-6 h-6 text-purple-500" />;
      default:
        return <FileType className="w-6 h-6 text-gray-500" />;
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(source.id)}
      className={`
        w-full text-left overflow-hidden transition-all duration-200 relative
        ${isSelected
          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 ring-2 ring-purple-300 dark:ring-purple-700' 
          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 ring-1 ring-gray-200 dark:ring-gray-700'} 
        rounded-xl
      `}
    >
      <div className="flex items-center p-3">
        <div className={`
          w-12 h-12 rounded-lg flex items-center justify-center mr-3 flex-shrink-0
          ${isSelected 
            ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300'}
        `}>
          {renderIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`
            text-sm font-semibold line-clamp-1
            ${isSelected ? 'text-purple-800 dark:text-purple-300' : 'text-gray-900 dark:text-white'}
          `}>
            {source.name}
          </h3>
          
          <div className="flex items-center mt-1.5">
            <span className={`
              text-xs px-2 py-0.5 rounded-full
              ${isSelected 
                ? 'bg-purple-200 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}
            `}>
              {source.type}
            </span>
            
            {source.lastSynced && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mr-1"></span>
                {new Date(source.lastSynced).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        {isSelected && (
          <div className="ml-2 flex-shrink-0">
            <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
        )}
        
        <ChevronRight className={`
          w-4 h-4 flex-shrink-0 ml-1
          ${isSelected ? 'text-purple-400 dark:text-purple-500' : 'text-gray-300 dark:text-gray-600'}
        `} />
      </div>
      
      {isSelected && (
        <motion.div 
          layoutId="activeSourceIndicator"
          className="absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-purple-500 to-indigo-600"
        />
      )}
    </motion.button>
  );
}; 