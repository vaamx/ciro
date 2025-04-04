/**
 * User type definitions
 */

export interface User {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  name?: string;
  createdAt?: Date;
  profile?: {
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
    timezone?: string;
  };
  preferences?: Record<string, any>;
} 