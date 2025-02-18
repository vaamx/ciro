import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NotificationsPanel } from './NotificationsPanel';
import { Sidebar } from './Sidebar';
import { ChatPanel } from '../Chat';
import { TopBar } from './TopBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Bot } from 'lucide-react';

interface MainLayoutProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { user } = useAuth();

  const handleHelpClick = () => {
    setShowHelp(true);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar 
        onHelpClick={handleHelpClick} 
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <TopBar 
          onNotificationsClick={() => setIsNotificationsPanelOpen(true)}
          onHelpClick={handleHelpClick}
          isDarkMode={isDarkMode}
          onThemeChange={toggleTheme}
          user={user ? {
            name: user.name,
            role: user.role,
            avatar: undefined
          } : undefined}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Help & Resources</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Need help getting started? Here are some resources to help you make the most of Ciro AI.
            </p>
            <button 
              onClick={() => setShowHelp(false)}
              className="btn-primary w-full justify-center"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 z-[40] md:bottom-8 md:right-8"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium">Ask Ciro AI</span>
      </button>

      {/* Chat Panel */}
      <ChatPanel 
        isOpen={isChatOpen}
        onClose={handleChatClose}
      />

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        onClose={() => setIsNotificationsPanelOpen(false)}
      />
    </div>
  );
}; 