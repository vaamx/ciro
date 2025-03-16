import React, { useState, useEffect } from 'react';
import { X, Calendar, Database, FileType, Clock, AlertCircle, BarChart2, Cpu, HardDrive, History } from 'lucide-react';
import { DataSource } from './types';

interface DataSourceDetailsModalProps {
  source: DataSource | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (sourceId: string, updates: Partial<DataSource>) => void;
}

export const DataSourceDetailsModal: React.FC<DataSourceDetailsModalProps> = ({
  source,
  isOpen,
  onClose,
  onUpdate
}) => {
  // Early return if the modal shouldn't be open or if source is null
  if (!isOpen || !source) {
    return null;
  }

  const [activeTab, setActiveTab] = useState('overview');
  const [sourceName, setSourceName] = useState('');
  const [sourceDescription, setSourceDescription] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  
  // Update form state when source changes
  useEffect(() => {
    if (source) {
      setSourceName(source?.name || '');
      setSourceDescription(source?.description || '');
    }
  }, [source]);
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const formatFileSize = (bytes?: number) => {
    // Check if bytes is undefined, null, or not a valid number
    if (bytes === undefined || bytes === null || isNaN(bytes) || typeof bytes !== 'number') {
      return 'Unknown';
    }
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };
  
  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusColors = {
      connected: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      syncing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      disconnected: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  const getSourceTypeIcon = (type?: string) => {
    switch (type) {
      case 'local-files':
        return <FileType className="w-5 h-5 text-blue-500" />;
      case '***REMOVED***ql':
      case 'mysql':
      case 'oracle':
      case 'sqlserver':
        return <Database className="w-5 h-5 text-purple-500" />;
      case 'snowflake':
        return <HardDrive className="w-5 h-5 text-cyan-500" />;
      default:
        return <Database className="w-5 h-5 text-gray-500" />;
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: Partial<DataSource> = {};
    
    if (sourceName !== source?.name) {
      updates.name = sourceName;
    }
    
    if (sourceDescription !== source?.description) {
      updates.description = sourceDescription;
    }
    
    if (Object.keys(updates).length > 0 && source?.id) {
      onUpdate(source?.id, updates);
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {getSourceTypeIcon(source?.type)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                {source?.name}
                {getStatusBadge(source?.status)}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {source?.description || `${source?.type} data source`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-4 px-5">
            <button
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schema'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('schema')}
            >
              Schema
            </button>
            <button
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </nav>
        </div>
        
        {/* Modal Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Data Source Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="flex items-start">
                    <Calendar className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</p>
                      <p className="text-sm text-gray-900 dark:text-white">{formatDate(source?.lastSync)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Clock className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</p>
                      <p className="text-sm text-gray-900 dark:text-white">{formatDate(source?.lastSync)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Database className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</p>
                      <p className="text-sm text-gray-900 dark:text-white capitalize">{source?.type}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <BarChart2 className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Records</p>
                      <p className="text-sm text-gray-900 dark:text-white">{source?.metrics?.records?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* File-specific Info */}
              {source?.type === 'local-files' && source?.metadata && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">File Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="flex items-start">
                      <FileType className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">File Name</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {source?.metadata?.filename || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <HardDrive className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">File Size</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {formatFileSize(source?.metadata?.size)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <FileType className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">File Type</p>
                        <p className="text-sm text-gray-900 dark:text-white capitalize">
                          {source?.metadata?.fileType || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Performance Metrics */}
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sync Rate</p>
                      <Cpu className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{source?.metrics?.syncRate || 0}/min</p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Sync Time</p>
                      <Clock className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{source?.metrics?.avgSyncTime || '0s'}</p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Records</p>
                      <Database className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{source?.metrics?.records?.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
              
              {/* Last Error */}
              {source?.metrics?.lastError && (
                <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Last Error</h4>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                        {typeof source?.metrics?.lastError === 'string'
                          ? source?.metrics?.lastError
                          : (source?.metrics?.lastError as { message: string })?.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'schema' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Schema Information</h3>
              
              {source?.type === 'local-files' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Column Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data Type</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sample Data</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {source?.metadata?.metadata?.schema ? (
                        Object.entries(source?.metadata?.metadata?.schema as Record<string, any>).map(([column, info], index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{column}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{info.type || 'Unknown'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{info.sample || 'N/A'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No schema information available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              {source?.type !== 'local-files' && (
                <div className="text-center py-8">
                  <Database className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Schema information not available</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Schema details for database sources will appear here.</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Sync History</h3>
              
              {/* Mocked sync history for now */}
              <div className="relative">
                <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                
                <ul className="space-y-6">
                  {[1, 2, 3].map((item) => (
                    <li key={item} className="relative pl-14">
                      <div className="absolute left-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 border-4 border-white dark:border-gray-800">
                        <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            Sync {item === 1 ? 'Completed' : item === 2 ? 'In Progress' : 'Failed'}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item === 1 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                              : item === 2 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {item === 1 ? 'Success' : item === 2 ? 'In Progress' : 'Failed'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(new Date(Date.now() - item * 86400000).toISOString())}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                          {item === 1 
                            ? 'Successfully synchronized 1,240 records in 1.2 seconds.'
                            : item === 2
                              ? 'Synchronizing data, please wait...'
                              : 'Failed to synchronize: Connection timeout after 30 seconds.'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="data-source-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Source Name
                  </label>
                  <input
                    type="text"
                    id="data-source-name"
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="data-source-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="data-source-description"
                    rows={3}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={sourceDescription}
                    onChange={(e) => setSourceDescription(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="auto-sync"
                      name="auto-sync"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                    />
                    <label htmlFor="auto-sync" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Enable automatic synchronization
                    </label>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Danger Zone</h4>
                  <div className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Delete Data Source</h3>
                        <div className="mt-2">
                          <p className="text-sm text-red-700 dark:text-red-400">
                            Permanently delete this data source and all associated data. This action cannot be undone.
                          </p>
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          >
                            Delete Data Source
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="bg-gray-50 dark:bg-gray-750 px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650"
          >
            Close
          </button>
          {activeTab === 'settings' && (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 