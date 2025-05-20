import { Organization } from './organization.entity';
import { User } from './user.entity';
import { DocumentChunk } from './document-chunk.entity';
import { DataSourceTypeEnum, DataSourceProcessingStatus } from '../../../types';

// Reusing enums from DTOs - consider moving to a shared types file
enum DataSourceStatus { PENDING='pending', PROCESSING='processing', READY='ready', ERROR='error' } // Example

export class DataSource {
    id!: number;

    organizationId!: number;

    name!: string;

    type!: DataSourceTypeEnum;

    status!: DataSourceProcessingStatus;

    description?: string | null;

    metadata?: Record<string, any> | null;

    metrics?: Record<string, any> | null;

    data?: Record<string, any> | null; 

    createdById?: string | null;

    lastSync?: Date | null;

    createdAt!: Date;

    updatedAt!: Date;

    organization!: Organization;

    createdBy?: User | null;
    
    documentChunks?: DocumentChunk[];
} 