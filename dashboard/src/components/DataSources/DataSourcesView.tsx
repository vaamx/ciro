import React, { useState, useEffect } from 'react';
import { useDataSources } from '../../contexts/DataSourcesContext';
import { useNotification } from '../../contexts/NotificationContext';
import { AddDataSourceWizard } from './AddDataSourceWizard';
import { DataSourceCard } from './DataSourceCard';
import SnowflakeConnectionForm from './SnowflakeConnectionForm';
import { DataSource } from './types';
import { PlusIcon, SearchIcon, FilterIcon, RefreshCwIcon } from 'lucide-react';
import { DataSourceDetailsModal } from './DataSourceDetailsModal';
import { useOrganization } from '../../contexts/OrganizationContext';

export const DataSourcesView: React.FC = () => {
  const { 
    dataSources, 
    isLoading, 
    error, 
    refreshDataSources, 
    deleteDataSource, 
    updateDataSource,
    showSnowflakeForm,
    setShowSnowflakeForm,
    isPaused,
    setPausePolling
  } = useDataSources();
  
  const { showNotification } = useNotification();
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSourceWizard, setShowAddSourceWizard] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  
  // Import the organization context to check if it's still loading
  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
  
  // Pause polling when in empty state - but not during initial loading or organization loading
  useEffect(() => {
    // Don't pause polling if we're still in any loading state (data or organization)
    if (isLoading || isOrgLoading || !currentOrganization) {
      return;
    }
    
    // If there are no data sources after all loading is complete, pause polling to prevent unnecessary refreshes
    if (dataSources.length === 0 && !isPaused) {
      setPausePolling(true);
    } 
    // Resume polling when data sources are added
    else if (dataSources.length > 0 && isPaused) {
      setPausePolling(false);
    }
  }, [dataSources.length, isPaused, setPausePolling, isLoading, isOrgLoading, currentOrganization]);
  
  // Filter sources based on search term and filter type
  const filteredSources = dataSources.filter(source => {
    const matchesSearch = !searchTerm || 
      source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = !filterType || source.type === filterType;
    
    return matchesSearch && matchesFilter;
  });
  
  // Event handlers
  const handleAddDataSourceWrapper = (newSource: any) => {
    console.log('Processing new data source:', newSource);
    
    // If it's a Snowflake data source, show the connection form
    if (newSource.type === 'snowflake') {
      console.log('Setting showSnowflakeForm to true');
      setShowSnowflakeForm(true);
    }
    
    // Resume polling when a data source is added
    setPausePolling(false);
    
    setShowAddSourceWizard(false);
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await deleteDataSource(sourceId);
    } catch (error) {
      console.error('Error in handleDeleteSource:', error);
    }
  };
  
  const handleRefreshAll = () => {
    refreshDataSources();
    showNotification({ type: 'info', message: 'Refreshing data sources...' });
  };
  
  const handleSnowflakeConnectionSuccess = (dataSource: any) => {
    setShowSnowflakeForm(false);
    // Resume polling when a Snowflake connection is successful
    setPausePolling(false);
    refreshDataSources();
    showNotification({ 
      type: 'success', 
      message: `Successfully connected to Snowflake: ${dataSource.name}` 
    });
  };
  
  // Handle viewing details for a data source
  const handleViewDetails = (source: DataSource) => {
    setSelectedSource(source);
    setIsModalOpen(true);
  };
  
  if (isLoading && dataSources.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Data Sources</h1>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search data sources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      </div>

          <div className="flex gap-2">
          <button
              onClick={() => setFilterType(filterType ? null : 'local-files')}
              className={`px-3 py-2 rounded-lg flex items-center space-x-2 text-sm ${
                filterType === 'local-files' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
              }`}
            >
              <FilterIcon className="h-4 w-4" />
              <span>Files Only</span>
          </button>
            
            <button
              onClick={handleRefreshAll}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 flex items-center space-x-2 text-sm"
            >
              <RefreshCwIcon className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            
              <button
              onClick={() => setShowAddSourceWizard(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center space-x-2 text-sm"
              >
              <PlusIcon className="h-4 w-4" />
              <span>Add Source</span>
              </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSources.length > 0 ? (
          filteredSources.map((source) => (
              <DataSourceCard
            key={source.id}
              source={source as any}
              onRefresh={() => refreshDataSources()}
                onDelete={handleDeleteSource}
                onViewDetails={handleViewDetails}
            />
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center">
            {searchTerm || filterType ? (
              // Search or filter with no results
              <div className="text-center max-w-md">
                <div className="mb-4 bg-gray-100 dark:bg-gray-700 rounded-full p-4 inline-block">
                  <SearchIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No matching data sources
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No data sources match your search criteria. Try adjusting your filters or search terms.
                </p>
                <button 
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType(null);
                  }}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              // Empty state - no data sources at all
              <div className="text-center max-w-md">
                <div className="mb-6 relative">
                  <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto">
                    <PlusIcon className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-purple-100/50 dark:bg-purple-900/10 rounded-full animate-pulse" style={{ animationDuration: '3s' }}></div>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No data sources yet
                </h3>
                
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Connect your first data source to start analyzing and visualizing your data.
                </p>
                
                <button
                  onClick={() => setShowAddSourceWizard(true)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm hover:shadow flex items-center justify-center mx-auto"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Your First Data Source
                </button>
                
                <div className="mt-8 grid grid-cols-3 gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="font-medium mb-1">Upload Files</p>
                    <p>CSV, Excel, PDF</p>
                  </div>
                  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="font-medium mb-1">Connect Database</p>
                    <p>SQL, NoSQL, Data Warehouses</p>
                  </div>
                  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="font-medium mb-1">Business Apps</p>
                    <p>Salesforce, SAP, Oracle</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSource && (
        <DataSourceDetailsModal
          source={selectedSource}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdate={updateDataSource}
        />
      )}
      
      {showAddSourceWizard && (
        <AddDataSourceWizard
          isOpen={showAddSourceWizard}
          onClose={() => setShowAddSourceWizard(false)}
          onAdd={handleAddDataSourceWrapper as any}
        />
      )}
      
      {showSnowflakeForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/70 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <SnowflakeConnectionForm
              onConnectionSuccess={handleSnowflakeConnectionSuccess}
              onCancel={() => setShowSnowflakeForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 