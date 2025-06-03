import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, AlertTriangle, Lock } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
  requirePermissions?: string[];
  fallbackPath?: string;
  showAccessDenied?: boolean;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ 
  children, 
  requirePermissions = [], 
  fallbackPath = '/overview',
  showAccessDenied = true 
}) => {
  const { user, isLoading } = useAuth();
  const { canAccessRoute, hasPermission, userRole, isSystemAdmin, isClientAdmin } = usePermissions();
  const location = useLocation();

  // Show loading state while authentication is being verified
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has admin role
  if (!isSystemAdmin && !isClientAdmin) {
    if (showAccessDenied) {
      return <AccessDeniedPage userRole={userRole} />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  // Check route-level permissions
  if (!canAccessRoute(location.pathname)) {
    if (showAccessDenied) {
      return <AccessDeniedPage userRole={userRole} requiredRoute={location.pathname} />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  // Check specific permissions if provided
  if (requirePermissions.length > 0) {
    const hasRequiredPermissions = requirePermissions.every(permission => {
      // Convert string permission to permission object if needed
      if (typeof permission === 'string') {
        const [resource, action] = permission.split(':');
        return hasPermission({ resource, action });
      }
      return hasPermission(permission);
    });

    if (!hasRequiredPermissions) {
      if (showAccessDenied) {
        return <AccessDeniedPage userRole={userRole} requiredPermissions={requirePermissions} />;
      }
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
};

interface AccessDeniedPageProps {
  userRole: string;
  requiredRoute?: string;
  requiredPermissions?: string[];
}

const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ 
  userRole, 
  requiredRoute, 
  requiredPermissions 
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <Shield className="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Access Denied
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
            <span className="text-gray-900 dark:text-white font-medium">Insufficient Permissions</span>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Your Role:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {userRole.replace('_', ' ')}
              </span>
            </div>
            
            {requiredRoute && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Requested Route:</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">
                  {requiredRoute}
                </span>
              </div>
            )}
            
            {requiredPermissions && requiredPermissions.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 block mb-2">Required Permissions:</span>
                <div className="space-y-1">
                  {requiredPermissions.map((permission, index) => (
                    <div key={index} className="flex items-center text-xs">
                      <Lock className="w-3 h-3 text-gray-400 mr-1" />
                      <span className="text-gray-900 dark:text-white font-mono">
                        {permission}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            You don't have the required permissions to access this page. 
            Contact your system administrator if you believe this is an error.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/overview'}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 