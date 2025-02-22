import React, { useState, useRef, useEffect } from 'react';
import { Bell, HelpCircle, ChevronDown, Building2, Plus } from 'lucide-react';
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
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
      >
        {currentOrganization?.logo_url ? (
          <img src={currentOrganization.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {currentOrganization?.name || 'Select Organization'}
          </span>
          <ChevronDown 
            size={16} 
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
        {organizations.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
            {organizations.length} {organizations.length === 1 ? 'org' : 'orgs'}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-400 border-b border-gray-700">
            Your Organizations
          </div>
          
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                setCurrentOrganization(org);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                currentOrganization?.id === org.id ? 'bg-gray-700' : ''
              }`}
            >
              {org.logo_url ? (
                <img src={org.logo_url} alt="" className="w-6 h-6 rounded object-cover" />
              ) : (
                <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center">
                  <Building2 size={14} className="text-white" />
                </div>
              )}
              <span className="text-sm text-white">{org.name}</span>
            </button>
          ))}

          <div className="border-t border-gray-700 mt-2 pt-2">
            <button
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 flex items-center gap-2 text-purple-400 hover:bg-gray-700 transition-colors"
            >
              <Plus size={16} />
              <span className="text-sm">Create New Organization</span>
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

  const handleCreateOrganization = () => {
    navigate('/organizations');
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700">
      <div className="flex items-center h-16 px-6">
        {/* Left section with org selector */}
        <div className="flex items-center gap-8">
          <OrganizationSelector onCreateNew={handleCreateOrganization} />
          
          {/* Dashboard manager */}
          {dashboardManager}
        </div>

        {/* Right section with actions */}
        <div className="flex-1 flex items-center justify-end gap-4">
          {onHelpClick && (
            <button 
              onClick={onHelpClick}
              className="p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-800"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}
          
          <button 
            onClick={onNotificationsClick}
            className="relative p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-800"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

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