import { v4 as uuidv4 } from 'uuid';
import { createServiceLogger } from '../utils/logger-factory';

/**
 * Types of analytical queries that can be detected
 */
export enum QueryType {
  DESCRIPTIVE = 'descriptive',     // What happened?
  DIAGNOSTIC = 'diagnostic',       // Why did it happen?
  PREDICTIVE = 'predictive',       // What will happen?
  PRESCRIPTIVE = 'prescriptive',   // What should we do?
  COMPARATIVE = 'comparative',     // How does X compare to Y?
  CORRELATION = 'correlation',     // Is X related to Y?
  TREND = 'trend',                 // How has X changed over time?
  ANOMALY = 'anomaly',             // Are there any outliers or unusual patterns?
  RANKING = 'ranking',             // What are the top/bottom items?
  SEGMENTATION = 'segmentation',   // How can the data be grouped?
  DISTRIBUTION = 'distribution',   // How is X distributed?
  GENERAL = 'general'              // General query
}

/**
 * Domains of analysis
 */
export enum AnalysisDomain {
  SALES = 'sales',
  MARKETING = 'marketing',
  FINANCE = 'finance',
  OPERATIONS = 'operations',
  HUMAN_RESOURCES = 'human_resources',
  CUSTOMER_SERVICE = 'customer_service',
  PRODUCT = 'product',
  GENERAL = 'general'
}

/**
 * Complexity levels of queries
 */
export enum QueryComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Results of query analysis
 */
export interface QueryAnalysisResult {
  id: string;
  originalQuery: string;
  queryType: QueryType;
  domain: AnalysisDomain;
  complexity: QueryComplexity;
  entities: string[];
  temporalAspects: {
    hasTemporalReference: boolean;
    timeFrame?: 'past' | 'present' | 'future';
    timePeriod?: string;
    isTimeSeries: boolean;
    timeGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    timeRange?: {
      start?: string;
      end?: string;
      duration?: number;
      unit?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    };
    isComparison?: boolean;
    comparisonType?: 'year-over-year' | 'month-over-month' | 'quarter-over-quarter' | 'period-over-period' | 'sequential';
  };
  dataRequirements: {
    requiredVariables: string[];
    optionalVariables: string[];
    aggregations: string[];
    filters: string[];
    groupBy?: string[];
    sortBy?: { field: string; direction: 'asc' | 'desc' }[];
    limit?: number;
    calculations?: string[];
  };
  suggestedAnalyses: string[];
  suggestedVisualizations: string[];
  confidenceScore: number;
}

/**
 * Follow-up question for clarification
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  possibleAnswers?: string[];
  impact: 'high' | 'medium' | 'low';
  answerField: string;
}

/**
 * Service for NLP processing and query understanding
 */
export class NlpProcessorService {
  private static instance: NlpProcessorService;
  private readonly logger = createServiceLogger('NlpProcessorService');

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NlpProcessorService {
    if (!NlpProcessorService.instance) {
      NlpProcessorService.instance = new NlpProcessorService();
    }
    return NlpProcessorService.instance;
  }

  /**
   * Analyze a query to determine its type, complexity, and requirements
   * @param query The user's query
   * @returns Analysis result
   */
  public analyzeQuery(query: string): QueryAnalysisResult {
    try {
      const normalizedQuery = this.normalizeQuery(query);
      
      // Detect query type
      const queryType = this.detectQueryType(normalizedQuery);
      
      // Identify domain
      const domain = this.identifyDomain(normalizedQuery);
      
      // Extract entities
      const entities = this.extractEntities(normalizedQuery);
      
      // Determine complexity
      const complexity = this.determineQueryComplexity(normalizedQuery, queryType, entities);
      
      // Analyze temporal aspects
      const temporalAspects = this.analyzeTemporal(normalizedQuery);
      
      // Identify data requirements
      const dataRequirements = this.identifyDataRequirements(normalizedQuery, queryType, entities);
      
      // Suggest analyses and visualizations
      const suggestedAnalyses = this.suggestAnalyses(queryType, domain, entities, temporalAspects);
      const suggestedVisualizations = this.suggestVisualizations(queryType, dataRequirements);
      
      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(queryType, entities, dataRequirements);
      
      return {
        id: uuidv4(),
        originalQuery: query,
        queryType,
        domain,
        complexity,
        entities,
        temporalAspects,
        dataRequirements,
        suggestedAnalyses,
        suggestedVisualizations,
        confidenceScore
      };
    } catch (error) {
      this.logger.error('Error analyzing query:', error);
      
      // Return a default analysis with low confidence
      return {
        id: uuidv4(),
        originalQuery: query,
        queryType: QueryType.GENERAL,
        domain: AnalysisDomain.GENERAL,
        complexity: QueryComplexity.MEDIUM,
        entities: [],
        temporalAspects: {
          hasTemporalReference: false,
          isTimeSeries: false
        },
        dataRequirements: {
          requiredVariables: [],
          optionalVariables: [],
          aggregations: [],
          filters: []
        },
        suggestedAnalyses: [],
        suggestedVisualizations: [],
        confidenceScore: 0.3
      };
    }
  }

