import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Shield,
  Key,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UserMenuProps {
  user: {
    name: string;
    role: string;
    avatar?: string;
  };
  isDarkMode: boolean;
  onThemeChange: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  isDarkMode,
  onThemeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { logout, isLoading } = useAuth();

  // Handle missing, empty, or default user name
  const displayName = user.name && user.name !== 'user' ? user.name : 'User';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 sm:space-x-3 p-1.5 sm:p-2 rounded-lg 
          hover:bg-gray-100 dark:hover:bg-gray-800/50 
          active:bg-gray-200 dark:active:bg-gray-700/80
          transition-colors"
      >
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
          )}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
          isOpen ? 'transform rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 sm:w-72 bg-white dark:bg-gray-800 rounded-xl 
          shadow-lg dark:shadow-gray-900/50 
          border border-gray-200 dark:border-gray-700/50 
          py-2 z-[45]
          max-h-[80vh] overflow-y-auto">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Manage your account</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button className="w-full px-4 py-2.5 flex items-center space-x-3 
              hover:bg-gray-50 dark:hover:bg-gray-700/50 
              active:bg-gray-100 dark:active:bg-gray-600/50
              transition-colors">
              <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Settings</span>
            </button>
            <button className="w-full px-4 py-2.5 flex items-center space-x-3 
              hover:bg-gray-50 dark:hover:bg-gray-700/50 
              active:bg-gray-100 dark:active:bg-gray-600/50
              transition-colors">
              <Shield className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Privacy</span>
            </button>
            <button className="w-full px-4 py-2.5 flex items-center space-x-3 
              hover:bg-gray-50 dark:hover:bg-gray-700/50 
              active:bg-gray-100 dark:active:bg-gray-600/50
              transition-colors">
              <Key className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Security</span>
            </button>
            <button
              onClick={onThemeChange}
              className="w-full px-4 py-2.5 flex items-center space-x-3 
                hover:bg-gray-50 dark:hover:bg-gray-700/50 
                active:bg-gray-100 dark:active:bg-gray-600/50
                transition-colors"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              ) : (
                <Moon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>
          </div>

          {/* Logout Section */}
          <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2 mt-2">
            <button 
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full px-4 py-2.5 flex items-center space-x-3 
                text-red-600 dark:text-red-400 
                hover:bg-red-50 dark:hover:bg-red-900/20 
                active:bg-red-100 dark:active:bg-red-900/30
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="text-sm">{isLoading ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 