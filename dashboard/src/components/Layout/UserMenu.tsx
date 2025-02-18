import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Bell,
  Shield,
  Key
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
  const { logout } = useAuth();

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
      // The auth context will handle clearing the user state
      // and the app will redirect to login due to the protected route
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-purple-600" />
          )}
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{user.role}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
          isOpen ? 'transform rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-purple-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
                <p className="text-xs text-purple-600 mt-1">Manage your account</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button className="w-full px-4 py-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
              <Settings className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">Settings</span>
            </button>
            <button className="w-full px-4 py-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
              <Shield className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">Privacy</span>
            </button>
            <button className="w-full px-4 py-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors">
              <Key className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">Security</span>
            </button>
            <button
              onClick={onThemeChange}
              className="w-full px-4 py-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-gray-400" />
              ) : (
                <Moon className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-700">
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>
          </div>

          {/* Logout Section */}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <button 
              onClick={handleSignOut}
              className="w-full px-4 py-2 flex items-center space-x-3 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 