  /**
   * Normalize a query by converting to lowercase, removing extra spaces, etc.
   * @param query The query to normalize
   * @returns Normalized query
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect the type of query
   * @param query The normalized query
   * @returns Query type
   */
  private detectQueryType(query: string): QueryType {
    // Enhanced pattern matching with weighted scoring system
    const queryTypePatterns = {
      [QueryType.DESCRIPTIVE]: [
        { pattern: /what happened/i, weight: 2 },
        { pattern: /show me/i, weight: 1 },
        { pattern: /display/i, weight: 1 },
        { pattern: /list/i, weight: 1 },
        { pattern: /what is/i, weight: 1 },
        { pattern: /what are/i, weight: 1 },
        { pattern: /how many/i, weight: 1.5 },
        { pattern: /summary of/i, weight: 1.5 },
        { pattern: /overview of/i, weight: 1.5 },
        { pattern: /details (on|about)/i, weight: 1.5 },
        { pattern: /statistics (on|about)/i, weight: 1.5 },
        { pattern: /data (on|about)/i, weight: 1 }
      ],
      [QueryType.DIAGNOSTIC]: [
        { pattern: /\bwhy\b/i, weight: 2 },
        { pattern: /what caused/i, weight: 2 },
        { pattern: /reason for/i, weight: 1.5 },
        { pattern: /explain/i, weight: 1 },
        { pattern: /analysis of/i, weight: 1 },
        { pattern: /analyze why/i, weight: 2 },
        { pattern: /root cause/i, weight: 2 },
        { pattern: /factors (affecting|influencing|causing)/i, weight: 1.5 },
        { pattern: /diagnose/i, weight: 2 },
        { pattern: /understand (why|how)/i, weight: 1.5 },
        { pattern: /due to/i, weight: 1 },
        { pattern: /because of/i, weight: 1 }
      ],
      [QueryType.PREDICTIVE]: [
        { pattern: /predict/i, weight: 2 },
        { pattern: /forecast/i, weight: 2 },
        { pattern: /will happen/i, weight: 2 },
        { pattern: /future/i, weight: 1.5 },
        { pattern: /next/i, weight: 1 },
        { pattern: /upcoming/i, weight: 1.5 },
        { pattern: /projection/i, weight: 1.5 },
        { pattern: /estimate/i, weight: 1 },
        { pattern: /anticipate/i, weight: 1.5 },
        { pattern: /expected/i, weight: 1 },
        { pattern: /likely to/i, weight: 1.5 },
        { pattern: /probability of/i, weight: 1.5 },
        { pattern: /potential/i, weight: 0.5 }
      ],
      [QueryType.PRESCRIPTIVE]: [
        { pattern: /what should/i, weight: 2 },
        { pattern: /recommend/i, weight: 2 },
        { pattern: /suggestion/i, weight: 1.5 },
        { pattern: /best course of action/i, weight: 2 },
        { pattern: /how to improve/i, weight: 1.5 },
        { pattern: /how can we/i, weight: 1 },
        { pattern: /optimize/i, weight: 1.5 },
        { pattern: /best way to/i, weight: 1.5 },
        { pattern: /strategy for/i, weight: 1.5 },
        { pattern: /action plan/i, weight: 1.5 },
        { pattern: /steps to/i, weight: 1 },
        { pattern: /advice on/i, weight: 1.5 },
        { pattern: /should we/i, weight: 1.5 }
      ],
      [QueryType.COMPARATIVE]: [
        { pattern: /compare/i, weight: 2 },
        { pattern: /versus/i, weight: 2 },
        { pattern: / vs /i, weight: 2 },
        { pattern: /difference between/i, weight: 2 },
        { pattern: /how does.*compare/i, weight: 2 },
        { pattern: /relative to/i, weight: 1.5 },
        { pattern: /against/i, weight: 1 },
        { pattern: /better than/i, weight: 1.5 },
        { pattern: /worse than/i, weight: 1.5 },
        { pattern: /similar to/i, weight: 1 },
        { pattern: /performance of.*compared to/i, weight: 2 },
        { pattern: /contrast/i, weight: 1.5 }
      ],
      [QueryType.CORRELATION]: [
        { pattern: /correlation/i, weight: 2 },
        { pattern: /relationship between/i, weight: 2 },
        { pattern: /related to/i, weight: 1.5 },
        { pattern: /connection between/i, weight: 1.5 },
        { pattern: /impact of/i, weight: 1.5 },
        { pattern: /effect of/i, weight: 1.5 },
        { pattern: /influence/i, weight: 1 },
        { pattern: /associated with/i, weight: 1.5 },
        { pattern: /dependency/i, weight: 1.5 },
        { pattern: /cause and effect/i, weight: 2 },
        { pattern: /does.*affect/i, weight: 1.5 },
        { pattern: /linked to/i, weight: 1 }
      ],
      [QueryType.TREND]: [
        { pattern: /trend/i, weight: 2 },
        { pattern: /over time/i, weight: 2 },
        { pattern: /historical/i, weight: 1.5 },
        { pattern: /pattern/i, weight: 1 },
        { pattern: /growth/i, weight: 1 },
        { pattern: /decline/i, weight: 1 },
        { pattern: /change in/i, weight: 1 },
        { pattern: /evolution/i, weight: 1.5 },
        { pattern: /development/i, weight: 1 },
        { pattern: /progression/i, weight: 1.5 },
        { pattern: /trajectory/i, weight: 1.5 },
        { pattern: /history of/i, weight: 1 },
        { pattern: /(increasing|decreasing) over/i, weight: 1.5 }
      ],
      [QueryType.ANOMALY]: [
        { pattern: /anomaly/i, weight: 2 },
        { pattern: /outlier/i, weight: 2 },
        { pattern: /unusual/i, weight: 1.5 },
        { pattern: /abnormal/i, weight: 1.5 },
        { pattern: /deviation/i, weight: 1.5 },
        { pattern: /unexpected/i, weight: 1 },
        { pattern: /irregular/i, weight: 1.5 },
        { pattern: /strange/i, weight: 1 },
        { pattern: /odd/i, weight: 1 },
        { pattern: /suspicious/i, weight: 1.5 },
        { pattern: /out of ordinary/i, weight: 1.5 },
        { pattern: /exception/i, weight: 1.5 },
        { pattern: /inconsistent/i, weight: 1 }
      ],
      [QueryType.RANKING]: [
        { pattern: /\btop\b/i, weight: 2 },
        { pattern: /\bbottom\b/i, weight: 2 },
        { pattern: /highest/i, weight: 1.5 },
        { pattern: /lowest/i, weight: 1.5 },
        { pattern: /best/i, weight: 1 },
        { pattern: /worst/i, weight: 1 },
        { pattern: /rank/i, weight: 2 },
        { pattern: /leading/i, weight: 1 },
        { pattern: /trailing/i, weight: 1 },
        { pattern: /\bmost\b/i, weight: 1.5 },
        { pattern: /\bleast\b/i, weight: 1.5 },
        { pattern: /\branking\b/i, weight: 2 },
        { pattern: /\border\b/i, weight: 1 }
      ],
      [QueryType.SEGMENTATION]: [
        { pattern: /segment/i, weight: 2 },
        { pattern: /group/i, weight: 1.5 },
        { pattern: /categorize/i, weight: 1.5 },
        { pattern: /classify/i, weight: 1.5 },
        { pattern: /cluster/i, weight: 2 },
        { pattern: /breakdown/i, weight: 1.5 },
        { pattern: /divide/i, weight: 1 },
        { pattern: /partition/i, weight: 1.5 },
        { pattern: /split/i, weight: 1 },
        { pattern: /separate/i, weight: 1 },
        { pattern: /taxonomy/i, weight: 1.5 },
        { pattern: /classification/i, weight: 1.5 },
        { pattern: /by (category|type|group)/i, weight: 1.5 }
      ],
      [QueryType.DISTRIBUTION]: [
        { pattern: /distribution/i, weight: 2 },
        { pattern: /spread/i, weight: 1.5 },
        { pattern: /frequency/i, weight: 1.5 },
        { pattern: /histogram/i, weight: 2 },
        { pattern: /density/i, weight: 1.5 },
        { pattern: /dispersion/i, weight: 1.5 },
        { pattern: /range/i, weight: 1 },
        { pattern: /variation/i, weight: 1 },
        { pattern: /scattered/i, weight: 1 },
        { pattern: /percentile/i, weight: 1.5 },
        { pattern: /quartile/i, weight: 1.5 },
        { pattern: /statistical distribution/i, weight: 2 },
        { pattern: /normal curve/i, weight: 1.5 }
      ]
    };

    // Calculate scores for each query type
    const scores = Object.entries(queryTypePatterns).reduce((acc, [type, patterns]) => {
      const typeScore = patterns.reduce((score, { pattern, weight }) => {
        return score + (pattern.test(query) ? weight : 0);
      }, 0);
      acc[type] = typeScore;
      return acc;
    }, {} as Record<string, number>);

    // Find the query type with the highest score
    let highestScore = 0;
    let detectedType = QueryType.GENERAL;

    for (const [type, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        detectedType = type as QueryType;
      }
    }

    // If the highest score is below a threshold, return GENERAL
    if (highestScore < 1.5) {
      return QueryType.GENERAL;
    }

    // Consider context for ambiguous cases
    if (highestScore < 3) {
      // If close scores between DESCRIPTIVE and DIAGNOSTIC, check for specific indicators
      if (scores[QueryType.DESCRIPTIVE] > 0 && scores[QueryType.DIAGNOSTIC] > 0) {
        if (query.includes('why') || query.includes('cause')) {
          return QueryType.DIAGNOSTIC;
        }
      }
      
      // If close scores between PREDICTIVE and PRESCRIPTIVE, check for specific indicators
      if (scores[QueryType.PREDICTIVE] > 0 && scores[QueryType.PRESCRIPTIVE] > 0) {
        if (query.includes('should') || query.includes('recommend')) {
          return QueryType.PRESCRIPTIVE;
        }
      }
      
      // If close scores between TREND and COMPARATIVE, check for specific indicators
      if (scores[QueryType.TREND] > 0 && scores[QueryType.COMPARATIVE] > 0) {
        if (query.includes('over time') || query.includes('historical')) {
          return QueryType.TREND;
        } else if (query.includes('compare') || query.includes('versus')) {
          return QueryType.COMPARATIVE;
        }
      }
    }

    return detectedType;
  }

