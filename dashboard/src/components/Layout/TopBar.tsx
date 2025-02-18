import React from 'react';
import { Bell, HelpCircle } from 'lucide-react';
import { UserMenu } from './UserMenu';

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
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onNotificationsClick, 
  onHelpClick,
  isDarkMode,
  onThemeChange,
  user
}) => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Dashboard</h1>
        <div className="flex items-center space-x-4">
          {onHelpClick && (
            <button 
              onClick={onHelpClick}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <HelpCircle className="w-6 h-6" />
            </button>
          )}
          
          <button 
            onClick={onNotificationsClick}
            className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
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