# Hooks Directory

This directory contains custom React hooks that provide reusable stateful logic across the application.

## Purpose

Custom hooks allow you to:
- Extract component logic into reusable functions
- Share stateful logic between components
- Keep components clean and focused
- Provide consistent patterns for common functionality

## Examples of Custom Hooks

### Data Management
- `useApi` - Generic API call hook with loading, error, and data states
- `usePagination` - Handle pagination logic
- `useDebounce` - Debounce values for search inputs
- `useLocalStorage` - Sync component state with localStorage

### UI State
- `useToggle` - Boolean state toggle functionality
- `useModal` - Modal open/close state management
- `useForm` - Form state and validation management

### Business Logic
- `useAuth` - Authentication state and methods
- `useTenant` - Tenant context and switching
- `usePermissions` - User permissions checking

## Import Usage

```typescript
import { useApi, useDebounce, useToggle } from '@/hooks';

// Usage in component
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data, loading, error } = useApi(`/api/search?q=${debouncedSearch}`);
  
  // Component logic...
}
```

## Hook Guidelines

- Always start hook names with "use"
- Keep hooks focused on a single responsibility
- Return objects with meaningful property names
- Include proper TypeScript types
- Document complex hooks with JSDoc comments
- Write tests for hooks with complex logic 