  /**
   * Identify the domain of the query
   * @param query The normalized query
   * @returns Domain
   */
  private identifyDomain(query: string): AnalysisDomain {
    // Enhanced domain detection with weighted scoring system
    const domainPatterns = {
      [AnalysisDomain.SALES]: [
        { pattern: /\bsales\b/i, weight: 2 },
        { pattern: /\brevenue\b/i, weight: 2 },
        { pattern: /\bprofit\b/i, weight: 1.5 },
        { pattern: /\bcustomer\b/i, weight: 1 },
        { pattern: /\bpurchase\b/i, weight: 1.5 },
        { pattern: /\border\b/i, weight: 1.5 },
        { pattern: /\btransaction\b/i, weight: 1.5 },
        { pattern: /\bconversion\b/i, weight: 1 },
        { pattern: /\bsell\b/i, weight: 1.5 },
        { pattern: /\bbuyer\b/i, weight: 1.5 },
        { pattern: /\bsold\b/i, weight: 1.5 },
        { pattern: /\bprice\b/i, weight: 1 },
        { pattern: /\bdiscount\b/i, weight: 1.5 },
        { pattern: /\bpromotion\b/i, weight: 1 },
        { pattern: /\bdeal\b/i, weight: 0.5 }
      ],
      [AnalysisDomain.MARKETING]: [
        { pattern: /\bmarketing\b/i, weight: 2 },
        { pattern: /\bcampaign\b/i, weight: 2 },
        { pattern: /\blead\b/i, weight: 1.5 },
        { pattern: /\bconversion\b/i, weight: 1.5 },
        { pattern: /\bclick\b/i, weight: 1.5 },
        { pattern: /\bimpression\b/i, weight: 1.5 },
        { pattern: /\bengagement\b/i, weight: 1.5 },
        { pattern: /\bsocial media\b/i, weight: 2 },
        { pattern: /\badvertis(ing|ement)\b/i, weight: 2 },
        { pattern: /\bbrand\b/i, weight: 1.5 },
        { pattern: /\bseo\b/i, weight: 2 },
        { pattern: /\bcontent\b/i, weight: 1 },
        { pattern: /\bemail\b/i, weight: 1 },
        { pattern: /\bwebsite traffic\b/i, weight: 1.5 },
        { pattern: /\bctr\b/i, weight: 2 },
        { pattern: /\bcpc\b/i, weight: 2 },
        { pattern: /\bcpm\b/i, weight: 2 },
        { pattern: /\bchannel\b/i, weight: 1 }
      ],
      [AnalysisDomain.FINANCE]: [
        { pattern: /\bfinance\b/i, weight: 2 },
        { pattern: /\bfinancial\b/i, weight: 2 },
        { pattern: /\bexpense\b/i, weight: 1.5 },
        { pattern: /\bcost\b/i, weight: 1 },
        { pattern: /\bbudget\b/i, weight: 1.5 },
        { pattern: /\binvestment\b/i, weight: 1.5 },
        { pattern: /\bcash flow\b/i, weight: 2 },
        { pattern: /\bbalance sheet\b/i, weight: 2 },
        { pattern: /\bincome statement\b/i, weight: 2 },
        { pattern: /\bprofit and loss\b/i, weight: 2 },
        { pattern: /\bp&l\b/i, weight: 2 },
        { pattern: /\baccounting\b/i, weight: 1.5 },
        { pattern: /\btax\b/i, weight: 1.5 },
        { pattern: /\bdebt\b/i, weight: 1.5 },
        { pattern: /\basset\b/i, weight: 1.5 },
        { pattern: /\bliabilit(y|ies)\b/i, weight: 1.5 },
        { pattern: /\bequity\b/i, weight: 1.5 },
        { pattern: /\bmargin\b/i, weight: 1 },
        { pattern: /\broi\b/i, weight: 1.5 },
        { pattern: /\breturn on investment\b/i, weight: 1.5 }
      ],
      [AnalysisDomain.OPERATIONS]: [
        { pattern: /\boperations\b/i, weight: 2 },
        { pattern: /\bproduction\b/i, weight: 2 },
        { pattern: /\bsupply chain\b/i, weight: 2 },
        { pattern: /\binventory\b/i, weight: 1.5 },
        { pattern: /\blogistics\b/i, weight: 1.5 },
        { pattern: /\bmanufacturing\b/i, weight: 2 },
        { pattern: /\bdelivery\b/i, weight: 1.5 },
        { pattern: /\bwarehouse\b/i, weight: 1.5 },
        { pattern: /\bsupplier\b/i, weight: 1.5 },
        { pattern: /\bprocurement\b/i, weight: 1.5 },
        { pattern: /\bquality control\b/i, weight: 1.5 },
        { pattern: /\befficiency\b/i, weight: 1 },
        { pattern: /\bprocess\b/i, weight: 1 },
        { pattern: /\boutput\b/i, weight: 1 },
        { pattern: /\bcapacity\b/i, weight: 1.5 },
        { pattern: /\butilization\b/i, weight: 1.5 },
        { pattern: /\bworkflow\b/i, weight: 1.5 }
      ],
      [AnalysisDomain.HUMAN_RESOURCES]: [
        { pattern: /\bhr\b/i, weight: 2 },
        { pattern: /\bhuman resources\b/i, weight: 2 },
        { pattern: /\bemployee\b/i, weight: 1.5 },
        { pattern: /\bstaff\b/i, weight: 1.5 },
        { pattern: /\bhiring\b/i, weight: 1.5 },
        { pattern: /\brecruitment\b/i, weight: 1.5 },
        { pattern: /\bturnover\b/i, weight: 1.5 },
        { pattern: /\bretention\b/i, weight: 1.5 },
        { pattern: /\btalent\b/i, weight: 1.5 },
        { pattern: /\bperformance review\b/i, weight: 2 },
        { pattern: /\bcompensation\b/i, weight: 1.5 },
        { pattern: /\bsalary\b/i, weight: 1.5 },
        { pattern: /\bbenefits\b/i, weight: 1.5 },
        { pattern: /\bonboarding\b/i, weight: 1.5 },
        { pattern: /\btraining\b/i, weight: 1 },
        { pattern: /\bskill\b/i, weight: 1 },
        { pattern: /\bcareer\b/i, weight: 1 },
        { pattern: /\bworkforce\b/i, weight: 1.5 }
      ],
      [AnalysisDomain.CUSTOMER_SERVICE]: [
        { pattern: /\bcustomer service\b/i, weight: 2 },
        { pattern: /\bsupport\b/i, weight: 1.5 },
        { pattern: /\bticket\b/i, weight: 1.5 },
        { pattern: /\bcomplaint\b/i, weight: 1.5 },
        { pattern: /\bresolution\b/i, weight: 1.5 },
        { pattern: /\bsatisfaction\b/i, weight: 1.5 },
        { pattern: /\bfeedback\b/i, weight: 1.5 },
        { pattern: /\bhelp desk\b/i, weight: 2 },
        { pattern: /\bcsat\b/i, weight: 2 },
        { pattern: /\bnps\b/i, weight: 2 },
        { pattern: /\bnet promoter score\b/i, weight: 2 },
        { pattern: /\bresponse time\b/i, weight: 1.5 },
        { pattern: /\btime to resolution\b/i, weight: 1.5 },
        { pattern: /\bcustomer experience\b/i, weight: 1.5 },
        { pattern: /\bcx\b/i, weight: 1.5 },
        { pattern: /\bservice level\b/i, weight: 1.5 },
        { pattern: /\bsla\b/i, weight: 1.5 }
      ],
      [AnalysisDomain.PRODUCT]: [
        { pattern: /\bproduct\b/i, weight: 2 },
        { pattern: /\bfeature\b/i, weight: 1.5 },
        { pattern: /\busage\b/i, weight: 1.5 },
        { pattern: /\badoption\b/i, weight: 1.5 },
        { pattern: /\bperformance\b/i, weight: 1 },
        { pattern: /\bquality\b/i, weight: 1 },
        { pattern: /\buser\b/i, weight: 1 },
        { pattern: /\bfunctionality\b/i, weight: 1.5 },
        { pattern: /\brelease\b/i, weight: 1.5 },
        { pattern: /\bversion\b/i, weight: 1 },
        { pattern: /\bupdate\b/i, weight: 1 },
        { pattern: /\bproduct development\b/i, weight: 2 },
        { pattern: /\bproduct management\b/i, weight: 2 },
        { pattern: /\bproduct lifecycle\b/i, weight: 2 },
        { pattern: /\buser experience\b/i, weight: 1.5 },
        { pattern: /\bux\b/i, weight: 1.5 },
        { pattern: /\bui\b/i, weight: 1 },
        { pattern: /\bdesign\b/i, weight: 1 }
      ]
    };

    // Calculate scores for each domain
    const scores = Object.entries(domainPatterns).reduce((acc, [domain, patterns]) => {
      const domainScore = patterns.reduce((score, { pattern, weight }) => {
        return score + (pattern.test(query) ? weight : 0);
      }, 0);
      acc[domain] = domainScore;
      return acc;
    }, {} as Record<string, number>);

    // Find the domain with the highest score
    let highestScore = 0;
    let detectedDomain = AnalysisDomain.GENERAL;

    for (const [domain, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        detectedDomain = domain as AnalysisDomain;
      }
    }

    // If the highest score is below a threshold, return GENERAL
    if (highestScore < 1.5) {
      return AnalysisDomain.GENERAL;
    }

    // Handle domain overlaps with context-based disambiguation
    if (highestScore < 3) {
      // Sales vs Marketing overlap
      if (scores[AnalysisDomain.SALES] > 0 && scores[AnalysisDomain.MARKETING] > 0) {
        const salesSpecific = /\bsales figures\b|\bsales performance\b|\bsales target\b|\bsales goal\b/i;
        const marketingSpecific = /\bcampaign performance\b|\bad spend\b|\bmarketing roi\b|\bchannel effectiveness\b/i;
        
        if (salesSpecific.test(query)) {
          return AnalysisDomain.SALES;
        } else if (marketingSpecific.test(query)) {
          return AnalysisDomain.MARKETING;
        }
      }
      
      // Finance vs Operations overlap
      if (scores[AnalysisDomain.FINANCE] > 0 && scores[AnalysisDomain.OPERATIONS] > 0) {
        const financeSpecific = /\bfinancial report\b|\bbalance sheet\b|\bcash position\b|\bprofit margin\b/i;
        const operationsSpecific = /\bproduction efficiency\b|\bsupply chain\b|\bmanufacturing process\b|\boperational cost\b/i;
        
        if (financeSpecific.test(query)) {
          return AnalysisDomain.FINANCE;
        } else if (operationsSpecific.test(query)) {
      return AnalysisDomain.OPERATIONS;
    }
      }
      
      // Product vs Customer Service overlap
      if (scores[AnalysisDomain.PRODUCT] > 0 && scores[AnalysisDomain.CUSTOMER_SERVICE] > 0) {
        const productSpecific = /\bproduct feature\b|\bproduct usage\b|\buser adoption\b|\bfeature performance\b/i;
        const customerServiceSpecific = /\bcustomer complaint\b|\bsupport ticket\b|\bcustomer satisfaction\b|\bresponse time\b/i;
        
        if (productSpecific.test(query)) {
      return AnalysisDomain.PRODUCT;
        } else if (customerServiceSpecific.test(query)) {
          return AnalysisDomain.CUSTOMER_SERVICE;
        }
      }
    }
    
    return detectedDomain;
  }

