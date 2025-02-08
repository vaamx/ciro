import React, { useState, useEffect } from 'react';
import { 
  Database,
  Plus,
  Search,
  Filter,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  History,
  X,
  Loader2,
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { DataSource, DataSourceStatus } from './types';
import { AddDataSourceWizard } from './AddDataSourceWizard';
import { mockDataSources } from './constants';

const sourceCategories = [
  { id: 'all', name: 'All Sources' },
  { id: 'database', name: 'Databases' },
  { id: 'warehouse', name: 'Data Warehouses' },
  { id: 'crm', name: 'CRM Systems' },
  { id: 'analytics', name: 'Analytics Tools' }
];

interface SourceDetailsModalProps {
  source: DataSource | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (sourceId: string, updates: Partial<DataSource>) => void;
}

const SourceDetailsModal: React.FC<SourceDetailsModalProps> = ({
  source,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [formData, setFormData] = useState<Partial<DataSource>>({});

  useEffect(() => {
    if (source) {
      setFormData({
        name: source.name,
        description: source.description,
        type: source.type
      });
    }
  }, [source]);

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Source Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              source.status === 'connected'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : source.status === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : source.status === 'syncing'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
            </span>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <input
                type="text"
                value={formData.type || ''}
                readOnly
                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* HubSpot Data */}
          {source.type === 'crm-hubspot' && source.data && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">HubSpot Data</h4>
              
              {/* Contacts */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <h5 className="text-md font-medium text-gray-900 dark:text-white mb-4">Contacts ({source.data.contacts.total})</h5>
                <div className="space-y-4">
                  {source.data.contacts.records?.map((contact: any) => (
                    <div key={contact.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {contact.properties.firstname} {contact.properties.lastname}
                          </p>
                          {contact.properties.email && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {contact.properties.email}
                            </p>
                          )}
                        </div>
                        <div>
                          {contact.properties.phone && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {contact.properties.phone}
                            </p>
                          )}
                          {contact.properties.company && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {contact.properties.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Companies */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <h5 className="text-md font-medium text-gray-900 dark:text-white mb-4">Companies ({source.data.companies.total})</h5>
                <div className="space-y-4">
                  {source.data.companies.records?.map((company: any) => (
                    <div key={company.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {company.properties.name}
                          </p>
                          {company.properties.website && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {company.properties.website}
                            </p>
                          )}
                        </div>
                        <div>
                          {company.properties.industry && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Industry: {company.properties.industry}
                            </p>
                          )}
                          {company.properties.phone && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {company.properties.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deals */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <h5 className="text-md font-medium text-gray-900 dark:text-white mb-4">Deals ({source.data.deals.total})</h5>
                {source.data.deals.total === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No deals found</p>
                ) : (
                  <div className="space-y-4">
                    {source.data.deals.records?.map((deal: any) => (
                      <div key={deal.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {deal.properties.dealname}
                            </p>
                            {deal.properties.amount && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Amount: ${deal.properties.amount}
                              </p>
                            )}
                          </div>
                          <div>
                            {deal.properties.dealstage && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Stage: {deal.properties.dealstage}
                              </p>
                            )}
                            {deal.properties.closedate && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Close Date: {new Date(deal.properties.closedate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Performance Metrics</h4>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Records</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {(source.metrics?.records ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sync Rate</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {source.metrics.syncRate}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Sync Time</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {source.metrics.avgSyncTime}
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {source.metrics.lastError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                <p className="text-sm text-red-600 dark:text-red-400">
                  Last Error: {source.metrics.lastError}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onUpdate(source.id, formData);
                onClose();
              }}
              className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const fetchHubSpotData = async (dataSource: DataSource) => {
  try {
    // Fetch contacts with all properties
    const contactsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/contacts?properties=firstname,lastname,email,phone,company,jobtitle,city,state,country,zip,lifecyclestage,lastmodifieddate,createdate,associatedcompanyid&limit=100', {
      headers: { 'Accept': 'application/json' }
    });
    const contactsData = await contactsResponse.json();

    // Fetch companies with all properties
    const companiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/companies?properties=domain,name,hubspot_owner_id,industry,type,city,state,postal_code,numberofemployees,annualrevenue,timezone,description,linkedin_company_page,createdate,lastmodifieddate&limit=100');
    const companiesData = await companiesResponse.json();

    // Fetch deals with all properties
    const dealsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/deals?properties=dealname,amount,dealstage,pipeline,closedate,createdate,lastmodifieddate,hubspot_owner_id,associated_company,associated_vids&limit=100');
    const dealsData = await dealsResponse.json();

    // Fetch recent activities using the correct v3 endpoint
    const activitiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/activities/feed?limit=100');
    const activitiesData = await activitiesResponse.json();

    // Calculate total records - using the correct HubSpot API response structure
    const totalRecords = 
      (contactsData?.total || contactsData?.results?.length || 0) +
      (companiesData?.total || companiesData?.results?.length || 0) +
      (dealsData?.total || dealsData?.results?.length || 0);

    return {
      ...dataSource,
      status: 'connected' as const,
      lastSync: new Date().toISOString(),
      metrics: {
        records: totalRecords,
        syncRate: 100,
        avgSyncTime: '0s'
      },
      data: {
        contacts: {
          total: contactsData?.total || contactsData?.results?.length || 0,
          synced: contactsData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: contactsData?.results || contactsData?.objects || []
        },
        companies: {
          total: companiesData?.total || companiesData?.results?.length || 0,
          synced: companiesData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: companiesData?.results || companiesData?.objects || []
        },
        deals: {
          total: dealsData?.total || dealsData?.results?.length || 0,
          synced: dealsData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: dealsData?.results || dealsData?.objects || []
        },
        activities: {
          total: activitiesData?.total || activitiesData?.results?.length || 0,
          synced: activitiesData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: activitiesData?.results || activitiesData?.objects || []
        }
      }
    };
  } catch (error) {
    console.error('Error fetching HubSpot data:', error);
    throw error;
  }
};

const restoreHubSpotConnection = async () => {
  const sessionToken = localStorage.getItem('hubspot_session_token');
  if (sessionToken) {
    // Set the session token in a cookie
    document.cookie = `session_token=${sessionToken}; path=/`;
    return true;
  }
  return false;
};

export const DataSourcesView: React.FC = () => {
  const { showNotification } = useNotification();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filteredSources, setFilteredSources] = useState<DataSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);

  // Load data sources from local storage on initial mount
  useEffect(() => {
    const loadDataSources = async () => {
      try {
        const savedSources = localStorage.getItem('dataSources');
        if (savedSources) {
          const parsedSources = JSON.parse(savedSources);
          setFilteredSources(parsedSources);
        } else {
          setFilteredSources(mockDataSources); // Use default sources if none saved
        }
      } catch (error) {
        console.error('Error loading data sources:', error);
        setFilteredSources(mockDataSources);
      } finally {
        setIsLoading(false);
      }
    };

    loadDataSources();
  }, []);

  // Save data sources to local storage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('dataSources', JSON.stringify(filteredSources));
    }
  }, [filteredSources, isLoading]);

  // Filter sources based on search and category
  useEffect(() => {
    const filtered = filteredSources.filter(source => {
      const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (source.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || source.type === activeCategory;
      return matchesSearch && matchesCategory;
    });
    
    if (searchQuery || activeCategory !== 'all') {
      setFilteredSources(filtered);
    }
  }, [searchQuery, activeCategory]);

  // Add this effect to restore connections on mount
  useEffect(() => {
    const restoreConnections = async () => {
      try {
        const hasRestoredHubSpot = await restoreHubSpotConnection();
        
        if (hasRestoredHubSpot) {
          // Refresh HubSpot data for all HubSpot sources
          const updatedSources = await Promise.all(
            filteredSources.map(async (source) => {
              if (source.type === 'crm-hubspot') {
                try {
                  // Fetch fresh data
                  const contactsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/contacts', {
                    headers: { 'Accept': 'application/json' }
                  });
                  const contactsData = await contactsResponse.json();

                  const companiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/companies');
                  const companiesData = await companiesResponse.json();

                  const dealsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/deals');
                  const dealsData = await dealsResponse.json();

                  // Update the source with fresh data
                  return {
                    ...source,
                    status: 'connected' as const,
                    lastSync: new Date().toISOString(),
                    data: {
                      contacts: {
                        total: contactsData._metadata?.total || 0,
                        synced: contactsData.records?.length || 0,
                        lastSync: new Date().toISOString(),
                        records: contactsData.records || []
                      },
                      companies: {
                        total: companiesData._metadata?.total || 0,
                        synced: companiesData.records?.length || 0,
                        lastSync: new Date().toISOString(),
                        records: companiesData.records || []
                      },
                      deals: {
                        total: dealsData._metadata?.total || 0,
                        synced: dealsData.records?.length || 0,
                        lastSync: new Date().toISOString(),
                        records: dealsData.records || []
                      }
                    },
                    metrics: {
                      records: (contactsData._metadata?.total || 0) + 
                              (companiesData._metadata?.total || 0) + 
                              (dealsData._metadata?.total || 0),
                      syncRate: 100,
                      avgSyncTime: '0s'
                    }
                  };
                } catch (error) {
                  console.error('Error refreshing HubSpot data:', error);
                  return {
                    ...source,
                    status: 'error' as const,
                    metrics: {
                      ...source.metrics,
                      lastError: 'Failed to refresh HubSpot data'
                    }
                  };
                }
              }
              return source;
            })
          );

          setFilteredSources(updatedSources);
        }
      } catch (error) {
        console.error('Error restoring connections:', error);
      }
    };

    restoreConnections();
  }, []);

  const handleAddDataSource = async (newSource: Partial<DataSource>) => {
    try {
      setIsLoading(true);
      
      // Create the data source
      const createdSource: DataSource = {
        id: Date.now().toString(),
        name: newSource.name || '',
        type: newSource.type || 'database',
        description: newSource.description || '',
        status: 'connected',
        lastSync: new Date().toISOString(),
        metrics: {
          records: 0,
          syncRate: 0,
          avgSyncTime: '0s'
        }
      };

      // If it's a HubSpot source, fetch the data
      if (newSource.type === 'crm-hubspot') {
        try {
          // Fetch contacts
          const contactsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/contacts', {
            headers: { 'Accept': 'application/json' }
          });
          const contactsData = await contactsResponse.json();

          // Fetch companies
          const companiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/companies');
          const companiesData = await companiesResponse.json();

          // Fetch deals
          const dealsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/deals');
          const dealsData = await dealsResponse.json();

          // Create the complete source with data
          const newSource: DataSource = {
            ...createdSource,
            status: 'connected' as const,
            data: {
              contacts: {
                total: contactsData._metadata?.total || 0,
                synced: contactsData.results?.length || 0,
                lastSync: new Date().toISOString(),
                records: contactsData.records || []
              },
              companies: {
                total: companiesData._metadata?.total || 0,
                synced: companiesData.results?.length || 0,
                lastSync: new Date().toISOString(),
                records: companiesData.records || []
              },
              deals: {
                total: dealsData._metadata?.total || 0,
                synced: dealsData.results?.length || 0,
                lastSync: new Date().toISOString(),
                records: dealsData.records || []
              }
            },
            metrics: {
              records: (contactsData._metadata?.total || 0) + 
                      (companiesData._metadata?.total || 0) + 
                      (dealsData._metadata?.total || 0),
              syncRate: 100,
              avgSyncTime: '0s'
            }
          };

          setFilteredSources(prev => [...prev, newSource]);
          
          // Store the session token
          const sessionToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('session_token='))
            ?.split('=')[1];
            
          if (sessionToken) {
            localStorage.setItem('hubspot_session_token', sessionToken);
          }
        } catch (error) {
          console.error('Error fetching HubSpot data:', error);
          const errorSource: DataSource = {
            ...createdSource,
            status: 'error',
            metrics: {
              records: 0,
              syncRate: 0,
              avgSyncTime: '0s',
              lastError: 'Failed to fetch HubSpot data'
            }
          };
          setFilteredSources(prev => [...prev, errorSource]);
        }
      } else {
        setFilteredSources(prev => [...prev, createdSource]);
      }

      showNotification('success', 'Data source added successfully');
    } catch (error) {
      console.error('Error adding data source:', error);
      showNotification('error', 'Failed to add data source');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedSources = filteredSources.filter(source => source.id !== sourceId);
      setFilteredSources(updatedSources);
      showNotification('success', 'Data source deleted successfully');
    } catch (error) {
      showNotification('error', 'Failed to delete data source');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSourceStatus = async (sourceId: string) => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedSources = filteredSources.map(source => {
        if (source.id === sourceId) {
          const newStatus: DataSource['status'] = source.status === 'connected' ? 'disconnected' : 'connected';
          return { ...source, status: newStatus };
        }
        return source;
      });
      
      setFilteredSources(updatedSources);
      showNotification('success', 'Data source status updated successfully');
    } catch (error) {
      showNotification('error', 'Failed to update data source status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshSource = async (sourceId: string) => {
    try {
      const source = filteredSources.find(s => s.id === sourceId);
      if (!source) return;

      const updatedSources = filteredSources.map(s => 
        s.id === sourceId ? { ...s, status: 'syncing' as DataSourceStatus } : s
      );
      setFilteredSources(updatedSources);

      if (source.type === 'crm-hubspot') {
        try {
          const refreshedSource = await fetchHubSpotData(source);
          const finalSources = filteredSources.map(s => 
            s.id === sourceId ? refreshedSource : s
          );
          
          setFilteredSources(finalSources);
          showNotification('success', 'Data source refreshed successfully');
        } catch (error) {
          console.error('Error refreshing HubSpot data:', error);
          const errorSources = filteredSources.map(s => 
            s.id === sourceId ? {
              ...s,
              status: 'error' as DataSourceStatus,
              metrics: {
                ...s.metrics,
                lastError: 'Failed to refresh HubSpot data'
              }
            } : s
          );
          setFilteredSources(errorSources);
          showNotification('error', 'Failed to refresh HubSpot data');
        }
      } else {
        const finalSources = updatedSources.map(s => 
          s.id === sourceId ? { ...s, status: 'connected' as DataSourceStatus } : s
        );
        setFilteredSources(finalSources);
        showNotification('success', 'Data source refreshed successfully');
      }
    } catch (error) {
      showNotification('error', 'Failed to refresh data source');
    }
  };

  const handleUpdateSource = async (sourceId: string, updates: Partial<DataSource>) => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedSources = filteredSources.map(source => 
        source.id === sourceId ? { ...source, ...updates } : source
      );
      
      setFilteredSources(updatedSources);
      showNotification('success', 'Data source updated successfully');
    } catch (error) {
      showNotification('error', 'Failed to update data source');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'syncing':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading data sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Data Sources</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connect and manage your data sources</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => showNotification('info', 'Viewing sync history...')}
            className="btn-secondary dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center space-x-2"
          >
            <History className="w-4 h-4" />
            <span>Sync History</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Connection</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search data sources..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex space-x-2">
          <button className="btn-secondary dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {sourceCategories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              activeCategory === category.id
                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Data Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSources.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <Database className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No data sources found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
              {searchQuery
                ? `No results found for "${searchQuery}". Try adjusting your search or filters.`
                : 'Get started by adding your first data source.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 btn-primary dark:bg-purple-700 dark:hover:bg-purple-600"
            >
              Add Data Source
            </button>
          </div>
        ) : (
          <>
            {filteredSources.map(source => (
          <div
            key={source.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{source.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{source.description}</p>
                  </div>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(source.status)}`}>
                  {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Records</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {(source.metrics?.records ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sync Rate</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {source.metrics.syncRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Sync</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {source.metrics.avgSyncTime}
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {source.metrics.lastError && (
                <div className="mt-4 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400">{source.metrics.lastError}</p>
                </div>
              )}

                  {/* Updated Actions */}
              <div className="mt-6 flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedSource(source)}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                    >
                  View Details
                </button>
                <div className="flex items-center space-x-2">
                  {source.status === 'connected' ? (
                        <button 
                          onClick={() => handleToggleSourceStatus(source.id)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                        >
                      <Pause className="w-5 h-5" />
                    </button>
                  ) : (
                        <button 
                          onClick={() => handleToggleSourceStatus(source.id)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                        >
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                      <button 
                        onClick={() => handleRefreshSource(source.id)}
                        className={`p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors ${
                          source.status === 'syncing' ? 'animate-spin' : ''
                        }`}
                      >
                        <RefreshCw className="w-5 h-5" />
                  </button>
                      <button 
                        onClick={() => handleDeleteSource(source.id)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
          </>
        )}

        {/* Add New Data Source Card */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-full min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
        >
          <div className="text-center">
            <Plus className="w-8 h-8 text-gray-400 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 mx-auto mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-300">
              Add New Data Source
            </span>
          </div>
        </button>
      </div>

      {/* Modals */}
      <AddDataSourceWizard
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddDataSource}
      />
      <SourceDetailsModal
        source={selectedSource}
        isOpen={!!selectedSource}
        onClose={() => setSelectedSource(null)}
        onUpdate={handleUpdateSource}
      />
    </div>
  );
}; 