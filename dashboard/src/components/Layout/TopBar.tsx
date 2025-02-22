import React, { useState, useRef, useEffect } from 'react';
import { Bell, HelpCircle, ChevronDown, Building2, Plus, Sun, Moon } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  isDarkMode: boolean;
  onThemeChange: () => void;
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
        className="flex items-center gap-3 px-4 py-2 rounded-xl 
          bg-white/5 hover:bg-white/10 dark:bg-gray-800/50 dark:hover:bg-gray-800/80
          border border-gray-200/10 dark:border-gray-700/50
          transition-all duration-200 group"
      >
        {currentOrganization?.logo_url ? (
          <img src={currentOrganization.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover ring-2 ring-purple-500/20" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 
            shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 
            flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            {currentOrganization?.name || 'Select Organization'}
          </span>
          <ChevronDown 
            size={16} 
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
        {organizations.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400">
            {organizations.length} {organizations.length === 1 ? 'org' : 'orgs'}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl 
          shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700/50 
          backdrop-blur-lg backdrop-saturate-150 py-2 z-50">
          <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
            Your Organizations
          </div>
          
          <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setCurrentOrganization(org);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 flex items-center gap-3 
                  hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200
                  ${currentOrganization?.id === org.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
              >
                {org.logo_url ? (
                  <img src={org.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover ring-2 ring-purple-500/20" />
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
  user,
  dashboardManager
}) => {
  const navigate = useNavigate();
  const [hasNewNotifications, setHasNewNotifications] = useState(true);

  const handleCreateOrganization = () => {
    navigate('/organizations');
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 
      backdrop-blur-lg backdrop-saturate-150 bg-white/80 dark:bg-gray-900/80 sticky top-0 z-40">
      <div className="flex items-center h-16 px-6">
        {/* Left section with org selector */}
        <div className="flex items-center gap-8">
          <OrganizationSelector onCreateNew={handleCreateOrganization} />
          
          {/* Dashboard manager */}
          {dashboardManager}
        </div>

        {/* Right section with actions */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {onHelpClick && (
            <button 
              onClick={onHelpClick}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 
                rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={onThemeChange}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 
              rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={() => {
              setHasNewNotifications(false);
              onNotificationsClick?.();
            }}
            className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 
              rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
          >
            <Bell className="w-5 h-5" />
            {hasNewNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full 
                group-hover:animate-ping"></span>
            )}
          </button>

          {user && (
            <div className="pl-2 border-l border-gray-200 dark:border-gray-700">
              <UserMenu
                user={user}
                isDarkMode={isDarkMode}
                onThemeChange={onThemeChange}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}; 