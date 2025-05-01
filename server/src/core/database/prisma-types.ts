import { Role } from '../auth/role.enum';
import { User, Organization, OrganizationMember } from '@prisma/client';

// Export the imported Prisma types so they can be used by other modules
export { User, Organization, OrganizationMember };

// Define our own DataSource interface that matches the Prisma model
export interface DataSource {
  id: number;
  name: string;
  type: string | DataSourceType;
  config?: any;
  status: string | FileStatus;
  createdAt: Date;
  updatedAt: Date;
  creatorId: number;
  workspaceId: number;
}

// Define the enums used in the DataSource
export enum DataSourceType {
  FILE_UPLOAD = 'FILE_UPLOAD',
  SNOWFLAKE = 'SNOWFLAKE',
  HUBSPOT = 'HUBSPOT'
}

export enum FileStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Type aliases that match Prisma models but more JavaScript-friendly naming
// export type User = users;
// export type Organization = organizations;
// export type OrganizationMember = organization_members;
// export type DataSource = data_sources;

// Extended interfaces with relationships for better TypeScript support
export interface UserWithRelations extends User {
  organizations?: Organization | null;
  organization_members?: OrganizationMember[];
}

export interface OrganizationWithRelations extends Organization {
  members?: OrganizationMember[];
  data_sources?: DataSource[];
}

export interface DataSourceWithRelations extends DataSource {
  organization?: Organization | null;
}

// Helper types for controllers that need simpler return types
export type SafeUser = Omit<User, 'password_hash'>;

// Role type from enum for compatibility
export enum OrganizationRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

// JobStatus enum for processing jobs
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
} 