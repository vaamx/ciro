import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KnowledgeItem } from '../../types/knowledge';
import { useKnowledge } from '../../providers/KnowledgeProvider';
import { KnowledgeSourceSelector } from './KnowledgeSourceSelector';
import { RefreshKnowledgeButton } from './RefreshKnowledgeButton';
import { Search, Database, BookOpen, AlertCircle } from 'lucide-react';

interface KnowledgeSidebarProps {
  onItemSelect?: (item: KnowledgeItem) => void;
}

export const KnowledgeSidebar: React.FC<KnowledgeSidebarProps> = ({
  onItemSelect,
}) => {
  const [isExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);
  const { sources, activeSource, setActiveSource, isLoading, searchItems } = useKnowledge();

  const handleSourceSelect = (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    setActiveSource(source || null);
  };

  const handleSearch = async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    const results = await searchItems({ 
      query,
      sources: activeSource ? [activeSource.id] : undefined 
    });
    setSearchResults(results);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="w-80 bg-white dark:bg-gray-800 h-full overflow-y-auto"
      initial={{ x: '100%' }}
      animate={{ x: isExpanded ? 0 : '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Knowledge Base</h2>
            </div>
            <RefreshKnowledgeButton />
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
            />
          </div>
        </div>

        {/* Data Sources Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>Data Sources</span>
          </h3>
          
          {sources.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-full p-3 w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <Database className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                No data sources connected
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Connect your first data source to start using the knowledge base
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openDataSourcesView'))}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors duration-200"
              >
                Connect Data Source
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <KnowledgeSourceSelector
                  key={source.id}
                  source={source}
                  isSelected={activeSource?.id === source.id}
                  onSelect={handleSourceSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* Search Results */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>Search Results</span>
              </h3>
              
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors duration-200"
                      onClick={() => onItemSelect?.(item)}
                    >
                      <p className="text-sm text-gray-900 dark:text-white font-medium">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-full p-3 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No results found for "{searchQuery}"
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}; 