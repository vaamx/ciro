import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';

export type QueryComplexity = {
    timeframe: string | null;
    from: string | null;
    to: string | null;
    period: string | null;
} | 'high' | 'medium' | 'low';

@Injectable()
export class ComplexityAnalysisService {
    private readonly logger = createServiceLogger('ComplexityAnalysisService');

    constructor() {
        this.logger.info('ComplexityAnalysisService initialized');
    }

    /**
     * Analyzes the complexity of a query and returns a numeric score between 1-10
     * @param query The user query to analyze
     * @returns Numeric complexity score from 1-10 (higher is more complex)
     */
    async analyzeComplexity(query: string): Promise<number> {
        // Normalize query for pattern matching
        const normalizedQuery = query.toLowerCase();
        
        // Get the string complexity
        const complexityLevel = this.determineComplexity(normalizedQuery);
        
        // Convert string complexity to a numeric score (1-10)
        switch (complexityLevel) {
            case 'high':
                return 9; // High complexity scores 8-10 range
            case 'medium':
                return 5; // Medium complexity scores 4-7 range
            case 'low':
                return 2; // Low complexity scores 1-3 range
            default:
                return 5; // Default to medium complexity
        }
    }

    /**
     * Determine the complexity of the query based on pattern matching.
     * @param normalizedQuery Lowercase query string.
     * @returns The determined QueryComplexity.
     */
    determineComplexity(normalizedQuery: string): QueryComplexity {
        const highComplexityIndicators = [
            /and.*and/i, /or.*or/i, /and.*or/i, /or.*and/i, // Multiple conditions
            /trend/i, /over time/i, /past.*years/i, /evolution/i, /growth/i, // Temporal analysis
            /correlation/i, /regression/i, /cluster/i, /segment/i, /pattern/i, /relationship between/i, // Complex analytics
            /both.*and/i, /among/i, /between/i, // Multiple entities
            /not.*but/i, /except/i, /excluding/i, // Negation
            /\?.*\?/i // Multiple questions
        ];
        
        const lowComplexityIndicators = [
            /^what is/i, /^who is/i, /^how many/i, /^when/i, /^where/i, // Simple questions
            /^find/i, /^list/i, /^show/i, /^get/i // Simple lookups
        ];
        
        for (const pattern of highComplexityIndicators) {
            if (pattern.test(normalizedQuery)) {
                return 'high';
            }
        }
        
        // Consider query length for low complexity
        const wordCount = normalizedQuery.split(' ').length;
        for (const pattern of lowComplexityIndicators) {
            if (pattern.test(normalizedQuery) && wordCount < 10) {
                return 'low';
            }
        }
        
        return 'medium';
    }
} 