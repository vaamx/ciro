import React, { useState } from 'react';
import { DataSource } from '../../types';
import { X, AlertCircle, CheckCircle, Database, Users, Building2, DollarSign, Mail, Phone, Globe, MapPin } from 'lucide-react';

interface DataSourceCardProps {
  dataSource: DataSource;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const DataSourceCard: React.FC<DataSourceCardProps> = ({ dataSource, onEdit, onDelete }) => {
  const [showDetails, setShowDetails] = useState(false);
  const isHubSpot = dataSource.type === 'crm-hubspot';
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{dataSource.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dataSource.description}</p>
              </div>
            </div>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              dataSource.status === 'connected' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {dataSource.status.charAt(0).toUpperCase() + dataSource.status.slice(1)}
            </div>
          </div>

          {/* Records Breakdown */}
          {isHubSpot && dataSource.data && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Contacts</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {dataSource.data.contacts.total.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Companies</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {dataSource.data.companies.total.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-yellow-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Deals</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {dataSource.data.deals.total.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                Last synced: {formatDate(dataSource.lastSync)}
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Records</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {dataSource.metrics?.records.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sync Rate</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {dataSource.metrics?.syncRate}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Sync</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {dataSource.metrics?.avgSyncTime}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button 
              onClick={() => setShowDetails(true)}
              className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
            >
              View Details
            </button>
            <div className="flex items-center space-x-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Data Source Details
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Status and Basic Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <div className="flex items-center mt-1">
                    {dataSource.status === 'connected' ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-white">
                      {dataSource.status.charAt(0).toUpperCase() + dataSource.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Sync</p>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {formatDate(dataSource.lastSync)}
                  </p>
                </div>
              </div>

              {/* File Preview for local files */}
              {dataSource.type === 'local-files' && dataSource.metadata?.preview && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">File Preview</h4>
                  <pre className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
                    {dataSource.metadata.preview}
                  </pre>
                </div>
              )}

              {/* HubSpot Data */}
              {isHubSpot && dataSource.data && (
                <div className="space-y-6">
                  {/* Contacts Section */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <div className="flex items-center mb-4">
                      <Users className="w-5 h-5 text-blue-500 mr-2" />
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        Contacts ({dataSource.data.contacts.total})
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {dataSource.data.contacts.total.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Synced</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {dataSource.data.contacts.synced.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Last Sync</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {formatDate(dataSource.data.contacts.lastSync)}
                          </p>
                        </div>
                      </div>

                      {/* Contact Records */}
                      {dataSource.data.contacts.records?.map((contact: any) => (
                        <div key={contact.id} className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                {contact.properties.firstname} {contact.properties.lastname}
                              </h5>
                              <div className="mt-1 space-y-1">
                                {contact.properties.email && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Mail className="w-3 h-3 mr-1" />
                                    {contact.properties.email}
                                  </div>
                                )}
                                {contact.properties.phone && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {contact.properties.phone}
                                  </div>
                                )}
                                {contact.properties.company && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    {contact.properties.company}
                                  </div>
                                )}
                              </div>
                            </div>
                            {contact.properties.lifecyclestage && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {contact.properties.lifecyclestage}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Companies Section */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <div className="flex items-center mb-4">
                      <Building2 className="w-5 h-5 text-green-500 mr-2" />
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        Companies ({dataSource.data.companies.total})
                      </h4>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {dataSource.data.companies.total.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Synced</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {dataSource.data.companies.synced.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Last Sync</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                            {formatDate(dataSource.data.companies.lastSync)}
                          </p>
                        </div>
                      </div>

                      {/* Company Records */}
                      {dataSource.data.companies.records?.map((company: any) => (
                        <div key={company.id} className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                {company.properties.name}
                              </h5>
                              <div className="mt-1 space-y-1">
                                {company.properties.website && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Globe className="w-3 h-3 mr-1" />
                                    {company.properties.website}
                                  </div>
                                )}
                                {company.properties.phone && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {company.properties.phone}
                                  </div>
                                )}
                                {company.properties.industry && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    {company.properties.industry}
                                  </div>
                                )}
                                {(company.properties.city || company.properties.state || company.properties.country) && (
                                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {[
                                      company.properties.city,
                                      company.properties.state,
                                      company.properties.country
                                    ].filter(Boolean).join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                            {company.properties.lifecyclestage && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                {company.properties.lifecyclestage}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Deals Section */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <div className="flex items-center mb-4">
                      <DollarSign className="w-5 h-5 text-yellow-500 mr-2" />
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        Deals ({dataSource.data.deals.total})
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                          {dataSource.data.deals.total.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Synced</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                          {dataSource.data.deals.synced.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Last Sync</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                          {formatDate(dataSource.data.deals.lastSync)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Metrics */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Sync Metrics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Records</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {dataSource.metrics?.records.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sync Rate</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {dataSource.metrics?.syncRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Sync Time</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {dataSource.metrics?.avgSyncTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 