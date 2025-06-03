# Utils Directory

This directory contains utility functions and helper modules that provide common functionality across the application.

## Purpose

Utilities provide:
- Pure functions for data transformation
- Common validation logic
- Formatting helpers
- Browser API abstractions
- Performance optimization helpers

## Utility Categories

### Data Formatting
- `date-utils` - Date parsing, formatting, and manipulation
- `currency-utils` - Currency formatting and calculations
- `number-utils` - Number formatting and validation

### Validation
- `validation-utils` - Email, phone, and form validation
- `schema-validators` - Complex object validation schemas

### Performance
- `debounce` - Debounce function calls for performance
- `throttle` - Throttle function calls for rate limiting
- `memoization` - Caching helpers for expensive operations

### Browser APIs
- `local-storage` - Safe localStorage operations
- `file-utils` - File upload and download helpers
- `clipboard` - Clipboard API abstractions

## Import Usage

```typescript
import { formatCurrency, validateEmail, debounce, cn } from '@/utils';

// Usage examples
const price = formatCurrency(1234.56, 'USD'); // "$1,234.56"
const isValid = validateEmail('user@example.com'); // true
const debouncedSearch = debounce(searchFunction, 300);
const className = cn('base-class', condition && 'conditional-class');
```

## Utility Guidelines

- Keep functions pure (no side effects when possible)
- Include comprehensive TypeScript types
- Write unit tests for all utilities
- Document complex functions with JSDoc
- Follow functional programming principles
- Ensure utilities are tree-shakeable 