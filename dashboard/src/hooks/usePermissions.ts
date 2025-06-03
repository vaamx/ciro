import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type UserRole = 'CUSTOMER' | 'CLIENT_ADMIN' | 'SYSTEM_ADMIN';

export interface Permission {
  resource: string;
  action: string;
}

export const PERMISSIONS = {
  // Client Management
  VIEW_CLIENTS: { resource: 'clients', action: 'view' },
  CREATE_CLIENTS: { resource: 'clients', action: 'create' },
  UPDATE_CLIENTS: { resource: 'clients', action: 'update' },
  DELETE_CLIENTS: { resource: 'clients', action: 'delete' },
  MANAGE_CLIENT_SETTINGS: { resource: 'clients', action: 'manage_settings' },
  
  // User Management
  VIEW_USERS: { resource: 'users', action: 'view' },
  CREATE_USERS: { resource: 'users', action: 'create' },
  UPDATE_USERS: { resource: 'users', action: 'update' },
  DELETE_USERS: { resource: 'users', action: 'delete' },
  
  // System Administration
  VIEW_SYSTEM_STATS: { resource: 'system', action: 'view_stats' },
  MANAGE_SYSTEM_SETTINGS: { resource: 'system', action: 'manage_settings' },
  ACCESS_ADMIN_DASHBOARD: { resource: 'admin', action: 'access_dashboard' },
  
  // Data Sources
  VIEW_ALL_DATA_SOURCES: { resource: 'data_sources', action: 'view_all' },
  MANAGE_DATA_SOURCE_CONNECTIONS: { resource: 'data_sources', action: 'manage_connections' },
  
  // Reports and Analytics
  VIEW_ALL_REPORTS: { resource: 'reports', action: 'view_all' },
  GENERATE_SYSTEM_REPORTS: { resource: 'reports', action: 'generate_system' },
  
  // Billing and Finance
  VIEW_BILLING: { resource: 'billing', action: 'view' },
  MANAGE_BILLING: { resource: 'billing', action: 'manage' },
} as const;

// Role-based permission mappings
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  CUSTOMER: [
    // Customers can only view their own data (handled at API level)
  ],
  
  CLIENT_ADMIN: [
    // Client administrators can manage their own organization's data
    PERMISSIONS.VIEW_CLIENTS,
    PERMISSIONS.UPDATE_CLIENTS,
    PERMISSIONS.MANAGE_CLIENT_SETTINGS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.CREATE_USERS,
    PERMISSIONS.UPDATE_USERS,
    PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
    PERMISSIONS.VIEW_ALL_DATA_SOURCES,
    PERMISSIONS.MANAGE_DATA_SOURCE_CONNECTIONS,
    PERMISSIONS.VIEW_ALL_REPORTS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.MANAGE_BILLING,
  ],
  
  SYSTEM_ADMIN: [
    // System administrators have full access
    ...Object.values(PERMISSIONS),
  ],
};

export interface UsePermissionsReturn {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canAccessRoute: (route: string) => boolean;
  userRole: UserRole;
  isSystemAdmin: boolean;
  isClientAdmin: boolean;
  isCustomer: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();

  const userRole = useMemo((): UserRole => {
    if (!user?.role) return 'CUSTOMER';
    
    const role = user.role.toUpperCase();
    if (role === 'SYSTEM_ADMIN' || role === 'ADMIN') return 'SYSTEM_ADMIN';
    if (role === 'CLIENT_ADMIN' || role === 'CLIENT_ADMINISTRATOR') return 'CLIENT_ADMIN';
    return 'CUSTOMER';
  }, [user?.role]);

  const userPermissions = useMemo(() => {
    return ROLE_PERMISSIONS[userRole] || [];
  }, [userRole]);

  const hasPermission = useMemo(() => 
    (permission: Permission): boolean => {
      return userPermissions.some(p => 
        p.resource === permission.resource && p.action === permission.action
      );
    }, [userPermissions]
  );

  const hasAnyPermission = useMemo(() => 
    (permissions: Permission[]): boolean => {
      return permissions.some(permission => hasPermission(permission));
    }, [hasPermission]
  );

  const hasAllPermissions = useMemo(() => 
    (permissions: Permission[]): boolean => {
      return permissions.every(permission => hasPermission(permission));
    }, [hasPermission]
  );

  const canAccessRoute = useMemo(() => 
    (route: string): boolean => {
      // Define route access rules
      const routePermissions: Record<string, Permission[]> = {
        '/admin': [PERMISSIONS.ACCESS_ADMIN_DASHBOARD],
        '/admin/clients': [PERMISSIONS.VIEW_CLIENTS],
        '/admin/users': [PERMISSIONS.VIEW_USERS],
        '/admin/settings': [PERMISSIONS.MANAGE_SYSTEM_SETTINGS],
        '/admin/reports': [PERMISSIONS.VIEW_ALL_REPORTS],
        '/admin/billing': [PERMISSIONS.VIEW_BILLING],
      };

      const requiredPermissions = routePermissions[route];
      if (!requiredPermissions) {
        // If no specific permissions defined, allow access
        return true;
      }

      return hasAnyPermission(requiredPermissions);
    }, [hasAnyPermission]
  );

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    userRole,
    isSystemAdmin: userRole === 'SYSTEM_ADMIN',
    isClientAdmin: userRole === 'CLIENT_ADMIN',
    isCustomer: userRole === 'CUSTOMER',
  };
} 