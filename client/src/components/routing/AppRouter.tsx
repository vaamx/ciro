import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CustomerPortalLayout } from '../layout/CustomerPortalLayout';
import { AuthLayout } from '../layout/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { BillingPage } from '../../pages/BillingPage';
import { NotFoundPage } from './NotFoundPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes using AuthLayout */}
        <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        </Route>
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute><CustomerPortalLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/billing" element={<BillingPage />} />
        </Route>
        
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 404 Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
} 