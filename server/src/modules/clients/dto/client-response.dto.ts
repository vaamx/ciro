import { ClientStatus } from '@prisma/client';

export class ClientResponseDto {
  id: number;
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  billingAddress?: string;
  billingContact?: string;
  billingEmail?: string;
  organizationId: number;
  status: ClientStatus;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  createdById: number;

  // Optional related data
  organization?: {
    id: number;
    name: string;
  };
  
  customers?: {
    id: number;
    name: string;
    customerNumber: string;
    status: string;
  }[];

  _count?: {
    customers: number;
  };
} 