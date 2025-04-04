import React, { useState, useEffect } from 'react';
import { Database, Search, X, ChevronRight, AlertCircle } from 'lucide-react';
import { useDataSources } from '../../contexts/DataSourcesContext';

interface MetricDataSourceSelectorProps {
  onSelectDataSource: (dataSource: any, query?: string) => void;
  selectedDataSourceId?: string;
  query?: string;
  onClose?: () => void;
}

export const MetricDataSourceSelector: React.FC<MetricDataSourceSelectorProps> = ({
  onSelectDataSource,
  selectedDataSourceId,
  query = '',
  onClose
}) => {
  const { dataSources, isLoading } = useDataSources();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [metricQuery, setMetricQuery] = useState(query || '');
  const [queryError, setQueryError] = useState('');

  // Filter data sources by search query
  const filteredDataSources = dataSources.filter(ds => 
    ds.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Find and set the initially selected data source
  useEffect(() => {
    if (selectedDataSourceId && dataSources.length > 0) {
      const source = dataSources.find(ds => ds.id === selectedDataSourceId);
      if (source) {
        setSelectedSource(source);
      }
    }
  }, [selectedDataSourceId, dataSources]);

  // Handle data source selection
  const handleSelectSource = (source: any) => {
    setSelectedSource(source);
  };

  // Handle query input change
  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMetricQuery(e.target.value);
    setQueryError('');
  };

  // Validate and finalize selection
  const handleConfirmSelection = () => {
    if (!selectedSource) {
      return;
    }

    // For data sources that require a query, validate it
    if (['snowflake', '***REMOVED***', 'mysql', 'qdrant'].includes(selectedSource.type)) {
      if (!metricQuery.trim()) {
        setQueryError('A query is required for this data source');
        return;
      }
    }

    onSelectDataSource(selectedSource, metricQuery);
  };

  // Render data source type icon
  const renderDataSourceIcon = (type: string) => {
    switch (type) {
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white">
          Connect to Data Source
        </h3>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Search data sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Sources List */}
      <div className="overflow-y-auto max-h-60">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading data sources...
          </div>
        ) : filteredDataSources.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No data sources found
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDataSources.map((source) => (
              <div 
                key={source.id}
                className={`p-3 flex items-center cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selectedSource?.id === source.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                }`}
                onClick={() => handleSelectSource(source)}
              >
                <div className={`p-2 rounded-full ${
                  selectedSource?.id === source.id 
                    ? 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-400' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {renderDataSourceIcon(source.type)}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{source.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{source.type}</p>
                </div>
                {selectedSource?.id === source.id && (
                  <ChevronRight className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Query Input (when a source is selected) */}
      {selectedSource && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Query {['snowflake', '***REMOVED***', 'mysql', 'qdrant'].includes(selectedSource.type) ? '(Required)' : '(Optional)'}
          </label>
          <textarea
            rows={3}
            className={`block w-full px-3 py-2 border ${
              queryError ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            } rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            placeholder={`Enter query to fetch metric value from ${selectedSource.name}...`}
            value={metricQuery}
            onChange={handleQueryChange}
          />
          {queryError && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
              <AlertCircle className="w-3.5 h-3.5 mr-1" />
              {queryError}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Example: "SELECT COUNT(*) FROM users WHERE created_at {'>'}  CURRENT_DATE - 30"
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end">
        <button
          onClick={handleConfirmSelection}
          disabled={!selectedSource}
          className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            !selectedSource
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500'
          }`}
        >
          Connect Data Source
        </button>
      </div>
    </div>
  );
}; 