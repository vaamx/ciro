import React, { useState } from 'react';
import { Database, Plus, RefreshCw, Trash2, AlertCircle } from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
}

const mockDataSources: DataSource[] = [
  {
    id: '1',
    name: 'Main Database',
    type: 'PostgreSQL',
    status: 'connected',
    lastSync: '5 mins ago'
  },
  {
    id: '2',
    name: 'Analytics DB',
    type: 'MySQL',
    status: 'connected',
    lastSync: '10 mins ago'
  },
  {
    id: '3',
    name: 'Legacy System',
    type: 'MongoDB',
    status: 'error',
    lastSync: '1 hour ago'
  }
];

export function DataSourceManager() {
  const [dataSources] = useState<DataSource[]>(mockDataSources);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const getStatusColor = (status: DataSource['status']) => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'disconnected':
        return 'text-gray-500';
      case 'error':
        return 'text-red-500';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Data Sources</h2>
        <button
          onClick={() => setIsAddingNew(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Source</span>
        </button>
      </div>

      <div className="space-y-4">
        {dataSources.map((source) => (
          <div
            key={source.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{source.name}</h3>
                  <p className="text-sm text-gray-500">{source.type}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {source.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={`text-sm ${getStatusColor(source.status)}`}>
                  {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Last synced: {source.lastSync}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                  aria-label="Refresh connection"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  aria-label="Remove connection"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Data Source Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add New Data Source</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-lg"
                  placeholder="My Data Source"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select className="w-full p-2 border border-gray-200 rounded-lg">
                  <option>PostgreSQL</option>
                  <option>MySQL</option>
                  <option>MongoDB</option>
                  <option>REST API</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection String
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-lg"
                  placeholder="***REMOVED***://username:password@host:port/database"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button className="btn-primary">
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}