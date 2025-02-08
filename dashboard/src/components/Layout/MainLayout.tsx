import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { NotificationsPanel } from './NotificationsPanel';
import { Sidebar } from './Sidebar';
import { MessageCircle, Bell } from 'lucide-react';
import { ChatPanel } from '../ChatPanel';
import { TopBar } from './TopBar';
import { useTheme } from '../../contexts/ThemeContext';

const mockUser = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: 'Admin',
  avatar: 'https://ui-avatars.com/api/?name=John+Doe'
};

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

  const handleHelpClick = () => {
    setShowHelp(true);
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
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
        />
        {/* Main content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
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

      {/* Chat Panel */}
      <ChatPanel 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(!isChatOpen)}
      />

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        onClose={() => setIsNotificationsPanelOpen(false)}
      />
    </div>
  );
}; 