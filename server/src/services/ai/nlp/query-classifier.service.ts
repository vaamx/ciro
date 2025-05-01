import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../../common/utils/logger-factory';

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
 * Service responsible for classifying queries by type, domain, and complexity
 */
@Injectable()
export class QueryClassifierService {
  
  private readonly logger = createServiceLogger('QueryClassifierService');

  private constructor() {}

  /**
   * Get singleton instance
   */
  

  /**
   * Detect the type of query
   * @param query The normalized query
   * @returns Query type
   */
  public detectQueryType(query: string): QueryType {
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
  public identifyDomain(query: string): AnalysisDomain {
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
   * Determine the complexity of a query
   * @param query The normalized query
   * @param queryType The type of query
   * @param entities The entities in the query
   * @returns Query complexity
   */
  public determineQueryComplexity(
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
} 