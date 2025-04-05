import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { EnhancedOverview } from './components/Dashboard/EnhancedOverview';
import { DataSourcesView } from './components/DataSources/DataSourcesView';
import { CommunicationsView } from './components/Communications/CommunicationsView';
import { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { TeamProvider } from './contexts/TeamContext';
import { DataSourceProvider } from './contexts/DataSourceContext';
import { AutomationProvider } from './contexts/AutomationContext';
import { KnowledgeProvider } from './providers/KnowledgeProvider';
import { ChatProvider } from './components/Chat/providers/ChatProvider';
import { StudioProvider } from './contexts/StudioContext';
import { WorkspacesProvider } from './contexts/WorkspacesContext';
import { LoginForm } from './Auth/LoginForm';
import { SignupForm } from './Auth/SignupForm';
import { VerifyEmailForm } from './Auth/VerifyEmailForm';
import { ResetPasswordForm } from './Auth/ResetPasswordForm';
import { ForgotPasswordForm } from './Auth/ForgotPasswordForm';
import { AuthLayout } from './Auth/AuthLayout';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { GettingStarted } from './pages/GettingStarted';
import { VerificationPendingWrapper } from './Auth/VerificationPendingWrapper';
import { DashboardManager } from './components/Dashboard/DashboardManager';
import { OrganizationManagement } from './components/organization/OrganizationManagement';
import { ToastProvider } from './contexts/ToastContext';
import RateLimitNotification from './components/Notifications/RateLimitNotification';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import { DataSourcesProvider } from './contexts/DataSourcesContext';
import { initializeVisualizationDebugTools } from './services/visualizationService';
// Import the standalone components
import { Studio } from './components/Studio';
import { VisualizationGallery } from './components/Gallery';
import { InsightsAnalytics } from './components/Insights';
import { ToolkitHub } from './components/Toolkit';
import { ChatbotPage, VoicePage } from './components/Communications';

function App() {
  const [activeSection, setActiveSection] = useState('overview');

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    // Map sections to routes
    const routeMap: { [key: string]: string } = {
      overview: '/overview',
      data: '/data-sources',
      studio: '/studio',
      gallery: '/gallery',
      insights: '/insights',
      toolkit: '/toolkit',
      chatbot: '/communications/chatbot',
      voice: '/communications/voice',
      organizations: '/organizations'
    };
    
    if (routeMap[section]) {
      // Navigation will be handled by the router
      console.log(`Navigating to ${routeMap[section]}`);
    }
  };

  // Add an effect to handle emergency reset if needed
  useEffect(() => {
    const checkEmergencyResetNeeded = () => {
      // Check if the emergency flag was set before reload
      if (window.localStorage.getItem('emergencyResetLoadingState') === 'true') {
        console.log('Emergency loading state reset detected, clearing localStorage flag');
        window.localStorage.removeItem('emergencyResetLoadingState');
        
        // Clear any loading-related state in localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('loading') || 
            key.includes('Loading') || 
            key.includes('isLoading')
          )) {
            localStorage.removeItem(key);
            console.log(`Removed loading key: ${key}`);
          }
        }
      }
    };
    
    // Check immediately and also after a delay to ensure everything is loaded
    checkEmergencyResetNeeded();
    setTimeout(checkEmergencyResetNeeded, 1000);
  }, []);

  // Initialize debug tools after app loads
  useEffect(() => {
    // Initialize visualization debugging tools
    initializeVisualizationDebugTools();
  }, []);

  // Add a handler for resizing to manage mobile view adjustments
  useEffect(() => {
    const handleResize = () => {
      // Update any state needed based on window size
      document.documentElement.classList.toggle('mobile-view', window.innerWidth < 768);
    };

    // Call it once
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <GlobalErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <OrganizationProvider>
                <TeamProvider>
                  <DataSourceProvider>
                    <AutomationProvider>
                      <DashboardProvider>
                        <KnowledgeProvider>
                          <ChatProvider>
                            <DataSourcesProvider>
                              <StudioProvider>
                                <WorkspacesProvider>
                                  <Router>
                                    <Routes>
                                      {/* Auth Routes */}
                                      <Route element={<AuthLayout />}>
                                        <Route path="/login" element={<LoginForm />} />
                                        <Route path="/signup" element={<SignupForm />} />
                                        <Route path="/verify-email" element={<VerifyEmailForm />} />
                                        <Route path="/verification-pending" element={<VerificationPendingWrapper />} />
                                        <Route path="/reset-password" element={<ResetPasswordForm />} />
                                        <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                                        <Route path="/getting-started" element={<GettingStarted />} />
                                      </Route>

                                      {/* Protected Main App Routes */}
                                      <Route element={
                                        <ProtectedRoute>
                                          <MainLayout 
                                            activeSection={activeSection} 
                                            onSectionChange={handleSectionChange}
                                            dashboardManager={<DashboardManager />}
                                          />
                                        </ProtectedRoute>
                                      }>
                                        <Route path="/" element={<Navigate to="/overview" replace />} />
                                        <Route 
                                          path="/overview" 
                                          element={<EnhancedOverview />} 
                                        />
                                        {/* New standalone routes */}
                                        <Route path="/studio" element={<Studio />} />
                                        <Route path="/gallery" element={<VisualizationGallery />} />
                                        <Route path="/insights" element={<InsightsAnalytics />} />
                                        <Route path="/toolkit" element={<ToolkitHub />} />
                                        
                                        {/* Communication Routes */}
                                        <Route path="/communications/chatbot" element={<ChatbotPage />} />
                                        <Route path="/communications/voice" element={<VoicePage />} />
                                        
                                        {/* Existing routes */}
                                        <Route path="/data-sources" element={<DataSourcesView />} />
                                        <Route path="/communications" element={<CommunicationsView />} />
                                        <Route path="/organizations" element={<OrganizationManagement />} />
                                        <Route path="*" element={<Navigate to="/overview" replace />} />
                                      </Route>
                                    </Routes>
                                    
                                    {/* Global Rate Limit Notification */}
                                    <RateLimitNotification position="top-center" autoHideDuration={30000} />
                                  </Router>
                                </WorkspacesProvider>
                              </StudioProvider>
                            </DataSourcesProvider>
                          </ChatProvider>
                        </KnowledgeProvider>
                      </DashboardProvider>
                    </AutomationProvider>
                  </DataSourceProvider>
                </TeamProvider>
              </OrganizationProvider>
            </AuthProvider>
          </NotificationProvider>
        </ThemeProvider>
      </ToastProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
