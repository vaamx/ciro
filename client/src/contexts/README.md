# Contexts Directory

This directory contains React Context providers and related hooks for global state management across the application.

## Purpose

React Contexts provide:
- Global state management without prop drilling
- Shared state between distant components
- Cross-cutting concerns (auth, theme, notifications)
- Performance optimizations with selective subscriptions

## Context Categories

### Authentication & Authorization
- `auth-context` - User authentication state and methods
- `permissions-context` - User permissions and role-based access

### Application State
- `tenant-context` - Multi-tenant organization switching
- `theme-context` - Dark/light mode and theming
- `notification-context` - Global notifications and alerts

### Business Logic
- `dashboard-context` - Dashboard-specific global state
- `filter-context` - Global filter state for listings

## Context Structure

Each context should include:
- Context definition with default values
- Provider component with state management
- Custom hook for consuming the context
- TypeScript types for state and actions

```typescript
// Example context structure
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Context implementation
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## Import Usage

```typescript
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';

// Provider setup
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

// Context consumption
function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // Component logic...
}
```

## Context Guidelines

- Keep contexts focused on specific concerns
- Provide TypeScript types for all context values
- Include error handling for missing providers
- Use context selectors for performance when needed
- Document context usage and setup requirements
- Consider using React Query or Zustand for complex state 