  /**
   * Extract entities from the query
   * @param query The normalized query
   * @returns Array of entities
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // Stage 1: Extract basic entities using common patterns
    // Common business entities to look for
    const entityPatterns = [
      // Time periods
      { pattern: /last (year|month|quarter|week|day)/g, type: 'time_period' },
      { pattern: /next (year|month|quarter|week|day)/g, type: 'time_period' },
      { pattern: /this (year|month|quarter|week|day)/g, type: 'time_period' },
      { pattern: /(\d+) (years|months|quarters|weeks|days) ago/g, type: 'time_period' },
      { pattern: /(\d{4})-(\d{2})-(\d{2})/g, type: 'date' }, // YYYY-MM-DD
      { pattern: /(\d{4})-(\d{2})/g, type: 'month' }, // YYYY-MM
      { pattern: /(\d{4})q([1-4])/g, type: 'quarter' }, // YYYYq1, YYYYq2, etc.
      { pattern: /(\d{4})/g, type: 'year' }, // YYYY
      
      // Metrics
      { pattern: /revenue/g, type: 'metric' },
      { pattern: /sales/g, type: 'metric' },
      { pattern: /profit/g, type: 'metric' },
      { pattern: /margin/g, type: 'metric' },
      { pattern: /cost/g, type: 'metric' },
      { pattern: /conversion rate/g, type: 'metric' },
      { pattern: /click-through rate/g, type: 'metric' },
      { pattern: /engagement/g, type: 'metric' },
      { pattern: /retention/g, type: 'metric' },
      { pattern: /churn/g, type: 'metric' },
      { pattern: /roi/g, type: 'metric' },
      { pattern: /cac/g, type: 'metric' },
      { pattern: /ltv/g, type: 'metric' },
      { pattern: /arpu/g, type: 'metric' },
      { pattern: /ctr/g, type: 'metric' },
      { pattern: /cpc/g, type: 'metric' },
      { pattern: /cpa/g, type: 'metric' },
      { pattern: /nps/g, type: 'metric' },
      { pattern: /csat/g, type: 'metric' },
      
      // Dimensions
      { pattern: /region/g, type: 'dimension' },
      { pattern: /country/g, type: 'dimension' },
      { pattern: /state/g, type: 'dimension' },
      { pattern: /city/g, type: 'dimension' },
      { pattern: /product( category)?/g, type: 'dimension' },
      { pattern: /customer( segment)?/g, type: 'dimension' },
      { pattern: /channel/g, type: 'dimension' },
      { pattern: /department/g, type: 'dimension' },
      { pattern: /industry/g, type: 'dimension' },
      { pattern: /sector/g, type: 'dimension' },
      { pattern: /market/g, type: 'dimension' },
      { pattern: /segment/g, type: 'dimension' },
      { pattern: /demographic/g, type: 'dimension' },
      { pattern: /age group/g, type: 'dimension' },
      { pattern: /gender/g, type: 'dimension' },
      { pattern: /location/g, type: 'dimension' },
      
      // Named entities (simplified approach)
      { pattern: /([A-Z][a-z]+ )+[A-Z][a-z]+/g, type: 'named_entity' }, // Proper nouns
    ];
    
    // Extract entities using patterns
    for (const { pattern, type } of entityPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (!entities.includes(match)) {
            entities.push(match);
          }
        }
      }
    }
    
    // Stage 2: Extract more complex entities using noun phrases
    // Extract entities using noun phrases (enhanced)
    const nounPhrasePatterns = [
      // Business metrics
      /(\w+ ){0,2}(sales|revenue|profit|cost|margin|conversion|retention)( \w+){0,2}/g,
      /(\w+ ){0,2}(customer|product|service|market|channel)( \w+){0,2}/g,
      /(\w+ ){0,2}(performance|growth|decline|increase|decrease|trend)( \w+){0,2}/g,
      
      // Financial metrics
      /(\w+ ){0,2}(roi|return on investment|cash flow|budget|expense)( \w+){0,2}/g,
      /(\w+ ){0,2}(revenue|profit|margin|cost|price|discount)( \w+){0,2}/g,
      
      // Marketing metrics
      /(\w+ ){0,2}(campaign|lead|conversion|click|impression|engagement)( \w+){0,2}/g,
      /(\w+ ){0,2}(ctr|cpc|cpa|cpm|acquisition|retention)( \w+){0,2}/g,
      
      // Product metrics
      /(\w+ ){0,2}(usage|adoption|feature|performance|quality|rating)( \w+){0,2}/g,
      
      // Customer metrics
      /(\w+ ){0,2}(satisfaction|nps|csat|feedback|complaint|support)( \w+){0,2}/g,
      /(\w+ ){0,2}(churn|retention|loyalty|lifetime value|ltv)( \w+){0,2}/g,
      
      // Time-based patterns
      /(\w+ ){0,2}(daily|weekly|monthly|quarterly|yearly|annual)( \w+){0,2}/g,
      /(\w+ ){0,2}(trend|growth|decline|change|comparison)( \w+){0,2}/g,
    ];
    
    for (const pattern of nounPhrasePatterns) {
      const matches = query.match(pattern);
      if (matches) {
        for (const match of matches) {
          const trimmedMatch = match.trim();
          if (!entities.includes(trimmedMatch) && trimmedMatch.split(' ').length > 1) {
            entities.push(trimmedMatch);
          }
        }
      }
    }
    
    // Stage 3: Extract numerical entities and ranges
    const numericalPatterns = [
      // Percentages
      { pattern: /(\d+(\.\d+)?)\s*%/g, type: 'percentage' },
      
      // Currency values
      { pattern: /\$\s*(\d+(\.\d+)?)/g, type: 'currency' },
      { pattern: /(\d+(\.\d+)?)\s*(dollars|euros|pounds)/g, type: 'currency' },
      
      // Ranges
      { pattern: /between\s+(\d+(\.\d+)?)\s+and\s+(\d+(\.\d+)?)/g, type: 'range' },
      { pattern: /from\s+(\d+(\.\d+)?)\s+to\s+(\d+(\.\d+)?)/g, type: 'range' },
      
      // Comparisons
      { pattern: /(greater|more|higher|larger)\s+than\s+(\d+(\.\d+)?)/g, type: 'comparison' },
      { pattern: /(less|lower|smaller|fewer)\s+than\s+(\d+(\.\d+)?)/g, type: 'comparison' },
      
      // Simple numbers (only if they appear to be significant)
      { pattern: /\b(\d{3,}(\.\d+)?)\b/g, type: 'number' },
    ];
    
    for (const { pattern, type } of numericalPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (!entities.includes(match)) {
            entities.push(match);
          }
        }
      }
    }
    
    // Deduplicate and clean entities
    return [...new Set(entities)].filter(entity => 
      // Filter out common words that might be incorrectly extracted
      !['the', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about'].includes(entity.toLowerCase())
    );
  }

  /**
   * Determine the complexity of a query
   * @param query The normalized query
   * @param queryType The type of query
   * @param entities The entities in the query
   * @returns Query complexity
   */
  private determineQueryComplexity(
    query: string,
    queryType: QueryType,
    entities: string[]
  ): QueryComplexity {
    // Stage 1: Basic complexity indicators
    // Count the number of entities
    const entityCount = entities.length;
    
    // Count the number of operations (and, or, not, etc.)
    const operationCount = (query.match(/\b(and|or|not|but|except|excluding|including|only|where)\b/g) || []).length;
    
    // Count the number of comparison operators
    const comparisonCount = (query.match(/(greater than|less than|equal to|more than|less than|at least|at most|between|above|below|over|under)/g) || []).length;
    
    // Stage 2: Advanced complexity indicators
    // Check for complex query types
    const complexQueryTypes = {
      [QueryType.PREDICTIVE]: 2.5,
      [QueryType.PRESCRIPTIVE]: 2.5,
      [QueryType.CORRELATION]: 2,
      [QueryType.ANOMALY]: 2,
      [QueryType.SEGMENTATION]: 1.5,
      [QueryType.DISTRIBUTION]: 1.5,
      [QueryType.TREND]: 1.5,
      [QueryType.COMPARATIVE]: 1,
      [QueryType.RANKING]: 1,
      [QueryType.DESCRIPTIVE]: 0.5,
      [QueryType.DIAGNOSTIC]: 1,
      [QueryType.GENERAL]: 0
    };
    
    const queryTypeComplexity = complexQueryTypes[queryType] || 0;
    
    // Check for multi-part questions
    const questionCount = (query.match(/\?/g) || []).length;
    const multiPartQuestionScore = questionCount > 1 ? 2 : 0;
    
    // Check for temporal complexity
    const temporalComplexity = this.calculateTemporalComplexity(query);
    
    // Check for specific complex phrases
    const complexPhrasePatterns = [
      { pattern: /correlation/i, weight: 1.5 },
      { pattern: /regression/i, weight: 2 },
      { pattern: /forecast/i, weight: 1.5 },
      { pattern: /predict/i, weight: 1.5 },
      { pattern: /anomaly/i, weight: 1.5 },
      { pattern: /outlier/i, weight: 1.5 },
      { pattern: /segment/i, weight: 1 },
      { pattern: /cluster/i, weight: 1.5 },
      { pattern: /statistical/i, weight: 1 },
      { pattern: /significance/i, weight: 1.5 },
      { pattern: /confidence interval/i, weight: 1.5 },
      { pattern: /trend analysis/i, weight: 1 },
      { pattern: /seasonality/i, weight: 1.5 },
      { pattern: /year-over-year/i, weight: 1 },
      { pattern: /month-over-month/i, weight: 1 },
      { pattern: /growth rate/i, weight: 0.5 },
      { pattern: /standard deviation/i, weight: 1.5 },
      { pattern: /variance/i, weight: 1.5 },
      { pattern: /distribution/i, weight: 1 },
      { pattern: /percentile/i, weight: 1 },
      { pattern: /quartile/i, weight: 1 },
      { pattern: /median/i, weight: 0.5 },
      { pattern: /average/i, weight: 0.5 },
      { pattern: /mean/i, weight: 0.5 },
      { pattern: /mode/i, weight: 0.5 },
      { pattern: /rank/i, weight: 0.5 },
      { pattern: /normalize/i, weight: 1 },
      { pattern: /weighted/i, weight: 1 },
      { pattern: /compound annual growth rate/i, weight: 1.5 },
      { pattern: /cagr/i, weight: 1.5 },
      { pattern: /moving average/i, weight: 1 },
      { pattern: /rolling average/i, weight: 1 },
      { pattern: /cumulative/i, weight: 1 },
      { pattern: /aggregate/i, weight: 0.5 },
      { pattern: /breakdown/i, weight: 0.5 },
      { pattern: /drill down/i, weight: 1 },
      { pattern: /pivot/i, weight: 1 },
      { pattern: /cross-tabulation/i, weight: 1.5 },
      { pattern: /cohort/i, weight: 1.5 },
      { pattern: /funnel/i, weight: 1 },
      { pattern: /attribution/i, weight: 1.5 },
      { pattern: /multi-touch/i, weight: 1.5 }
    ];
    
    // Stage 3: Calculate final complexity score
    let complexityScore = 0;
    
    // Add entity-based complexity (with diminishing returns for many entities)
    complexityScore += Math.min(entityCount, 5) * 0.5;
    if (entityCount > 5) {
      complexityScore += Math.min(entityCount - 5, 5) * 0.3;
    }
    if (entityCount > 10) {
      complexityScore += Math.min(entityCount - 10, 10) * 0.1;
    }
    
    // Add operation-based complexity
    complexityScore += operationCount * 0.8;
    
    // Add comparison-based complexity
    complexityScore += comparisonCount * 1.2;
    
    // Add query type complexity
    complexityScore += queryTypeComplexity;
    
    // Add multi-part question complexity
    complexityScore += multiPartQuestionScore;
    
    // Add temporal complexity
    complexityScore += temporalComplexity;
    
    // Add complex phrase complexity
    for (const { pattern, weight } of complexPhrasePatterns) {
      if (pattern.test(query)) {
        complexityScore += weight;
      }
    }
    
    // Determine complexity level based on score
    if (complexityScore >= 6) {
      return QueryComplexity.HIGH;
    } else if (complexityScore >= 3) {
      return QueryComplexity.MEDIUM;
    } else {
      return QueryComplexity.LOW;
    }
  }
  
  /**
   * Calculate the complexity of temporal aspects in a query
   * @param query The normalized query
   * @returns Temporal complexity score
   */
  private calculateTemporalComplexity(query: string): number {
    let score = 0;
    
    // Check for multiple time periods
    const timePeriods = [
      /year/g, /month/g, /quarter/g, /week/g, /day/g, 
      /annual/g, /monthly/g, /quarterly/g, /weekly/g, /daily/g
    ];
    
    let timePeriodsCount = 0;
    for (const pattern of timePeriods) {
      const matches = query.match(pattern);
      if (matches) {
        timePeriodsCount += matches.length;
      }
    }
    
    // More than one time period increases complexity
    if (timePeriodsCount > 1) {
      score += Math.min(timePeriodsCount - 1, 3) * 0.5;
    }
    
    // Check for complex time comparisons
    const complexTimePatterns = [
      { pattern: /year[ -]over[ -]year/i, weight: 1 },
      { pattern: /month[ -]over[ -]month/i, weight: 1 },
      { pattern: /quarter[ -]over[ -]quarter/i, weight: 1 },
      { pattern: /compared to (last|previous)/i, weight: 0.8 },
      { pattern: /growth (since|from)/i, weight: 0.8 },
      { pattern: /trend over/i, weight: 0.8 },
      { pattern: /historical trend/i, weight: 0.8 },
      { pattern: /seasonality/i, weight: 1.2 },
      { pattern: /time series/i, weight: 1 },
      { pattern: /periodic/i, weight: 0.8 },
      { pattern: /frequency/i, weight: 0.8 },
      { pattern: /interval/i, weight: 0.5 },
      { pattern: /moving average/i, weight: 1 },
      { pattern: /rolling average/i, weight: 1 },
      { pattern: /cumulative/i, weight: 0.8 },
      { pattern: /to date/i, weight: 0.5 },
      { pattern: /ytd|mtd|qtd/i, weight: 0.5 },
      { pattern: /fiscal/i, weight: 0.5 },
      { pattern: /calendar/i, weight: 0.5 }
    ];
    
    for (const { pattern, weight } of complexTimePatterns) {
      if (pattern.test(query)) {
        score += weight;
      }
    }
    
    return score;
  }

