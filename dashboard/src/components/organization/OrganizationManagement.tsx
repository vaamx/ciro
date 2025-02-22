import { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { OrganizationModal } from './OrganizationModal';
import { Building2, ChevronRight, Plus } from 'lucide-react';

export function OrganizationManagement() {
  const { organizations, currentOrganization, loadOrganizations, setCurrentOrganization } = useOrganization();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<typeof organizations[0] | undefined>();
  const [activeTab, setActiveTab] = useState<'general' | 'teams' | 'settings'>('general');

  const handleDelete = async (orgId: number) => {
    if (!window.confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete organization');
      }

      await loadOrganizations();
      setCurrentOrganization(null);
    } catch (error) {
      console.error('Error deleting organization:', error);
      // TODO: Show error message to user
    }
  };

  const getLogoUrl = (logoPath: string | undefined | null): string | undefined => {
    if (!logoPath) return undefined;
    // Avoid adding /files prefix if it's already there
    return logoPath.startsWith('/files') ? logoPath : `/files${logoPath}`;
  };

  const renderOrganizationsList = () => (
    <div className="w-64 border-r border-gray-700 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={() => {
            setSelectedOrganization(undefined);
            setIsModalOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <Plus size={16} />
          New Organization
        </button>
      </div>
      <div className="space-y-1 p-2">
        {organizations.map((org) => (
          <button
            key={org.id}
            onClick={() => setCurrentOrganization(org)}
            className={`w-full text-left px-4 py-3 rounded-md flex items-center justify-between group hover:bg-gray-700 ${
              currentOrganization?.id === org.id ? 'bg-gray-700' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              {org.logo_url ? (
                <img src={getLogoUrl(org.logo_url)} alt="" className="w-8 h-8 rounded-md" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-purple-600 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
              )}
              <span className="text-sm font-medium text-gray-200">{org.name}</span>
            </div>
            <ChevronRight size={16} className={`text-gray-400 opacity-0 group-hover:opacity-100 ${
              currentOrganization?.id === org.id ? 'opacity-100' : ''
            }`} />
          </button>
        ))}
      </div>
    </div>
  );

  const renderOrganizationDetails = () => {
    if (!currentOrganization) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Building2 size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-300">Select an organization</h3>
            <p className="text-sm text-gray-500 mt-2">Choose an organization from the list or create a new one</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col">
        {/* Organization Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentOrganization.logo_url ? (
                <img src={getLogoUrl(currentOrganization.logo_url)} alt="" className="w-12 h-12 rounded-lg" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Building2 size={24} />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold text-white">{currentOrganization.name}</h1>
                {currentOrganization.description && (
                  <p className="text-gray-400 mt-1">{currentOrganization.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedOrganization(currentOrganization);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white focus:outline-none"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(currentOrganization.id)}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 focus:outline-none"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`text-sm font-medium pb-2 border-b-2 ${
                activeTab === 'general'
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`text-sm font-medium pb-2 border-b-2 ${
                activeTab === 'teams'
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`text-sm font-medium pb-2 border-b-2 ${
                activeTab === 'settings'
                  ? 'text-purple-400 border-purple-400'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6">
          {activeTab === 'general' && (
            <div>
              {/* General organization information and stats would go here */}
              <h2 className="text-lg font-medium text-white mb-4">Organization Overview</h2>
              {/* Add overview content */}
            </div>
          )}
          {activeTab === 'teams' && (
            <div>
              {/* Teams management would go here */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-white">Teams</h2>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  Create Team
                </button>
              </div>
              {/* Add teams list */}
            </div>
          )}
          {activeTab === 'settings' && (
            <div>
              {/* Organization settings would go here */}
              <h2 className="text-lg font-medium text-white mb-4">Organization Settings</h2>
              {/* Add settings content */}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-gray-900">
      {renderOrganizationsList()}
      {renderOrganizationDetails()}
      
      <OrganizationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrganization(undefined);
        }}
        organization={selectedOrganization}
      />
    </div>
  );
} 