import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../../common/utils/logger-factory';
import { QueryType } from './query-classifier.service';

/**
 * Interface for data requirements analysis results
 */
export interface DataRequirements {
  requiredVariables: string[];
  optionalVariables: string[];
  aggregations: string[];
  filters: string[];
  groupBy?: string[];
  sortBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  calculations?: string[];
}

/**
 * Service responsible for analyzing data requirements of queries
 */
@Injectable()
export class RequirementAnalyzerService {
  
  private readonly logger = createServiceLogger('RequirementAnalyzerService');

  private constructor() {}

  /**
   * Get singleton instance
   */
  

  /**
   * Identify data requirements for the query
   * @param query The normalized query
   * @param queryType The type of query
   * @param entities The entities in the query
   * @returns Data requirements
   */
  public identifyDataRequirements(
    query: string,
    queryType: QueryType,
    entities: string[]
  ): DataRequirements {
    // Stage 1: Basic variable identification
    const requiredVariables: string[] = [];
    const optionalVariables: string[] = [];
    const aggregations: string[] = [];
    const filters: string[] = [];
    const groupBy: string[] = [];
    const sortBy: { field: string; direction: 'asc' | 'desc' }[] = [];
    let limit: number = 0; // Default to 0 instead of undefined
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
  public suggestAnalyses(
    queryType: QueryType,
    domain: string,
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
    if (domain === 'sales') {
      suggestions.push('Sales performance analysis');
      suggestions.push('Customer segmentation');
      suggestions.push('Product performance analysis');
    } else if (domain === 'marketing') {
      suggestions.push('Campaign performance analysis');
      suggestions.push('Conversion funnel analysis');
      suggestions.push('Channel effectiveness analysis');
    } else if (domain === 'finance') {
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
  public suggestVisualizations(
    queryType: QueryType,
    dataRequirements: DataRequirements
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
} 