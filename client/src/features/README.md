# Features Directory

This directory contains feature-specific code organized by business domain. Each feature directory is self-contained and includes all components, hooks, types, and logic related to that specific feature.

## Directory Structure

### `/auth`
Authentication and authorization functionality including login, registration, password management, and protected routes.

**Contains:** Login/Register pages, Auth provider, Auth hooks, Protected route components

### `/dashboard`
Main dashboard interface showing system overview, metrics, and quick actions for the energy management platform.

**Contains:** Dashboard page, Stats widgets, Recent activity, Quick actions, Dashboard-specific hooks

### `/customers`
Customer management functionality for viewing, creating, editing, and managing customer accounts.

**Contains:** Customer pages, Customer list/detail views, Customer forms, Customer-specific hooks

### `/billing`
Billing and invoice management including payment processing, invoice generation, and billing history.

**Contains:** Billing pages, Invoice components, Payment forms, Billing-specific hooks

### `/admin`
Administrative functionality for system management, user administration, and organization oversight.

**Contains:** Admin pages, User management, Organization management, System settings, Admin hooks

## Feature Organization

Each feature directory should follow this structure:

```
feature-name/
├── components/          # Feature-specific components
├── hooks/              # Feature-specific hooks
├── types/              # Feature-specific types
├── services/           # Feature-specific API calls
├── utils/              # Feature-specific utilities
├── pages/              # Page components
└── index.ts            # Barrel exports
```

## Import Usage

```typescript
// Import from specific features
import { LoginPage, useAuth } from '@/features/auth';
import { DashboardPage, useDashboardData } from '@/features/dashboard';

// Or import from main features index
import { LoginPage, DashboardPage } from '@/features';
```

## Feature Guidelines

- Keep features isolated and self-contained
- Avoid cross-feature dependencies when possible
- Share common functionality through the shared directories (components, hooks, utils)
- Each feature should have its own types and interfaces
- Features should be independently testable 