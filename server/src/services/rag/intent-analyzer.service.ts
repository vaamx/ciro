import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';

// Define potential intent types
export type QueryIntent = 'general' | 'count' | 'analysis' | 'summary' | 'comparison' | 'exploration' | 'aggregation' | 'information_seeking' | 'analytical_code' | 'analytical_programming' | 'unknown';
export type CountType = 'entity' | 'document' | 'vcfund' | 'general' | 'item';

export interface IntentAnalysisResult {
  intent: QueryIntent;
  countType?: CountType;
  entityTypes?: string[];
  isSensitive?: boolean;
  specificFilters?: Record<string, any>;
  userExpectations?: string;
  temporalInfo?: Record<string, any>; // Define more specifically if known
  geospatialInfo?: Record<string, any>; // Define more specifically if known
  complexityScore?: number;
  confidenceScore?: number;
  // Add other relevant fields from QueryOrchestratorService test mock
}

@Injectable()
export class IntentAnalysisService {
    private readonly logger = createServiceLogger('IntentAnalysisService');

    constructor() {
        this.logger.info('IntentAnalysisService initialized');
    }

    /**
     * Placeholder for a comprehensive intent analysis method.
     * This method is assumed by QueryOrchestratorService tests.
     */
    async analyzeIntent(query: string): Promise<IntentAnalysisResult> {
        this.logger.debug(`Placeholder analyzeIntent called for query: ${query}`);
        // In a real implementation, this would involve more sophisticated logic,
        // potentially using this.determineIntent, this.determineCountType, and other analyses.
        const intent = this.determineIntent(query.toLowerCase());
        let countType: CountType | undefined = undefined;
        if (intent === 'count') {
            countType = this.determineCountType(query.toLowerCase());
        }
        return {
            intent,
            countType,
            entityTypes: [], // Placeholder
            isSensitive: false, // Placeholder
            specificFilters: {}, // Placeholder
            userExpectations: '', // Placeholder
            temporalInfo: {}, // Placeholder
            geospatialInfo: {}, // Placeholder
            complexityScore: 1, // Placeholder
            confidenceScore: 0.8, // Placeholder
        };
    }

    /**
     * Determine the primary intent of a query based on patterns.
     * @param normalizedQuery Lowercase query string.
     * @returns The determined QueryIntent.
     */
    determineIntent(normalizedQuery: string): QueryIntent {
        if (this.containsCountPattern(normalizedQuery)) {
            return 'count';
        } else if (this.containsAnalyticalCodePattern(normalizedQuery)) {
            return 'analytical_code';
        } else if (this.containsAnalyticalProgrammingPattern(normalizedQuery)) {
            return 'analytical_programming';
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

    private containsAnalyticalCodePattern(query: string): boolean {
        const analyticalCodePatterns = [
            /analyze.*data/i, /data.*analysis/i, /calculate/i, /computation/i, /compute/i,
            /plot/i, /chart/i, /graph/i, /visualization/i, /visualize/i,
            /python.*code/i, /code.*python/i, /pandas/i, /numpy/i, /matplotlib/i,
            /generate.*script/i, /script.*generate/i, /write.*code/i, /code.*write/i,
            /statistical.*analysis/i, /machine.*learning/i, /data.*science/i
        ];
        return analyticalCodePatterns.some(pattern => pattern.test(query));
    }

    private containsAnalyticalProgrammingPattern(query: string): boolean {
        const analyticalProgrammingPatterns = [
            /programming.*analysis/i, /analytical.*programming/i, /automate.*analysis/i,
            /generate.*algorithm/i, /algorithm.*generate/i, /implement.*solution/i,
            /solution.*implement/i, /build.*model/i, /model.*build/i,
            /create.*function/i, /function.*create/i, /develop.*script/i, /script.*develop/i
        ];
        return analyticalProgrammingPatterns.some(pattern => pattern.test(query));
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