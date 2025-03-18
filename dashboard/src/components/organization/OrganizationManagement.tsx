import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { OrganizationModal } from './OrganizationModal';
import { Building2, ChevronRight, Plus, Users, Settings as SettingsIcon, Trash2, PencilLine, ArrowLeft } from 'lucide-react';
import { buildApiUrl } from '../../api-config';

export function OrganizationManagement() {
  const { organizations, currentOrganization, loadOrganizations, setCurrentOrganization } = useOrganization();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<typeof organizations[0] | undefined>();
  const [activeTab, setActiveTab] = useState<'general' | 'teams' | 'settings'>('general');
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check for mobile view on mount and when window resizes
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      
      // If switching to desktop view, always show the list
      if (!mobile) {
        setShowMobileList(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When an org is selected on mobile, switch to details view
  useEffect(() => {
    if (isMobileView && currentOrganization) {
      setShowMobileList(false);
    }
  }, [currentOrganization, isMobileView]);

  const handleDelete = async (orgId: number) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this organization? This action cannot be undone.");
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Use buildApiUrl to get the correct URL for the current environment
      const apiUrl = buildApiUrl(`/api/organizations/${orgId}`);
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete organization');
      }

      await loadOrganizations();
      setCurrentOrganization(null);
      // Show list again on mobile after deleting
      if (isMobileView) {
        setShowMobileList(true);
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      // TODO: Show error message to user
    } finally {
      setIsDeleting(false);
    }
  };

  const getLogoUrl = (logoPath: string | undefined | null): string | undefined => {
    if (!logoPath) return undefined;
    
    // First try to load the actual logo from the server
    const actualLogoUrl = logoPath;
    
    // Use an inline SVG data URL as a fallback if the image fails to load
    // Note: This fallback is defined but not used - the fallback rendering should
    // be handled in the component's JSX with an onError handler
    
    return actualLogoUrl;
  };

  const renderOrganizationsList = () => (
    <div className={`${isMobileView ? 'w-full' : 'w-80'} border-r border-gray-100 dark:border-gray-800 h-full overflow-y-auto bg-white dark:bg-gray-900 ${isMobileView && !showMobileList ? 'hidden' : 'block'}`}>
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-900/95">
        <button
          onClick={() => {
            setSelectedOrganization(undefined);
            setIsModalOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 
            bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700
            text-white rounded-xl hover:from-purple-600 hover:to-purple-700 
            dark:hover:from-purple-500 dark:hover:to-purple-600
            shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30
            focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-600
            transition-all duration-200"
        >
          <Plus size={18} />
          <span className="font-medium">New Organization</span>
        </button>
      </div>
      <div className="space-y-1 p-3">
        {organizations.map((org) => (
          <button
            key={org.id}
            onClick={() => setCurrentOrganization(org)}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group 
              transition-all duration-200
              ${currentOrganization?.id === org.id 
                ? 'bg-purple-50 dark:bg-purple-900/20 shadow-sm dark:shadow-purple-900/20' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
          >
            <div className="flex items-center gap-3">
              {org.logo_url ? (
                <img 
                  src={getLogoUrl(org.logo_url)} 
                  alt="" 
                  className="w-10 h-10 rounded-lg object-cover ring-2 ring-purple-500/20"
                  onError={(e) => {
                    // Use fallback SVG if image fails to load
                    e.currentTarget.src = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3crect width="18" height="18" x="3" y="3" rx="2" ry="2"%3e%3c/rect%3e%3crect width="8" height="8" x="8" y="8" rx="1" ry="1"%3e%3c/rect%3e%3c/svg%3e';
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 
                  shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 
                  flex items-center justify-center">
                  <Building2 size={20} className="text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <span className={`text-sm font-medium ${
                  currentOrganization?.id === org.id
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>{org.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">5 members</span>
              </div>
            </div>
            <ChevronRight size={16} className={`transition-all duration-200 ${
              currentOrganization?.id === org.id
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-400 opacity-0 group-hover:opacity-100'
            }`} />
          </button>
        ))}
      </div>
    </div>
  );

  const renderOrganizationDetails = () => {
    if (!currentOrganization) {
      return (
        <div className={`flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${isMobileView && showMobileList ? 'hidden' : 'block'}`}>
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 
              shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 
              flex items-center justify-center mx-auto mb-6">
              <Building2 size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select an organization</h3>
            <p className="text-gray-500 dark:text-gray-400">Choose an organization from the list or create a new one to get started</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 ${isMobileView && showMobileList ? 'hidden' : 'block'}`}>
        {/* Organization Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Back button for mobile view */}
            {isMobileView && (
              <button 
                onClick={() => setShowMobileList(true)}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-2"
              >
                <ArrowLeft size={18} />
                <span className="text-sm font-medium">Back to organizations</span>
              </button>
            )}
            
            <div className="flex items-center gap-4">
              {currentOrganization.logo_url ? (
                <img 
                  src={getLogoUrl(currentOrganization.logo_url)} 
                  alt="" 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover ring-2 ring-purple-500/20"
                  onError={(e) => {
                    // Use fallback SVG if image fails to load
                    e.currentTarget.src = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3crect width="18" height="18" x="3" y="3" rx="2" ry="2"%3e%3c/rect%3e%3crect width="8" height="8" x="8" y="8" rx="1" ry="1"%3e%3c/rect%3e%3c/svg%3e';
                  }}
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 
                  shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 
                  flex items-center justify-center">
                  <Building2 size={24} className="text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{currentOrganization.name}</h1>
                {currentOrganization.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{currentOrganization.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedOrganization(currentOrganization);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                  hover:text-purple-600 dark:hover:text-purple-400 
                  hover:bg-purple-50 dark:hover:bg-purple-900/20 
                  rounded-lg transition-all duration-200"
              >
                <PencilLine size={16} />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => handleDelete(currentOrganization.id)}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium text-red-600 dark:text-red-400 
                  hover:bg-red-50 dark:hover:bg-red-900/20 
                  rounded-lg transition-all duration-200"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 sm:gap-6 mt-6 sm:mt-8 overflow-x-auto pb-1 -mb-px">
            {[
              { id: 'general', label: 'General', icon: Building2 },
              { id: 'teams', label: 'Teams', icon: Users },
              { id: 'settings', label: 'Settings', icon: SettingsIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 pb-3 border-b-2 whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon size={16} className="flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-gray-900/30">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Overview</h2>
              {/* Add overview content */}
            </div>
          )}
          {activeTab === 'teams' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Teams</h2>
                <button className="flex items-center justify-center gap-2 px-4 py-2 
                  bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700
                  text-white rounded-lg hover:from-purple-600 hover:to-purple-700 
                  shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30
                  transition-all duration-200">
                  <Plus size={18} />
                  <span className="font-medium">Create Team</span>
                </button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-gray-900/30">
                {/* Add teams list */}
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-gray-900/30">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Settings</h2>
              {/* Add settings content */}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
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