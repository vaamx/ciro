import React, { useState, useRef, useEffect } from 'react';
import { Bell, HelpCircle, Building2, Plus, Sun, Moon, Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  isDarkMode: boolean;
  onThemeChange: () => void;
  onMobileMenuClick?: () => void;
  user?: {
    name: string;
    role: string;
    avatar?: string;
  };
  dashboardManager?: React.ReactNode;
}

interface OrganizationSelectorProps {
  onCreateNew: () => void;
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({ onCreateNew }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();

  // Add a function to get the logo URL with the backend server URL
  const getLogoUrl = (logoPath: string | undefined | null): string | undefined => {
    if (!logoPath) return undefined;
    
    // If logoPath already starts with http or /, use it as-is
    if (logoPath.startsWith('http') || logoPath.startsWith('/')) {
      // If it starts with /files/, prepend the backend server URL
      if (logoPath.startsWith('/files/')) {
        return `http://localhost:3001${logoPath}`;
      }
      return logoPath;
    }
    
    // Otherwise, construct the full URL
    return `http://localhost:3001/files/${logoPath}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-xl 
          bg-white/5 hover:bg-white/10 dark:bg-gray-800/50 dark:hover:bg-gray-800/80
          border border-gray-200/10 dark:border-gray-700/50
          transition-all duration-200 group"
      >
        {currentOrganization?.logo_url ? (
          <img 
            src={getLogoUrl(currentOrganization.logo_url)} 
            alt="" 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-2 ring-purple-500/20"
            onError={(e) => {
              // Use fallback SVG if image fails to load
              e.currentTarget.src = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3crect width="18" height="18" x="3" y="3" rx="2" ry="2"%3e%3c/rect%3e%3crect width="8" height="8" x="8" y="8" rx="1" ry="1"%3e%3c/rect%3e%3c/svg%3e';
            }}
          />
        ) : (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 
            shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 
            flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors hidden sm:block">
            {currentOrganization?.name || 'Select Organization'}
          </span>
        </div>
        {organizations.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400">
            {organizations.length} {organizations.length === 1 ? 'org' : 'orgs'}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl 
          shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700/50 
          backdrop-blur-lg backdrop-saturate-150 py-2 z-[45]">
          <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
            Your Organizations
          </div>
          
          <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setCurrentOrganization(org);
                  // Save the selected organization as the active one
                  localStorage.setItem('active_organization_id', org.id.toString());
                  console.log(`Set active organization to: ${org.name} (ID: ${org.id})`);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 flex items-center gap-3 
                  hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200
                  ${currentOrganization?.id === org.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
              >
                {org.logo_url ? (
                  <img 
                    src={getLogoUrl(org.logo_url)} 
                    alt="" 
                    className="w-8 h-8 rounded-lg object-cover ring-2 ring-purple-500/20"
                    onError={(e) => {
                      // Use fallback SVG if image fails to load
                      e.currentTarget.src = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3crect width="18" height="18" x="3" y="3" rx="2" ry="2"%3e%3c/rect%3e%3crect width="8" height="8" x="8" y="8" rx="1" ry="1"%3e%3c/rect%3e%3c/svg%3e';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 
                    shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 
                    flex items-center justify-center">
                    <Building2 size={16} className="text-white" />
                  </div>
                )}
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">5 members</span>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700/50 mt-2 pt-2 px-2">
            <button
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2.5 flex items-center gap-2 text-purple-600 dark:text-purple-400 
                hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            >
              <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Plus size={16} />
              </div>
              <span className="text-sm font-medium">Create New Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const TopBar: React.FC<TopBarProps> = ({ 
  onNotificationsClick, 
  onHelpClick,
  isDarkMode,
  onThemeChange,
  onMobileMenuClick,
  user,
  dashboardManager
}) => {
  const navigate = useNavigate();
  const [hasNewNotifications] = useState(true);

  const handleCreateOrganization = () => {
    navigate('/organizations');
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 
      backdrop-blur-lg backdrop-saturate-150 bg-white/80 dark:bg-gray-900/80 sticky top-0 z-[40]">
      <div className="flex items-center h-16 px-2 sm:px-4 md:px-6">
        {/* Mobile menu button - increased tap area */}
        <button 
          onClick={onMobileMenuClick}
          className="mr-2 sm:mr-4 p-2.5 rounded-lg text-gray-500 dark:text-gray-400 
                    hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden
                    active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>
        
        {/* Left section with org selector */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8">
          <OrganizationSelector onCreateNew={handleCreateOrganization} />
          
          {/* Dashboard manager - hide on small screens, show on medium and up */}
          <div className="hidden md:block">
            {dashboardManager}
          </div>
        </div>

        {/* Right section with actions */}
        <div className="ml-auto flex items-center space-x-1 sm:space-x-2 md:space-x-3">
          {/* Dashboard manager for mobile - only show on small screens */}
          <div className="block md:hidden">
            {dashboardManager}
          </div>
          
          {/* Theme toggle button */}
          <button 
            onClick={onThemeChange}
            className="p-2.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 
                      dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
                      active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {/* Notifications button */}
          <button 
            onClick={onNotificationsClick} 
            className="p-2.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 
                      dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
                      active:bg-gray-200 dark:active:bg-gray-700 transition-colors 
                      relative"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {hasNewNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          
          {/* Help button - hide on mobile */}
          <button 
            onClick={onHelpClick}
            className="hidden sm:block p-2.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 
                      dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
                      active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            aria-label="Help"
          >
            <HelpCircle size={20} />
          </button>
          
          {/* User menu */}
          {user && (
            <UserMenu 
              user={user}
              isDarkMode={isDarkMode}
              onThemeChange={onThemeChange}
            />
          )}
        </div>
      </div>
    </header>
  ); 
}; 