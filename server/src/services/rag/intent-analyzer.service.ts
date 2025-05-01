import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';

// Define potential intent types
export type QueryIntent = 'general' | 'count' | 'analysis' | 'summary' | 'comparison' | 'exploration';
export type CountType = 'entity' | 'document' | 'vcfund' | 'general';

@Injectable()
export class IntentAnalysisService {
    private readonly logger = createServiceLogger('IntentAnalysisService');

    constructor() {
        this.logger.info('IntentAnalysisService initialized');
    }

    /**
     * Determine the primary intent of a query based on patterns.
     * @param normalizedQuery Lowercase query string.
     * @returns The determined QueryIntent.
     */
    determineIntent(normalizedQuery: string): QueryIntent {
        if (this.containsCountPattern(normalizedQuery)) {
            return 'count';
        } else if (this.containsAnalysisPattern(normalizedQuery)) {
            return 'analysis';
        } else if (this.containsSummaryPattern(normalizedQuery)) {
            return 'summary';
        } else if (this.containsComparisonPattern(normalizedQuery)) {
            return 'comparison';
        } else if (this.containsExplorationPattern(normalizedQuery)) {
            return 'exploration';
        }
        return 'general';
    }

    /**
     * Determine what type of count is being requested.
     * @param normalizedQuery Lowercase query string.
     * @returns The determined CountType.
     */
    determineCountType(normalizedQuery: string): CountType {
        if (normalizedQuery.includes('document') || normalizedQuery.includes('documents')) {
            return 'document';
        }
        if (normalizedQuery.includes('fund') || normalizedQuery.includes('funds') || normalizedQuery.includes('investment')) {
            return 'vcfund';
        }
        const entityTypes = [
            'company', 'companies', 'startup', 'startups', 
            'investor', 'investors', 'person', 'people',
            'product', 'products', 'deal', 'deals'
        ];
        for (const entityType of entityTypes) {
            if (normalizedQuery.includes(entityType)) {
                return 'entity';
            }
        }
        return 'general';
    }

    // --- Private Pattern Matching Methods ---

    private containsCountPattern(query: string): boolean {
        const countPatterns = [
            /how many/i, /count of/i, /number of/i, /total number/i, /count the/i
        ];
        return countPatterns.some(pattern => pattern.test(query));
    }

    private containsAnalysisPattern(query: string): boolean {
        const analysisPatterns = [
            /analyze/i, /analysis/i, /trend/i, /correlation/i, /relationship/i,
            /pattern/i, /insight/i, /overview of/i, /overview on/i, /deep dive/i,
            /statistics/i, /statistic/i, /stat/i, /stats/i, /metric/i, /metrics/i,
            /dashboard/i, /visualize/i, /chart/i, /graph/i, /plot/i, /distribution/i
        ];
        return analysisPatterns.some(pattern => pattern.test(query));
    }

    private containsSummaryPattern(query: string): boolean {
        const summaryPatterns = [
            /summarize/i, /summary/i, /brief overview/i, /key point/i, /main point/i,
            /tldr/i, /in short/i, /briefly/i, /in brief/i, /overview/i,
            /in a nutshell/i, /boil down/i, /high level/i
        ];
        return summaryPatterns.some(pattern => pattern.test(query));
    }

    private containsComparisonPattern(query: string): boolean {
        const comparisonPatterns = [
            /compare/i, /comparison/i, /versus/i, /vs/i, /difference/i,
            /similar/i, /different/i, /better/i, /worse/i, /against/i,
            /best/i, /worst/i, /rank/i, /ranking/i, /top/i, /bottom/i
        ];
        return comparisonPatterns.some(pattern => pattern.test(query));
    }

    private containsExplorationPattern(query: string): boolean {
        const explorationPatterns = [
            /tell me about/i, /what is/i, /who is/i, /explain/i, /elaborate/i,
            /details/i, /description/i, /information on/i, /information about/i,
            /learn about/i, /find out about/i, /tell me more/i
        ];
        return explorationPatterns.some(pattern => pattern.test(query));
    }
} 