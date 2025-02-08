import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { EnhancedOverview } from './components/Dashboard/EnhancedOverview';
import { DataSourcesView } from './components/DataSources/DataSourcesView';
import { DecisionsView } from './components/Decisions/DecisionsView';
import { AutomationsView } from './components/Automations/AutomationsView';
import { CommunicationsView } from './components/Communications/CommunicationsView';
import { OAuthCallback } from './components/DataSources/OAuthCallback';
import { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [activeTab, setActiveTab] = useState('overview');

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    // Map sections to routes
    const routeMap: { [key: string]: string } = {
      overview: '/overview',
      data: '/data-sources',
      decisions: '/decisions',
      automations: '/automations',
      communications: '/communications'
    };
    
    if (routeMap[section]) {
      setActiveTab('overview'); // Reset tab when changing sections
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <ThemeProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            {/* OAuth Callback Route */}
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            
            {/* Main App Routes */}
            <Route element={
              <MainLayout 
                activeSection={activeSection} 
                onSectionChange={handleSectionChange}
              />
            }>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route 
                path="/overview" 
                element={
                  <EnhancedOverview 
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                } 
              />
              <Route path="/data-sources" element={<DataSourcesView />} />
              <Route path="/decisions" element={<DecisionsView />} />
              <Route path="/automations" element={<AutomationsView />} />
              <Route path="/communications" element={<CommunicationsView />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Route>
          </Routes>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;