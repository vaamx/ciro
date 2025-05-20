import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';

@Injectable()
export class EntityExtractionService {
    private readonly logger = createServiceLogger('EntityExtractionService');

    constructor() {
        this.logger.info('EntityExtractionService initialized');
    }

    /**
     * Extract potential named entities from the query.
     * Currently uses a simple capitalization-based approach.
     * @param query The user query.
     * @returns An array of potential entities.
     */
    extractEntities(query: string): string[] {
        const capitalizedWords = query.match(/\b[A-Z][a-zA-Z]*\b/g) || [];
        const commonWords = ['I', 'A', 'The', 'For', 'In', 'On', 'About'];
        return capitalizedWords.filter(word => !commonWords.includes(word));
    }

    /**
     * Extract the primary entity *type* mentioned in the query.
     * @param query The user query.
     * @returns The detected entity type (e.g., 'company', 'product') or undefined.
     */
    extractEntityType(query: string): string | undefined {
        const entityTypes = [
            'customer', 'customers',
            'product', 'products',
            'company', 'companies',
            'investor', 'investors',
            'startup', 'startups',
            'deal', 'deals',
            'investment', 'investments',
            'transaction', 'transactions',
            'employee', 'employees',
            'user', 'users',
            'project', 'projects',
            'industry', 'industries'
        ];
        const normalizedQuery = query.toLowerCase();
        for (const entityType of entityTypes) {
            if (normalizedQuery.includes(entityType)) {
                return entityType;
            }
        }
        return undefined;
    }

    /**
     * Extract *all* mentioned common entity types from the query.
     * @param query The user query.
     * @returns An array of identified common entity types.
     */
    extractEntityTypes(query: string): string[] {
        const commonEntityTypes = [
            'company', 'companies',
            'startup', 'startups',
            'investor', 'investors',
            'person', 'people',
            'individual',
            'product', 'products',
            'service', 'services',
            'transaction', 'transactions',
            'deal', 'deals',
            'fund', 'funds',
            'industry', 'industries',
            'sector', 'sectors',
            'market', 'markets',
            'geography', 'region', 'country', 'city',
            'event', 'events',
            'project', 'projects',
            'document', 'documents'
        ];
        const normalizedQuery = query.toLowerCase();
        return commonEntityTypes.filter(entityType => 
            normalizedQuery.includes(entityType)
        );
    }
} 