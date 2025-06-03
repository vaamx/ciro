# Components Directory

This directory contains all reusable React components organized by their purpose and scope.

## Directory Structure

### `/ui`
Contains low-level, reusable UI components that can be used throughout the application. These components are typically design system elements like buttons, inputs, cards, modals, etc.

**Examples:** Button, Input, Card, Dialog, Dropdown, Badge, Alert

### `/layout`
Contains components responsible for page layout and application structure. These components define the overall structure and navigation of the application.

**Examples:** Header, Sidebar, Footer, MainLayout, PageHeader, Navigation

### `/forms`
Contains form-specific components and form validation logic. These components handle user input and form submission workflows.

**Examples:** LoginForm, RegisterForm, CustomerForm, BillingForm, FormField

### `/charts`
Contains data visualization components for displaying metrics, analytics, and reporting data.

**Examples:** EnergyUsageChart, BillingChart, DashboardChart, ConsumptionChart

## Import Usage

Use barrel exports for clean imports:

```typescript
// Import specific components
import { Button, Card } from '@/components/ui';
import { Header, Sidebar } from '@/components/layout';

// Or import from main components index
import { Button, Header } from '@/components';
```

## Component Guidelines

- Keep components focused and single-purpose
- Use TypeScript for all components
- Include proper prop types and documentation
- Follow the established naming conventions
- Ensure components are accessible (ARIA attributes)
- Write tests for complex component logic 