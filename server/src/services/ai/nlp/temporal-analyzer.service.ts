import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../../common/utils/logger-factory';

/**
 * Interface for temporal analysis results
 */
export interface TemporalAnalysisResult {
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
}

/**
 * Service responsible for analyzing temporal aspects of queries
 */
@Injectable()
export class TemporalAnalyzerService {
  
  private readonly logger = createServiceLogger('TemporalAnalyzerService');

  private constructor() {}

  /**
   * Get singleton instance
   */
  

  /**
   * Analyze temporal aspects of the query
   * @param query The normalized query
   * @returns Temporal aspects
   */
  public analyzeTemporal(query: string): TemporalAnalysisResult {
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
    let timePeriod: string = ''; // Changed from undefined to empty string
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
    let timeFrame: 'past' | 'present' | 'future' = 'present'; // Default to present instead of undefined
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
    let timeGranularity: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day'; // Default to day instead of undefined
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
    } = {}; // Initialize as empty object instead of undefined
    
    for (const { pattern, extract } of dateRangePatterns) {
      const match = query.match(pattern);
      if (match) {
        timeRange = extract(match);
        break;
      }
    }
    
    // Detect comparison type
    let isComparison = false;
    let comparisonType: 'year-over-year' | 'month-over-month' | 'quarter-over-quarter' | 'period-over-period' | 'sequential' = 'period-over-period'; // Default value instead of undefined
    
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
} 