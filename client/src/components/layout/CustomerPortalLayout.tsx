import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export function CustomerPortalLayout() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if user prefers dark mode or has previously set it
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme === 'dark' || (!savedTheme && prefersDark);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  const handleThemeChange = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  const handleNotifications = () => {
    // Handle notifications panel visibility
    console.log('Notifications clicked');
  };

  const handleHelp = () => {
    // Handle help/support panel visibility
    console.log('Help clicked');
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          isDarkMode={isDarkMode}
          isMobile={isMobileMenuOpen} 
          onSectionChange={handleSectionChange}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col h-screen overflow-auto">
          {/* Header */}
          <Header
            isDarkMode={isDarkMode}
            onThemeChange={handleThemeChange}
            onMobileMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            onNotificationsClick={handleNotifications}
            onHelpClick={handleHelp}
          />

          {/* Page content */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <Outlet />
          </main>
          
          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
} 