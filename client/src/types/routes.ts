// Route types for the customer portal
export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  isProtected: boolean;
  requiredRole?: string[];
  title: string;
  description?: string;
}

export interface NestedRouteConfig extends RouteConfig {
  children?: RouteConfig[];
}

export type RoutePermission = 'view_dashboard' | 'view_billing' | 'download_reports' | 'manage_profile';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredPermission?: RoutePermission;
  fallbackPath?: string;
} 