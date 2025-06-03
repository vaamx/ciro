import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, User, ChevronDown, Menu, LogOut, Settings, Moon, Sun, HelpCircle, Shield, Key, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  isDarkMode: boolean;
  onThemeChange: () => void;
  onMobileMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNotificationsClick,
  onHelpClick,
  isDarkMode,
  onThemeChange,
  onMobileMenuClick
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [hasNewNotifications] = useState(true);

  // Handle click outside to close user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
    await logout();
    navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // Handle missing, empty, or default user name
  const displayName = user?.name && user.name !== 'user' ? user.name : 'User';

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

        {/* Left section with logo */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30 flex items-center justify-center">
            <div className="text-white font-bold text-lg">C</div>
          </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white hidden sm:block">
            Customer Portal
          </span>
          </Link>
      </div>

        {/* Right section with actions */}
        <div className="ml-auto flex items-center space-x-1 sm:space-x-2 md:space-x-3">
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

        {/* User menu */}
          <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-1 sm:space-x-3 p-1.5 sm:p-2 rounded-lg 
                hover:bg-gray-100 dark:hover:bg-gray-800/50 
                active:bg-gray-200 dark:active:bg-gray-700/80
                transition-colors"
          >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                {user?.avatar ? (
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
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role || 'Customer'}</p>
            </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
                isUserMenuOpen ? 'transform rotate-180' : ''
              }`} />
          </button>

            {/* Dropdown Menu */}
          {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 sm:w-72 bg-white dark:bg-gray-800 rounded-xl 
                shadow-lg dark:shadow-gray-900/50 
                border border-gray-200 dark:border-gray-700/50 
                py-2 z-[45]
                max-h-[80vh] overflow-y-auto">
                {/* User Info Section */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      {user?.avatar ? (
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role || 'Customer'}</p>
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
                onClick={handleLogout}
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
        </div>
      </div>
    </header>
  );
}; 