import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { NotificationsPanel } from './NotificationsPanel';
import { Sidebar } from './Sidebar';
import { ChatPanel } from '../Chat';
import { TopBar } from './TopBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import darkLogo from '../../styles/logos/darklogo.png';
import lightLogo from '../../styles/logos/lightlogo.png';
import { X } from 'lucide-react';

interface MainLayoutProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  dashboardManager: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  activeSection,
  onSectionChange,
  dashboardManager,
}) => {
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user } = useAuth();

  // Close mobile sidebar when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleHelpClick = () => {
    setShowHelp(true);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          onHelpClick={handleHelpClick} 
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          isDarkMode={isDarkMode}
        />
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Mobile Sidebar */}
      <div className={`fixed top-0 bottom-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out transform ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar 
          onHelpClick={handleHelpClick} 
          activeSection={activeSection}
          onSectionChange={(section) => {
            onSectionChange(section);
            setIsMobileSidebarOpen(false);
          }}
          isDarkMode={isDarkMode}
          isMobile={true}
        />
        
        {/* Close button for mobile sidebar */}
        <button 
          className="absolute top-4 right-4 p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <TopBar 
          onNotificationsClick={() => setIsNotificationsPanelOpen(true)}
          onHelpClick={handleHelpClick}
          isDarkMode={isDarkMode}
          onThemeChange={toggleTheme}
          onMobileMenuClick={toggleMobileSidebar}
          user={user ? {
            name: user.name,
            role: user.role,
            avatar: undefined
          } : undefined}
          dashboardManager={dashboardManager}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
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

      {/* Ask Ciro AI Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[40] group"
      >
        <div className="relative">
          {/* Animated background gradient */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-indigo-600/20 dark:from-purple-400/20 dark:to-indigo-500/20 blur-xl group-hover:blur-2xl transition-all duration-500" />
          
          {/* Button content */}
          <div className="relative flex items-center space-x-3 px-5 py-3.5 
            bg-gradient-to-br from-purple-500 to-indigo-600 dark:from-purple-400 dark:to-indigo-500
            hover:from-purple-400 hover:to-indigo-500 dark:hover:from-purple-300 dark:hover:to-indigo-400
            rounded-2xl shadow-lg shadow-purple-500/30 dark:shadow-purple-900/30
            transform-gpu transition-all duration-300 
            hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/40 dark:hover:shadow-purple-900/40
            active:scale-[0.98]"
          >
            {/* Logo */}
            <div className="w-6 h-6 rounded-lg bg-white/10 p-1 ring-1 ring-white/20 backdrop-blur-sm">
              <img 
                src={isDarkMode ? darkLogo : lightLogo} 
                alt="Ciro AI" 
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Text */}
            <span className="text-sm font-medium text-white group-hover:text-white/90">
              Ask Ciro AI
            </span>

            {/* Shine effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </div>
          </div>
        </div>
      </button>

      {/* Chat Panel */}
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        <ChatPanel 
          isOpen={isChatOpen}
          onClose={handleChatClose}
        />
      </div>

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={isNotificationsPanelOpen}
        onClose={() => setIsNotificationsPanelOpen(false)}
      />
    </div>
  );
}; 