  /**
   * Analyze temporal aspects of the query
   * @param query The normalized query
   * @returns Temporal aspects
   */
  private analyzeTemporal(query: string): {
    hasTemporalReference: boolean;
    timeFrame?: 'past' | 'present' | 'future';
    timePeriod?: string;
    isTimeSeries: boolean;
    timeGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    timeRange?: {
      start?: string;
      end?: string;
      duration?: number;
      unit?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    };
    isComparison?: boolean;
    comparisonType?: 'year-over-year' | 'month-over-month' | 'quarter-over-quarter' | 'period-over-period' | 'sequential';
  } {
    // Stage 1: Basic temporal detection
    // Check for temporal references
    const pastPatterns = [
      { pattern: /last (year|month|quarter|week|day)/i, weight: 2 },
      { pattern: /previous (year|month|quarter|week|day)/i, weight: 2 },
      { pattern: /(\d+) (years?|months?|quarters?|weeks?|days?) ago/i, weight: 2 },
      { pattern: /historical/i, weight: 1 },
      { pattern: /past/i, weight: 1.5 },
      { pattern: /before/i, weight: 1 },
      { pattern: /earlier/i, weight: 1 },
      { pattern: /prior/i, weight: 1.5 }
    ];
    
    const presentPatterns = [
      { pattern: /current/i, weight: 2 },
      { pattern: /this (year|month|quarter|week|day)/i, weight: 2 },
      { pattern: /now/i, weight: 1.5 },
      { pattern: /today/i, weight: 2 },
      { pattern: /present/i, weight: 1.5 },
      { pattern: /ongoing/i, weight: 1 },
      { pattern: /to date/i, weight: 1.5 },
      { pattern: /ytd|mtd|qtd|wtd/i, weight: 2 }
    ];
    
    const futurePatterns = [
      { pattern: /next (year|month|quarter|week|day)/i, weight: 2 },
      { pattern: /upcoming/i, weight: 1.5 },
      { pattern: /future/i, weight: 1.5 },
      { pattern: /forecast/i, weight: 2 },
      { pattern: /predict/i, weight: 2 },
      { pattern: /projection/i, weight: 2 },
      { pattern: /expected/i, weight: 1 },
      { pattern: /anticipated/i, weight: 1 },
      { pattern: /coming/i, weight: 1 }
    ];
    
    // Stage 2: Time series and granularity detection
    // Check for time series indicators
    const timeSeriesPatterns = [
      { pattern: /over time/i, weight: 2 },
      { pattern: /trend/i, weight: 2 },
      { pattern: /growth/i, weight: 1 },
      { pattern: /decline/i, weight: 1 },
      { pattern: /change/i, weight: 1 },
      { pattern: /evolution/i, weight: 1.5 },
      { pattern: /development/i, weight: 1 },
      { pattern: /progress/i, weight: 1 },
      { pattern: /history/i, weight: 1.5 },
      { pattern: /monthly/i, weight: 1.5 },
      { pattern: /quarterly/i, weight: 1.5 },
      { pattern: /yearly/i, weight: 1.5 },
      { pattern: /weekly/i, weight: 1.5 },
      { pattern: /daily/i, weight: 1.5 },
      { pattern: /time series/i, weight: 2 },
      { pattern: /trajectory/i, weight: 1.5 },
      { pattern: /pattern/i, weight: 1 }
    ];
    
    // Check for time granularity
    const granularityPatterns = {
      'day': [/daily/i, /day by day/i, /each day/i, /per day/i, /day/i],
      'week': [/weekly/i, /week by week/i, /each week/i, /per week/i, /week/i],
      'month': [/monthly/i, /month by month/i, /each month/i, /per month/i, /month/i],
      'quarter': [/quarterly/i, /quarter by quarter/i, /each quarter/i, /per quarter/i, /quarter/i, /q[1-4]/i],
      'year': [/yearly/i, /annually/i, /year by year/i, /each year/i, /per year/i, /annual/i, /year/i]
    };
    
    // Stage 3: Extract time period and range
    // Extract time period
    let timePeriod: string = undefined;
    const timePeriodMatches = query.match(/(last|next|this) (\d+ )?(year|month|quarter|week|day)s?/i);
    if (timePeriodMatches) {
      timePeriod = timePeriodMatches[0];
    }
    
    // Extract specific date ranges
    const dateRangePatterns = [
      // Specific date range
      { 
        pattern: /from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i,
        extract: (match: RegExpMatchArray) => ({ start: match[1], end: match[2] })
      },
      // Month range
      { 
        pattern: /from (January|February|March|April|May|June|July|August|September|October|November|December) to (January|February|March|April|May|June|July|August|September|October|November|December)( \d{4})?/i,
        extract: (match: RegExpMatchArray) => ({ start: match[1], end: match[2], year: match[3]?.trim() })
      },
      // Year range
      { 
        pattern: /from (\d{4}) to (\d{4})/i,
        extract: (match: RegExpMatchArray) => ({ start: match[1], end: match[2] })
      },
      // Last N periods
      { 
        pattern: /last (\d+) (days?|weeks?|months?|quarters?|years?)/i,
        extract: (match: RegExpMatchArray) => ({ 
          duration: parseInt(match[1]), 
          unit: match[2].replace(/s$/, '') as 'day' | 'week' | 'month' | 'quarter' | 'year'
        })
      },
      // Since a specific date
      { 
        pattern: /since (\d{4}-\d{2}-\d{2})/i,
        extract: (match: RegExpMatchArray) => ({ start: match[1] })
      },
      // Until a specific date
      { 
        pattern: /until (\d{4}-\d{2}-\d{2})/i,
        extract: (match: RegExpMatchArray) => ({ end: match[1] })
      }
    ];
    
    // Stage 4: Detect comparison types
    const comparisonPatterns = [
      { pattern: /year[ -]over[ -]year/i, type: 'year-over-year' },
      { pattern: /month[ -]over[ -]month/i, type: 'month-over-month' },
      { pattern: /quarter[ -]over[ -]quarter/i, type: 'quarter-over-quarter' },
      { pattern: /period[ -]over[ -]period/i, type: 'period-over-period' },
      { pattern: /compared to (last|previous)/i, type: 'period-over-period' },
      { pattern: /versus (last|previous)/i, type: 'period-over-period' },
      { pattern: /sequential/i, type: 'sequential' },
      { pattern: /consecutive/i, type: 'sequential' }
    ];
    
    // Stage 5: Calculate results
    // Determine time frame
    let timeFrame: 'past' | 'present' | 'future' = undefined;
    let pastScore = 0;
    let presentScore = 0;
    let futureScore = 0;
    
    for (const { pattern, weight } of pastPatterns) {
      if (pattern.test(query)) {
        pastScore += weight;
      }
    }
    
    for (const { pattern, weight } of presentPatterns) {
        if (pattern.test(query)) {
        presentScore += weight;
      }
    }
    
    for (const { pattern, weight } of futurePatterns) {
        if (pattern.test(query)) {
        futureScore += weight;
      }
    }
    
    if (pastScore > presentScore && pastScore > futureScore) {
      timeFrame = 'past';
    } else if (futureScore > pastScore && futureScore > presentScore) {
      timeFrame = 'future';
    } else if (presentScore > 0) {
      timeFrame = 'present';
    }
    
    // Check if it's a time series analysis
    let isTimeSeries = false;
    let timeSeriesScore = 0;
    
    for (const { pattern, weight } of timeSeriesPatterns) {
      if (pattern.test(query)) {
        timeSeriesScore += weight;
      }
    }
    
    isTimeSeries = timeSeriesScore >= 2;
    
    // Determine time granularity
    let timeGranularity: 'day' | 'week' | 'month' | 'quarter' | 'year' = undefined;
    let highestGranularityScore = 0;
    
    for (const [granularity, patterns] of Object.entries(granularityPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          score += 1;
        }
      }
      
      if (score > highestGranularityScore) {
        highestGranularityScore = score;
        timeGranularity = granularity as 'day' | 'week' | 'month' | 'quarter' | 'year';
      }
    }
    
    // Extract time range
    let timeRange: {
      start?: string;
      end?: string;
      duration?: number;
      unit?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    } = undefined;
    
    for (const { pattern, extract } of dateRangePatterns) {
      const match = query.match(pattern);
      if (match) {
        timeRange = extract(match);
        break;
      }
    }
    
    // Detect comparison type
    let isComparison = false;
    let comparisonType: 'year-over-year' | 'month-over-month' | 'quarter-over-quarter' | 'period-over-period' | 'sequential' = undefined;
    
    for (const { pattern, type } of comparisonPatterns) {
      if (pattern.test(query)) {
        isComparison = true;
        comparisonType = type as any;
        break;
      }
    }
    
