import { Navigate, useLocation } from 'react-router-dom';
import type { ProtectedRouteProps } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallbackPath = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRole && requiredRole.length > 0) {
    if (!requiredRole.includes(user.role)) {
      console.warn(`Access denied: User role "${user.role}" not in required roles:`, requiredRole);
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
            <button 
              onClick={() => window.history.back()} 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // TODO: Add permission-based checks once we implement the permission system
  // For now, we'll skip permission checks since the server doesn't have a permission system yet
  if (requiredPermission) {
    console.log(`Permission check for "${requiredPermission}" - not implemented yet`);
  }

  // User is authenticated and authorized
  return <>{children}</>;
} 