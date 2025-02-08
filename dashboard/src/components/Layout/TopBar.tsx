import React, { useState, useRef, useEffect } from 'react';
import { Bell, User, ChevronDown, Settings, LogOut, HelpCircle, Sun, Moon } from 'lucide-react';

interface TopBarProps {
  onNotificationsClick?: () => void;
  onHelpClick?: () => void;
  isDarkMode: boolean;
  onThemeChange: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onNotificationsClick, 
  onHelpClick,
  isDarkMode,
  onThemeChange
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <button 
            onClick={onNotificationsClick}
            className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-3 pl-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="flex items-center space-x-2">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">John Doe</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Admin</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProfileOpen ? 'transform rotate-180' : ''}`} />
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Settings</span>
                </div>
                <div 
                  className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-3"
                  onClick={onHelpClick}
                >
                  <HelpCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">Help</span>
                </div>
                <div 
                  className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-3"
                  onClick={onThemeChange}
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
                    </>
                  )}
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                <div className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-3">
                  <LogOut className="w-5 h-5 text-red-500" />
                  <span className="text-red-500">Sign out</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}; 