    return {
      hasTemporalReference: timeFrame !== undefined || timePeriod !== undefined || timeRange !== undefined,
      timeFrame,
      timePeriod,
      isTimeSeries,
      timeGranularity,
      timeRange,
      isComparison,
      comparisonType
    };
  }

  /**
   * Identify data requirements for the query
   * @param query The normalized query
   * @param queryType The type of query
   * @param entities The entities in the query
   * @returns Data requirements
   */
  private identifyDataRequirements(
    query: string,
    queryType: QueryType,
    entities: string[]
  ): {
    requiredVariables: string[];
    optionalVariables: string[];
    aggregations: string[];
    filters: string[];
    groupBy?: string[];
    sortBy?: { field: string; direction: 'asc' | 'desc' }[];
    limit?: number;
    calculations?: string[];
  } {
    // Stage 1: Basic variable identification
    const requiredVariables: string[] = [];
    const optionalVariables: string[] = [];
    const aggregations: string[] = [];
    const filters: string[] = [];
    const groupBy: string[] = [];
    const sortBy: { field: string; direction: 'asc' | 'desc' }[] = [];
    let limit: number = undefined;
    const calculations: string[] = [];
    
    // Extract metrics and dimensions from entities
    const metrics = entities.filter(entity => 
      /sales|revenue|profit|cost|margin|rate|count|amount|value|price|quantity|roi|ctr|cpc|cpa|conversion|retention|churn|engagement|impression|click|visit|view|session|user|customer|lead|opportunity|deal|nps|csat|score|rating/.test(entity.toLowerCase())
    );
    
    const dimensions = entities.filter(entity => 
      /region|country|state|city|product|category|customer|segment|channel|department|industry|sector|market|demographic|age|gender|location|platform|device|browser|source|medium|campaign|date|month|quarter|year|day|week/.test(entity.toLowerCase())
    );
    
    // Stage 2: Determine required and optional variables based on query type
    // Add metrics to required variables
    requiredVariables.push(...metrics);
    
    // Add dimensions based on query type
    if ([
      QueryType.SEGMENTATION,
      QueryType.DISTRIBUTION,
      QueryType.COMPARATIVE
    ].includes(queryType)) {
      requiredVariables.push(...dimensions);
    } else {
      optionalVariables.push(...dimensions);
    }
    
    // Stage 3: Identify aggregations
    // Identify aggregations
    const aggregationPatterns = [
      { pattern: /\b(sum|total)\b/gi, aggregation: 'sum' },
      { pattern: /\b(average|avg|mean)\b/gi, aggregation: 'average' },
      { pattern: /\b(count|number of)\b/gi, aggregation: 'count' },
      { pattern: /\b(minimum|min|lowest)\b/gi, aggregation: 'min' },
      { pattern: /\b(maximum|max|highest)\b/gi, aggregation: 'max' },
      { pattern: /\b(median)\b/gi, aggregation: 'median' },
      { pattern: /\b(mode)\b/gi, aggregation: 'mode' },
      { pattern: /\b(standard deviation|std dev|variance)\b/gi, aggregation: 'stddev' },
      { pattern: /\b(distinct|unique)\b/gi, aggregation: 'distinct' },
      { pattern: /\b(cumulative|running)\b/gi, aggregation: 'cumulative' },
      { pattern: /\b(percentage|percent|ratio)\b/gi, aggregation: 'percentage' },
      { pattern: /\b(growth|increase|decrease)\b/gi, aggregation: 'growth' },
      { pattern: /\b(moving average|rolling average)\b/gi, aggregation: 'moving_average' },
      { pattern: /\b(year[ -]over[ -]year|yoy)\b/gi, aggregation: 'yoy' },
      { pattern: /\b(month[ -]over[ -]month|mom)\b/gi, aggregation: 'mom' },
      { pattern: /\b(quarter[ -]over[ -]quarter|qoq)\b/gi, aggregation: 'qoq' }
    ];
    
    for (const { pattern, aggregation } of aggregationPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        if (!aggregations.includes(aggregation)) {
        aggregations.push(aggregation);
        }
      }
    }
    
    // Add default aggregations based on query type
    if (aggregations.length === 0) {
      if (queryType === QueryType.RANKING) {
        aggregations.push('sum');
      } else if (queryType === QueryType.DISTRIBUTION) {
        aggregations.push('count');
      } else if (queryType === QueryType.ANOMALY) {
        aggregations.push('average', 'stddev');
      } else if (queryType === QueryType.TREND) {
        aggregations.push('sum');
      } else if (queryType === QueryType.COMPARATIVE) {
        aggregations.push('sum');
      } else if (queryType === QueryType.CORRELATION) {
        aggregations.push('sum');
      } else if (metrics.length > 0) {
        aggregations.push('sum');
      }
    }
    
    // Stage 4: Identify filters
    // Identify filters
    const filterPatterns = [
      /\b(where|for|in|with|only|excluding|including)\b/gi,
      /\b(greater than|less than|equal to|more than|less than|at least|at most|between|above|below|over|under)\b/gi,
      /\b(starts with|ends with|contains|matches|like)\b/gi,
      /\b(before|after|during|within|since|until)\b/gi
    ];
    
    for (const pattern of filterPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        // Extract filter expressions (enhanced)
        const words = query.split(' ');
        for (let i = 0; i < words.length; i++) {
          if (matches.some(match => match.toLowerCase() === words[i].toLowerCase())) {
            // Try to extract a filter expression (up to 6 words after the filter keyword)
            const filterExpression = words.slice(i, Math.min(i + 7, words.length)).join(' ');
            if (!filters.includes(filterExpression)) {
            filters.push(filterExpression);
            }
          }
        }
      }
    }
    
    // Add time-based filters
    const temporalAspects = this.analyzeTemporal(query);
    if (temporalAspects.hasTemporalReference) {
      if (temporalAspects.timePeriod) {
      filters.push(`time: ${temporalAspects.timePeriod}`);
      }
      if (temporalAspects.timeRange) {
        const { start, end, duration, unit } = temporalAspects.timeRange;
        if (start && end) {
          filters.push(`time: from ${start} to ${end}`);
        } else if (start) {
          filters.push(`time: since ${start}`);
        } else if (end) {
          filters.push(`time: until ${end}`);
        } else if (duration && unit) {
          filters.push(`time: last ${duration} ${unit}${duration > 1 ? 's' : ''}`);
        }
      }
    }
    
    // Stage 5: Identify group by clauses
    const groupByPatterns = [
      { pattern: /\bgroup by\b/gi, weight: 2 },
      { pattern: /\bgroup\b/gi, weight: 1 },
      { pattern: /\bby\b/gi, weight: 0.5 },
      { pattern: /\bsegment by\b/gi, weight: 2 },
      { pattern: /\bsegment\b/gi, weight: 1 },
      { pattern: /\bcategorize by\b/gi, weight: 2 },
      { pattern: /\bcategorize\b/gi, weight: 1 },
      { pattern: /\bbreak down by\b/gi, weight: 2 },
      { pattern: /\bbreak down\b/gi, weight: 1 },
      { pattern: /\bsplit by\b/gi, weight: 2 },
      { pattern: /\bsplit\b/gi, weight: 1 }
    ];
    
    for (const { pattern, weight } of groupByPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        // If we find a group by clause, add dimensions to the group by list
        for (const dimension of dimensions) {
          if (!groupBy.includes(dimension)) {
            groupBy.push(dimension);
          }
        }
        break;
      }
    }
    
    // If query type is segmentation or distribution, add dimensions to group by
    if ([QueryType.SEGMENTATION, QueryType.DISTRIBUTION].includes(queryType) && dimensions.length > 0) {
      for (const dimension of dimensions) {
        if (!groupBy.includes(dimension)) {
          groupBy.push(dimension);
        }
      }
    }
    
    // Stage 6: Identify sort by clauses
    const sortPatterns = [
      { pattern: /\border by\b/gi, weight: 2 },
      { pattern: /\bsort by\b/gi, weight: 2 },
      { pattern: /\branked by\b/gi, weight: 2 },
      { pattern: /\bin (ascending|descending) order\b/gi, weight: 1.5 },
      { pattern: /\b(highest|lowest) to (highest|lowest)\b/gi, weight: 1.5 },
      { pattern: /\b(ascending|descending)\b/gi, weight: 1 }
    ];
    
    const directionPatterns = [
      { pattern: /\b(ascending|asc|increasing|smallest to largest|lowest to highest)\b/gi, direction: 'asc' as const },
      { pattern: /\b(descending|desc|decreasing|largest to smallest|highest to lowest)\b/gi, direction: 'desc' as const }
    ];
    
    // Default direction based on query type
    let defaultDirection: 'asc' | 'desc' = 'desc';
    if (queryType === QueryType.RANKING) {
      defaultDirection = 'desc'; // Top items by default
    }
    
    // Check for sort patterns
    let hasSortClause = false;
    for (const { pattern, weight } of sortPatterns) {
      if (pattern.test(query)) {
        hasSortClause = true;
        break;
      }
    }
    
    // Determine sort direction
    let sortDirection: 'asc' | 'desc' = defaultDirection;
    for (const { pattern, direction } of directionPatterns) {
      if (pattern.test(query)) {
        sortDirection = direction;
        break;
      }
    }
    
    // If we have a sort clause, add metrics to sort by
    if (hasSortClause || queryType === QueryType.RANKING) {
      for (const metric of metrics) {
        sortBy.push({ field: metric, direction: sortDirection });
      }
    }
    
    // Stage 7: Identify limit clauses
    const limitPatterns = [
      { pattern: /\btop (\d+)\b/i, extract: (match: RegExpMatchArray) => parseInt(match[1]) },
      { pattern: /\bbottom (\d+)\b/i, extract: (match: RegExpMatchArray) => parseInt(match[1]) },
      { pattern: /\blimit (\d+)\b/i, extract: (match: RegExpMatchArray) => parseInt(match[1]) },
      { pattern: /\bfirst (\d+)\b/i, extract: (match: RegExpMatchArray) => parseInt(match[1]) },
      { pattern: /\blast (\d+)\b/i, extract: (match: RegExpMatchArray) => parseInt(match[1]) },
      { pattern: /\b(\d+) (highest|lowest|most|least)\b/i, extract: (match: RegExpMatchArray) => parseInt(match[1]) }
    ];
    
    for (const { pattern, extract } of limitPatterns) {
      const match = query.match(pattern);
      if (match) {
        limit = extract(match);
        break;
      }
    }
    
    // If query type is ranking but no limit specified, default to 10
    if (queryType === QueryType.RANKING && !limit) {
      limit = 10;
    }
    
    // Stage 8: Identify calculations
    const calculationPatterns = [
      { pattern: /\bgrowth rate\b/gi, calculation: 'growth_rate' },
      { pattern: /\bpercentage change\b/gi, calculation: 'percentage_change' },
      { pattern: /\byear[ -]over[ -]year\b/gi, calculation: 'yoy_change' },
      { pattern: /\bmonth[ -]over[ -]month\b/gi, calculation: 'mom_change' },
      { pattern: /\bquarter[ -]over[ -]quarter\b/gi, calculation: 'qoq_change' },
      { pattern: /\bcompound annual growth rate\b/gi, calculation: 'cagr' },
      { pattern: /\bcagr\b/gi, calculation: 'cagr' },
      { pattern: /\bmoving average\b/gi, calculation: 'moving_average' },
      { pattern: /\brolling average\b/gi, calculation: 'moving_average' },
      { pattern: /\bcumulative\b/gi, calculation: 'cumulative' },
      { pattern: /\bpercentage of total\b/gi, calculation: 'percentage_of_total' },
      { pattern: /\bcontribution\b/gi, calculation: 'contribution' },
      { pattern: /\bconversion rate\b/gi, calculation: 'conversion_rate' },
      { pattern: /\bretention rate\b/gi, calculation: 'retention_rate' },
      { pattern: /\bchurn rate\b/gi, calculation: 'churn_rate' },
      { pattern: /\blifetime value\b/gi, calculation: 'ltv' },
      { pattern: /\bltv\b/gi, calculation: 'ltv' },
      { pattern: /\bcustomer acquisition cost\b/gi, calculation: 'cac' },
      { pattern: /\bcac\b/gi, calculation: 'cac' },
      { pattern: /\broi\b/gi, calculation: 'roi' },
      { pattern: /\breturn on investment\b/gi, calculation: 'roi' },
      { pattern: /\bprofit margin\b/gi, calculation: 'profit_margin' },
      { pattern: /\bmargin\b/gi, calculation: 'margin' }
    ];
    
    for (const { pattern, calculation } of calculationPatterns) {
      if (pattern.test(query)) {
        if (!calculations.includes(calculation)) {
          calculations.push(calculation);
        }
      }
    }
    
    return {
      requiredVariables,
      optionalVariables,
      aggregations,
      filters,
      groupBy: groupBy.length > 0 ? groupBy : undefined,
      sortBy: sortBy.length > 0 ? sortBy : undefined,
      limit,
      calculations: calculations.length > 0 ? calculations : undefined
    };
  }

  /**
   * Suggest analyses based on query characteristics
   * @param queryType The type of query
   * @param domain The domain of the query
   * @param entities The entities in the query
   * @param temporalAspects Temporal aspects of the query
   * @returns Suggested analyses
   */
  private suggestAnalyses(
    queryType: QueryType,
    domain: AnalysisDomain,
    entities: string[],
    temporalAspects: {
      hasTemporalReference: boolean;
      timeFrame?: 'past' | 'present' | 'future';
      timePeriod?: string;
      isTimeSeries: boolean;
    }
  ): string[] {
    const suggestions: string[] = [];
    
    // Add suggestions based on query type
    switch (queryType) {
      case QueryType.DESCRIPTIVE:
        suggestions.push('Summary statistics');
        suggestions.push('Data aggregation');
        break;
        
      case QueryType.DIAGNOSTIC:
        suggestions.push('Root cause analysis');
        suggestions.push('Correlation analysis');
        suggestions.push('Factor analysis');
        break;
        
      case QueryType.PREDICTIVE:
        suggestions.push('Time series forecasting');
        suggestions.push('Regression analysis');
        suggestions.push('Predictive modeling');
        break;
        
      case QueryType.PRESCRIPTIVE:
        suggestions.push('Optimization analysis');
        suggestions.push('Scenario analysis');
        suggestions.push('Decision tree analysis');
        break;
        
      case QueryType.COMPARATIVE:
        suggestions.push('Comparative analysis');
        suggestions.push('Benchmarking');
        suggestions.push('Variance analysis');
        break;
        
      case QueryType.CORRELATION:
        suggestions.push('Correlation analysis');
        suggestions.push('Regression analysis');
        suggestions.push('Causality analysis');
        break;
        
      case QueryType.TREND:
        suggestions.push('Trend analysis');
        suggestions.push('Time series decomposition');
        suggestions.push('Growth rate analysis');
        break;
        
      case QueryType.ANOMALY:
        suggestions.push('Outlier detection');
        suggestions.push('Anomaly analysis');
        suggestions.push('Statistical process control');
        break;
        
      case QueryType.RANKING:
        suggestions.push('Ranking analysis');
        suggestions.push('Pareto analysis');
        suggestions.push('Top/Bottom N analysis');
        break;
        
      case QueryType.SEGMENTATION:
        suggestions.push('Segmentation analysis');
        suggestions.push('Cluster analysis');
        suggestions.push('Cohort analysis');
        break;
        
      case QueryType.DISTRIBUTION:
        suggestions.push('Distribution analysis');
        suggestions.push('Frequency analysis');
        suggestions.push('Density analysis');
        break;
        
      default:
        suggestions.push('Exploratory data analysis');
        break;
    }
    
    // Add suggestions based on domain
    if (domain === AnalysisDomain.SALES) {
      suggestions.push('Sales performance analysis');
      suggestions.push('Customer segmentation');
      suggestions.push('Product performance analysis');
    } else if (domain === AnalysisDomain.MARKETING) {
      suggestions.push('Campaign performance analysis');
      suggestions.push('Conversion funnel analysis');
      suggestions.push('Channel effectiveness analysis');
    } else if (domain === AnalysisDomain.FINANCE) {
      suggestions.push('Financial performance analysis');
      suggestions.push('Cost structure analysis');
      suggestions.push('Profitability analysis');
    }
    
    // Add suggestions based on temporal aspects
    if (temporalAspects.isTimeSeries) {
      suggestions.push('Time series analysis');
      
      if (temporalAspects.timeFrame === 'future') {
        suggestions.push('Forecasting analysis');
      } else if (temporalAspects.timeFrame === 'past') {
        suggestions.push('Historical trend analysis');
      }
    }
    
    // Limit to top 5 suggestions
    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * Suggest visualizations based on query type and data requirements
   * @param queryType The type of query
   * @param dataRequirements The data requirements
   * @returns Suggested visualizations
   */
  private suggestVisualizations(
    queryType: QueryType,
    dataRequirements: {
      requiredVariables: string[];
      optionalVariables: string[];
      aggregations: string[];
      filters: string[];
    }
  ): string[] {
    const suggestions: string[] = [];
    
    // Add suggestions based on query type
    switch (queryType) {
      case QueryType.DESCRIPTIVE:
        suggestions.push('Table');
        suggestions.push('Summary cards');
        suggestions.push('Bar chart');
        break;
        
      case QueryType.DIAGNOSTIC:
        suggestions.push('Scatter plot');
        suggestions.push('Correlation matrix');
        suggestions.push('Heat map');
        break;
        
      case QueryType.PREDICTIVE:
        suggestions.push('Line chart with forecast');
        suggestions.push('Prediction intervals');
        suggestions.push('Scenario comparison');
        break;
        
      case QueryType.PRESCRIPTIVE:
        suggestions.push('Decision tree');
        suggestions.push('Optimization chart');
        suggestions.push('Impact analysis');
        break;
        
      case QueryType.COMPARATIVE:
        suggestions.push('Bar chart');
        suggestions.push('Radar chart');
        suggestions.push('Parallel coordinates');
        break;
        
      case QueryType.CORRELATION:
        suggestions.push('Scatter plot');
        suggestions.push('Correlation matrix');
        suggestions.push('Bubble chart');
        break;
        
      case QueryType.TREND:
        suggestions.push('Line chart');
        suggestions.push('Area chart');
        suggestions.push('Sparklines');
        break;
        
      case QueryType.ANOMALY:
        suggestions.push('Box plot');
        suggestions.push('Control chart');
        suggestions.push('Scatter plot with outliers');
        break;
        
      case QueryType.RANKING:
        suggestions.push('Bar chart');
        suggestions.push('Pareto chart');
        suggestions.push('Treemap');
        break;
        
      case QueryType.SEGMENTATION:
        suggestions.push('Pie chart');
        suggestions.push('Stacked bar chart');
        suggestions.push('Treemap');
        break;
        
      case QueryType.DISTRIBUTION:
        suggestions.push('Histogram');
        suggestions.push('Box plot');
        suggestions.push('Density plot');
        break;
        
      default:
        suggestions.push('Table');
        suggestions.push('Bar chart');
        suggestions.push('Line chart');
        break;
    }
    
    // Add suggestions based on data requirements
    const variables = [...dataRequirements.requiredVariables, ...dataRequirements.optionalVariables];
    const metricCount = variables.filter(v => 
      /sales|revenue|profit|cost|margin|rate|count|amount|value|price|quantity/.test(v)
    ).length;
    
    const dimensionCount = variables.filter(v => 
      /region|country|state|city|product|category|customer|segment|channel|department/.test(v)
    ).length;
    
    if (metricCount >= 2 && dimensionCount >= 1) {
      suggestions.push('Multi-series chart');
      suggestions.push('Bubble chart');
    }
    
    if (dimensionCount >= 2) {
      suggestions.push('Heat map');
      suggestions.push('Treemap');
    }
    
    if (dataRequirements.aggregations.includes('sum') || dataRequirements.aggregations.includes('count')) {
      suggestions.push('Pie chart');
      suggestions.push('Treemap');
    }
    
    // Limit to top 5 suggestions
    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * Calculate confidence score for the analysis
   * @param queryType The type of query
   * @param entities The entities in the query
   * @param dataRequirements The data requirements
   * @returns Confidence score (0-1)
   */
  private calculateConfidenceScore(
    queryType: QueryType,
    entities: string[],
    dataRequirements: {
      requiredVariables: string[];
      optionalVariables: string[];
      aggregations: string[];
      filters: string[];
    }
  ): number {
    let score = 0.5; // Start with a neutral score
    
    // Adjust based on query type
    if (queryType !== QueryType.GENERAL) {
      score += 0.1; // More confident if we detected a specific query type
    }
    
    // Adjust based on entities
    if (entities.length > 0) {
      score += Math.min(0.2, entities.length * 0.05); // More confident with more entities
    }
    
    // Adjust based on data requirements
    if (dataRequirements.requiredVariables.length > 0) {
      score += 0.1; // More confident if we identified required variables
    }
    
    if (dataRequirements.aggregations.length > 0) {
      score += 0.05; // More confident if we identified aggregations
    }
    
    if (dataRequirements.filters.length > 0) {
      score += 0.05; // More confident if we identified filters
    }
    
    // Cap the score at 0.95 (never be 100% confident)
    return Math.min(0.95, score);
  }

  /**
   * Generate clarification questions for ambiguous queries
   * @param queryAnalysis The query analysis result
   * @returns Array of clarification questions
   */
  public generateClarificationQuestions(queryAnalysis: QueryAnalysisResult): ClarificationQuestion[] {
    // Stage 1: Initialize questions array and determine confidence level
    const questions: ClarificationQuestion[] = [];
    
    // If confidence is low, generate more questions
    const lowConfidence = queryAnalysis.confidenceScore < 0.6;
    const mediumConfidence = queryAnalysis.confidenceScore >= 0.6 && queryAnalysis.confidenceScore < 0.8;
    
    // Stage 2: Basic clarification questions for essential missing information
    // Check if query type is ambiguous
    if (queryAnalysis.queryType === QueryType.GENERAL) {
      questions.push({
        id: uuidv4(),
        question: 'What type of analysis are you looking for?',
        context: 'Clarifying the analysis type',
        possibleAnswers: [
          'Descriptive (what happened)',
          'Diagnostic (why it happened)',
          'Predictive (what will happen)',
          'Comparative (how things compare)',
          'Trend analysis (how things changed over time)',
          'Anomaly detection (find unusual patterns)',
          'Ranking (top/bottom items)'
        ],
        impact: 'high',
        answerField: 'queryType'
      });
    }
    
    // Check if entities are missing
    if (queryAnalysis.entities.length === 0) {
      questions.push({
        id: uuidv4(),
        question: 'What specific metrics or dimensions are you interested in analyzing?',
        context: 'Identifying key entities',
        impact: 'high',
        answerField: 'entities'
      });
    }
    
    // Check if domain is general and confidence is low
    if (queryAnalysis.domain === AnalysisDomain.GENERAL && lowConfidence) {
      questions.push({
        id: uuidv4(),
        question: 'Which business area does your question relate to?',
        context: 'Identifying business domain',
        possibleAnswers: [
          'Sales',
          'Marketing',
          'Finance',
          'Operations',
          'Human Resources',
          'Customer Service',
          'Product'
        ],
        impact: 'medium',
        answerField: 'domain'
      });
    }
    
    // Stage 3: Temporal clarification questions
    // Check if time period is ambiguous for time series
    if (queryAnalysis.temporalAspects.isTimeSeries && !queryAnalysis.temporalAspects.timePeriod) {
      questions.push({
        id: uuidv4(),
        question: 'What time period would you like to analyze?',
        context: 'Clarifying time period',
        possibleAnswers: [
          'Last 7 days',
          'Last 30 days',
          'Last quarter',
          'Last year',
          'Year-to-date',
          'Custom period'
        ],
        impact: 'medium',
        answerField: 'timePeriod'
      });
    }
    
    // Check if time granularity is missing for time series
    if (queryAnalysis.temporalAspects.isTimeSeries && !queryAnalysis.temporalAspects.timeGranularity) {
      questions.push({
        id: uuidv4(),
        question: 'How would you like the data to be grouped over time?',
        context: 'Clarifying time granularity',
        possibleAnswers: [
          'Daily',
          'Weekly',
          'Monthly',
          'Quarterly',
          'Yearly'
        ],
        impact: 'medium',
        answerField: 'timeGranularity'
      });
    }
    
    // Check if comparison type is needed for time series
    if (queryAnalysis.temporalAspects.isTimeSeries && 
        queryAnalysis.temporalAspects.isComparison === undefined && 
        (lowConfidence || mediumConfidence)) {
      questions.push({
        id: uuidv4(),
        question: 'Would you like to compare this period with a previous period?',
        context: 'Clarifying time comparison',
        possibleAnswers: [
          'Yes, year-over-year',
          'Yes, month-over-month',
          'Yes, quarter-over-quarter',
          'Yes, with previous period',
          'No, just show the trend'
        ],
        impact: 'medium',
        answerField: 'timeComparison'
      });
    }
    
    // Stage 4: Data requirement clarification questions
    // Check if required variables are missing
    if (queryAnalysis.dataRequirements.requiredVariables.length === 0 && lowConfidence) {
      questions.push({
        id: uuidv4(),
        question: 'What specific metrics would you like to measure?',
        context: 'Identifying metrics',
        possibleAnswers: [
          'Sales',
          'Revenue',
          'Profit',
          'Conversion rate',
          'Customer count',
          'Growth rate',
          'Market share',
          'Other (please specify)'
        ],
        impact: 'high',
        answerField: 'requiredVariables'
      });
    }
    
    // Check if comparison basis is missing for comparative queries
    if (queryAnalysis.queryType === QueryType.COMPARATIVE && queryAnalysis.entities.length < 2) {
      questions.push({
        id: uuidv4(),
        question: 'What would you like to compare against?',
        context: 'Clarifying comparison basis',
        impact: 'high',
        answerField: 'comparisonBasis'
      });
    }
    
    // Check if aggregation level is missing
    if (queryAnalysis.dataRequirements.aggregations.length === 0 && (lowConfidence || mediumConfidence)) {
      questions.push({
        id: uuidv4(),
        question: 'How would you like the data to be aggregated?',
        context: 'Clarifying aggregation',
        possibleAnswers: [
          'Total sum',
          'Average',
          'Count',
          'Minimum',
          'Maximum',
          'Median',
          'Percentage'
        ],
        impact: 'medium',
        answerField: 'aggregation'
      });
    }
    
    // Check if grouping is needed
    if (queryAnalysis.dataRequirements.groupBy === undefined && 
        queryAnalysis.entities.length > 1 && 
        (lowConfidence || mediumConfidence)) {
      // Extract potential dimensions for grouping
      const dimensions = queryAnalysis.entities.filter(entity => 
        /region|country|state|city|product|category|customer|segment|channel|department|industry|sector|market|demographic|age|gender|location|platform|device|browser|source|medium|campaign|date|month|quarter|year|day|week/.test(entity.toLowerCase())
      );
      
      if (dimensions.length > 0) {
        questions.push({
          id: uuidv4(),
          question: 'Would you like to group the data by any dimension?',
          context: 'Clarifying grouping',
          possibleAnswers: [...dimensions, 'No grouping needed'],
          impact: 'medium',
          answerField: 'groupBy'
        });
      }
    }
    
    // Check if sorting is needed
    if (queryAnalysis.dataRequirements.sortBy === undefined && 
        [QueryType.RANKING, QueryType.DESCRIPTIVE].includes(queryAnalysis.queryType) && 
        lowConfidence) {
      questions.push({
        id: uuidv4(),
        question: 'How would you like the results to be sorted?',
        context: 'Clarifying sorting',
        possibleAnswers: [
          'Highest to lowest',
          'Lowest to highest',
          'Alphabetically',
          'Chronologically',
          'No specific order'
        ],
        impact: 'low',
        answerField: 'sortBy'
      });
    }
    
    // Stage 5: Visualization and output format questions
    // Check if visualization preference is needed
    if (lowConfidence || mediumConfidence) {
      // Suggest appropriate visualizations based on query type
      let visualizationOptions: string[] = ['No preference'];
      
      switch (queryAnalysis.queryType) {
        case QueryType.TREND:
          visualizationOptions = ['Line chart', 'Area chart', 'Column chart', 'Table', ...visualizationOptions];
          break;
        case QueryType.COMPARATIVE:
          visualizationOptions = ['Bar chart', 'Column chart', 'Radar chart', 'Table', ...visualizationOptions];
          break;
        case QueryType.DISTRIBUTION:
          visualizationOptions = ['Histogram', 'Pie chart', 'Donut chart', 'Table', ...visualizationOptions];
          break;
        case QueryType.RANKING:
          visualizationOptions = ['Bar chart', 'Column chart', 'Table', ...visualizationOptions];
          break;
        case QueryType.CORRELATION:
          visualizationOptions = ['Scatter plot', 'Heatmap', 'Bubble chart', 'Table', ...visualizationOptions];
          break;
        default:
          visualizationOptions = ['Bar chart', 'Line chart', 'Pie chart', 'Table', 'Scatter plot', ...visualizationOptions];
      }
      
      questions.push({
        id: uuidv4(),
        question: 'What type of visualization would you prefer?',
        context: 'Visualization preference',
        possibleAnswers: visualizationOptions,
        impact: 'low',
        answerField: 'visualizationPreference'
      });
    }
    
    // Check if additional context is needed for complex queries
    if (queryAnalysis.complexity === QueryComplexity.HIGH && lowConfidence) {
      questions.push({
        id: uuidv4(),
        question: 'Is there any additional context or specific requirements for this analysis?',
        context: 'Additional context',
        impact: 'medium',
        answerField: 'additionalContext'
      });
    }
    
    // Stage 6: Sort and limit questions
    // Sort questions by impact
    return questions.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    }).slice(0, 5); // Limit to 5 questions to avoid overwhelming the user
  }

  /**
   * Format currency value for display
   */
  public formatCurrency(value: number): string {
    // Remove any spaces in number formatting to prevent "$ 2, 0 0 0 0" errors
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(value).replace(/\s+/g, '');
  }

  /**
   * Format number for display (without currency symbol)
   */
  public formatNumber(value: number): string {
    // Remove any spaces in number formatting
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(value).replace(/\s+/g, '');
  }
} 