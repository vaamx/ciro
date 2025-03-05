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
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { TeamProvider } from './contexts/TeamContext';
import { DataSourceProvider } from './contexts/DataSourceContext';
import { AutomationProvider } from './contexts/AutomationContext';
import { KnowledgeProvider } from './providers/KnowledgeProvider';
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
      communications: '/communications',
      organizations: '/organizations'
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
        <AuthProvider>
          <OrganizationProvider>
            <TeamProvider>
              <DataSourceProvider>
                <AutomationProvider>
                  <DashboardProvider>
                    <KnowledgeProvider>
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

                          {/* OAuth Callback Route */}
                          <Route path="/oauth/callback" element={<OAuthCallback />} />
                          
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
                            <Route path="/organizations" element={<OrganizationManagement />} />
                            <Route path="*" element={<Navigate to="/overview" replace />} />
                          </Route>
                        </Routes>
                      </Router>
                    </KnowledgeProvider>
                  </DashboardProvider>
                </AutomationProvider>
              </DataSourceProvider>
            </TeamProvider>
          </OrganizationProvider>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
