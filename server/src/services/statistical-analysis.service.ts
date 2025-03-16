import { v4 as uuidv4 } from 'uuid';
import { createServiceLogger } from '../utils/logger-factory';

/**
 * Statistical significance levels
 */
export enum SignificanceLevel {
  VERY_HIGH = 0.001,  // 99.9% confidence
  HIGH = 0.01,        // 99% confidence
  MEDIUM = 0.05,      // 95% confidence
  LOW = 0.1           // 90% confidence
}

/**
 * Types of trends that can be detected
 */
export enum TrendType {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
  VOLATILE = 'volatile',
  SEASONAL = 'seasonal',
  CYCLICAL = 'cyclical'
}

/**
 * Types of anomalies that can be detected
 */
export enum AnomalyType {
  OUTLIER = 'outlier',
  SPIKE = 'spike',
  DIP = 'dip',
  LEVEL_SHIFT = 'level_shift',
  TREND_CHANGE = 'trend_change',
  MISSING_VALUE = 'missing_value'
}

/**
 * Types of forecasting methods
 */
export enum ForecastMethod {
  MOVING_AVERAGE = 'moving_average',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  LINEAR_REGRESSION = 'linear_regression',
  ARIMA = 'arima',
  PROPHET = 'prophet' // Facebook's Prophet
}

/**
 * Correlation result
 */
export interface CorrelationResult {
  variable1: string;
  variable2: string;
  coefficient: number;
  pValue: number;
  significanceLevel: SignificanceLevel | null;
  isSignificant: boolean;
}

/**
 * Anomaly result
 */
export interface AnomalyResult {
  index: number;
  value: number;
  expectedValue: number;
  deviation: number;
  type: AnomalyType;
  confidence: number;
}

/**
 * Trend analysis result
 */
export interface TrendResult {
  type: TrendType;
  strength: number;
  startIndex: number;
  endIndex: number;
  slope?: number;
  pValue: number;
  isSignificant: boolean;
}

/**
 * Forecast result
 */
export interface ForecastResult {
  originalData: number[];
  forecastData: number[];
  lowerBound: number[];
  upperBound: number[];
  confidence: number;
  method: ForecastMethod;
  mape?: number; // Mean Absolute Percentage Error
  rmse?: number; // Root Mean Square Error
}

/**
 * Statistical insights
 */
export interface StatisticalInsight {
  id: string;
  type: 'correlation' | 'anomaly' | 'trend' | 'forecast' | 'general';
  description: string;
  confidence: number;
  importance: number;
  relatedVariables: string[];
  visualizationRecommendation?: {
    type: string;
    config: any;
  };
}

/**
 * Service for performing statistical analysis on data
 */
export class StatisticalAnalysisService {
  private static instance: StatisticalAnalysisService;
  private readonly logger = createServiceLogger('StatisticalAnalysisService');

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): StatisticalAnalysisService {
    if (!StatisticalAnalysisService.instance) {
      StatisticalAnalysisService.instance = new StatisticalAnalysisService();
    }
    return StatisticalAnalysisService.instance;
  }

  /**
   * Calculate basic statistics for an array of numbers
   */
  public calculateBasicStats(data: number[]): { 
    mean: number;
    median: number;
    min: number;
    max: number;
    range: number;
    variance: number;
    stdDev: number;
    quartiles: [number, number, number];
    skewness?: number;
    kurtosis?: number;
  } {
    if (!data.length) return null;
    
    // Sort the data for easier calculations
    const sortedData = [...data].sort((a, b) => a - b);
    
    // Basic statistics
    const min = sortedData[0];
    const max = sortedData[sortedData.length - 1];
    const range = max - min;
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    
    // Median
    const mid = Math.floor(sortedData.length / 2);
    const median = sortedData.length % 2 === 0
      ? (sortedData[mid - 1] + sortedData[mid]) / 2
      : sortedData[mid];
    
    // Variance and Standard Deviation
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    // Quartiles
    const q1Index = Math.floor(sortedData.length * 0.25);
    const q3Index = Math.floor(sortedData.length * 0.75);
    const quartiles: [number, number, number] = [
      sortedData[q1Index],
      median,
      sortedData[q3Index]
    ];
    
    // Skewness (measure of asymmetry)
    let skewness: number = undefined;
    if (data.length > 2) {
      const numerator = data.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / data.length;
      const denominator = Math.pow(stdDev, 3);
      if (denominator !== 0) {
        skewness = numerator / denominator;
      }
    }
    
    // Kurtosis (measure of "tailedness")
    let kurtosis: number = undefined;
    if (data.length > 3) {
      const numerator = data.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / data.length;
      const denominator = Math.pow(variance, 2);
      if (denominator !== 0) {
        kurtosis = numerator / denominator - 3; // Excess kurtosis (normal = 0)
      }
    }
    
    return {
      mean,
      median,
      min,
      max,
      range,
      variance,
      stdDev,
      quartiles,
      skewness,
      kurtosis
    };
  }

  /**
   * Detect and remove outliers from the data
   * @param data The data array
   * @param method The method to use for outlier detection (IQR, z-score, etc.)
   * @param threshold The threshold for outlier detection
   * @returns Object containing the cleaned data and the detected outliers
   */
  public detectAndRemoveOutliers(
    data: number[],
    method: 'iqr' | 'zscore' | 'modified_zscore' = 'iqr',
    threshold: number = 1.5
  ): { cleanedData: number[]; outliers: AnomalyResult[] } {
    if (!data.length) return { cleanedData: [], outliers: [] };

    const outliers: AnomalyResult[] = [];
    let cleanedData: number[] = [...data];
    
    if (method === 'iqr') {
      // IQR method (Interquartile Range)
      const sortedData = [...data].sort((a, b) => a - b);
      const q1Index = Math.floor(sortedData.length * 0.25);
      const q3Index = Math.floor(sortedData.length * 0.75);
      const q1 = sortedData[q1Index];
      const q3 = sortedData[q3Index];
      const iqr = q3 - q1;
      const lowerBound = q1 - threshold * iqr;
      const upperBound = q3 + threshold * iqr;
      
      // Detect outliers
      data.forEach((value, index) => {
        if (value < lowerBound || value > upperBound) {
          outliers.push({
            index,
            value,
            expectedValue: (value < lowerBound) ? lowerBound : upperBound,
            deviation: (value < lowerBound) ? (lowerBound - value) : (value - upperBound),
            type: (value < lowerBound) ? AnomalyType.DIP : AnomalyType.SPIKE,
            confidence: 0.9
          });
        }
      });
      
      // Clean data
      cleanedData = data.filter(value => value >= lowerBound && value <= upperBound);
    } else if (method === 'zscore' || method === 'modified_zscore') {
      // Calculate mean and standard deviation
      const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
      const stdDev = Math.sqrt(
        data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
      );
      
      if (method === 'zscore') {
        // Z-score method
        data.forEach((value, index) => {
          const zScore = (value - mean) / stdDev;
          if (Math.abs(zScore) > threshold) {
            outliers.push({
              index,
              value,
              expectedValue: mean,
              deviation: Math.abs(value - mean),
              type: (value < mean) ? AnomalyType.DIP : AnomalyType.SPIKE,
              confidence: 1 - (1 / Math.abs(zScore))
            });
          }
        });
        
        // Clean data
        cleanedData = data.filter((value) => {
          const zScore = (value - mean) / stdDev;
          return Math.abs(zScore) <= threshold;
        });
      } else {
        // Modified Z-score method (more robust to outliers)
        const median = [...data].sort((a, b) => a - b)[Math.floor(data.length / 2)];
        const mad = data.reduce((sum, val) => sum + Math.abs(val - median), 0) / data.length;
        
        data.forEach((value, index) => {
          const modifiedZScore = (0.6745 * Math.abs(value - median)) / mad;
          if (modifiedZScore > threshold) {
            outliers.push({
              index,
              value,
              expectedValue: median,
              deviation: Math.abs(value - median),
              type: (value < median) ? AnomalyType.DIP : AnomalyType.SPIKE,
              confidence: 1 - (1 / modifiedZScore)
            });
          }
        });
        
        // Clean data
        cleanedData = data.filter((value) => {
          const modifiedZScore = (0.6745 * Math.abs(value - median)) / mad;
          return modifiedZScore <= threshold;
        });
      }
    }
    
    return { cleanedData, outliers };
  }

  /**
   * Calculate correlation between two variables
   * @param data1 First variable's data
   * @param data2 Second variable's data
   * @returns Correlation coefficient, p-value, and significance
   */
  public calculateCorrelation(
    data1: number[],
    data2: number[],
    variable1Name: string = 'Variable 1',
    variable2Name: string = 'Variable 2'
  ): CorrelationResult {
    if (data1.length !== data2.length || data1.length < 3) {
      this.logger.warn('Cannot calculate correlation: data arrays must have the same length and at least 3 elements');
      return null;
    }

    // Calculate means
    const mean1 = data1.reduce((sum, val) => sum + val, 0) / data1.length;
    const mean2 = data2.reduce((sum, val) => sum + val, 0) / data2.length;
    
    // Calculate covariance and standard deviations
    let covariance = 0;
    let sumSquaredDiff1 = 0;
    let sumSquaredDiff2 = 0;
    
    for (let i = 0; i < data1.length; i++) {
      const diff1 = data1[i] - mean1;
      const diff2 = data2[i] - mean2;
      covariance += diff1 * diff2;
      sumSquaredDiff1 += diff1 * diff1;
      sumSquaredDiff2 += diff2 * diff2;
    }
    
    covariance /= data1.length;
    const stdDev1 = Math.sqrt(sumSquaredDiff1 / data1.length);
    const stdDev2 = Math.sqrt(sumSquaredDiff2 / data2.length);
    
    // Calculate Pearson correlation coefficient
    const r = covariance / (stdDev1 * stdDev2);
    
    // Calculate t-statistic for p-value
    const n = data1.length;
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    
    // Calculate p-value (two-tailed)
    // This is an approximation for the p-value based on the t-distribution
    const df = n - 2;
    const pValue = this.calculatePValueFromT(t, df);
    
    // Determine significance level
    let significanceLevel = null;
    if (pValue <= SignificanceLevel.VERY_HIGH) {
      significanceLevel = SignificanceLevel.VERY_HIGH;
    } else if (pValue <= SignificanceLevel.HIGH) {
      significanceLevel = SignificanceLevel.HIGH;
    } else if (pValue <= SignificanceLevel.MEDIUM) {
      significanceLevel = SignificanceLevel.MEDIUM;
    } else if (pValue <= SignificanceLevel.LOW) {
      significanceLevel = SignificanceLevel.LOW;
    }
    
    return {
      variable1: variable1Name,
      variable2: variable2Name,
      coefficient: r,
      pValue,
      significanceLevel,
      isSignificant: pValue <= SignificanceLevel.MEDIUM
    };
  }

  /**
   * Detect trends in time series data
   * @param data The time series data
   * @returns Trend analysis result
   */
  public detectTrend(data: number[]): TrendResult {
    if (data.length < 5) {
      this.logger.warn('Cannot detect trend: data array must have at least 5 elements');
      return null;
    }

    // Perform linear regression to detect trend
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i); // Time indices
    
    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = data.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate linear regression parameters
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumXY += (x[i] - meanX) * (data[i] - meanY);
      sumXX += (x[i] - meanX) * (x[i] - meanX);
    }
    
    const slope = sumXY / sumXX;
    const intercept = meanY - slope * meanX;
    
    // Calculate predicted values and residuals
    const predicted = x.map(xi => intercept + slope * xi);
    const residuals = data.map((yi, i) => yi - predicted[i]);
    
    // Calculate residual standard error
    const rss = residuals.reduce((sum, res) => sum + res * res, 0);
    const rse = Math.sqrt(rss / (n - 2));
    
    // Calculate standard error of the slope
    const slopeStdError = rse / Math.sqrt(sumXX);
    
    // Calculate t-statistic for the slope
    const tStatistic = slope / slopeStdError;
    
    // Calculate p-value for the slope
    const df = n - 2;
    const pValue = this.calculatePValueFromT(tStatistic, df);
    
    // Determine trend type
    let trendType: TrendType;
    if (Math.abs(slope) < 0.001) {
      trendType = TrendType.STABLE;
    } else if (slope > 0) {
      trendType = TrendType.INCREASING;
    } else {
      trendType = TrendType.DECREASING;
    }
    
    // Check for volatility
    const volatility = Math.sqrt(residuals.reduce((sum, res) => sum + res * res, 0) / n) / meanY;
    if (volatility > 0.2) { // Arbitrary threshold for volatility
      trendType = TrendType.VOLATILE;
    }
    
    // Check for seasonality (simplified)
    // This is a very simplified check, real seasonality detection would be more complex
    const autocorrelation = this.calculateAutocorrelation(data, Math.floor(n / 4));
    const maxAutocorr = Math.max(...autocorrelation.slice(1));
    if (maxAutocorr > 0.5) { // Arbitrary threshold
      trendType = TrendType.SEASONAL;
    }
    
    // Calculate trend strength (R-squared)
    const tss = data.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const strength = 1 - (rss / tss);
    
    return {
      type: trendType,
      strength,
      startIndex: 0,
      endIndex: n - 1,
      slope,
      pValue,
      isSignificant: pValue <= SignificanceLevel.MEDIUM
    };
  }

  /**
   * Generate forecast for time series data
   * @param data The historical time series data
   * @param periods Number of periods to forecast
   * @param method The forecasting method to use
   * @returns Forecast results
   */
  public generateForecast(
    data: number[],
    periods: number = 5,
    method: ForecastMethod = ForecastMethod.EXPONENTIAL_SMOOTHING
  ): ForecastResult {
    if (data.length < 5) {
      this.logger.warn('Cannot generate forecast: data array must have at least 5 elements');
      return null;
    }

    let forecastData: number[] = [];
    let lowerBound: number[] = [];
    let upperBound: number[] = [];
    let confidence = 0.95;
    let mape: number = undefined;
    let rmse: number = undefined;
    
    // Implement forecasting based on method
    if (method === ForecastMethod.MOVING_AVERAGE) {
      // Simple Moving Average
      const windowSize = Math.min(12, Math.floor(data.length / 3));
      const lastValues = data.slice(-windowSize);
      const ma = lastValues.reduce((sum, val) => sum + val, 0) / windowSize;
      
      // Generate forecast (constant for moving average)
      forecastData = Array(periods).fill(ma);
      
      // Calculate error based on historical performance
      const maErrors = [];
      for (let i = windowSize; i < data.length; i++) {
        const historicalMA = data.slice(i - windowSize, i).reduce((sum, val) => sum + val, 0) / windowSize;
        maErrors.push(Math.abs(data[i] - historicalMA));
      }
      
      const avgError = maErrors.reduce((sum, val) => sum + val, 0) / maErrors.length;
      const stdError = Math.sqrt(
        maErrors.reduce((sum, val) => sum + Math.pow(val - avgError, 2), 0) / maErrors.length
      );
      
      const zScore = 1.96; // for 95% confidence
      lowerBound = forecastData.map(f => f - zScore * stdError);
      upperBound = forecastData.map(f => f + zScore * stdError);
      
      // Calculate performance metrics
      mape = this.calculateMAPE(data.slice(-windowSize), Array(windowSize).fill(ma));
      rmse = this.calculateRMSE(data.slice(-windowSize), Array(windowSize).fill(ma));
      
    } else if (method === ForecastMethod.EXPONENTIAL_SMOOTHING) {
      // Simple Exponential Smoothing
      const alpha = 0.3; // Smoothing factor
      
      let lastSmoothed = data[0];
      const smoothed = [lastSmoothed];
      
      // Calculate smoothed values
      for (let i = 1; i < data.length; i++) {
        lastSmoothed = alpha * data[i] + (1 - alpha) * lastSmoothed;
        smoothed.push(lastSmoothed);
      }
      
      // Generate forecast
      forecastData = Array(periods).fill(lastSmoothed);
      
      // Calculate error terms
      const errors = data.map((actual, i) => {
        if (i === 0) return 0;
        return actual - smoothed[i - 1];
      }).slice(1);
      
      const stdError = Math.sqrt(
        errors.reduce((sum, err) => sum + err * err, 0) / errors.length
      );
      
      // Calculate confidence intervals
      const zScore = 1.96; // for 95% confidence
      const margin = zScore * stdError;
      
      lowerBound = forecastData.map((val, i) => {
        return val - margin * Math.sqrt(i + 1);
      });
      
      upperBound = forecastData.map((val, i) => {
        return val + margin * Math.sqrt(i + 1);
      });
      
      // Calculate performance metrics
      const oneStepAheadForecasts = [data[0]].concat(smoothed.slice(0, -1));
      mape = this.calculateMAPE(data, oneStepAheadForecasts);
      rmse = this.calculateRMSE(data, oneStepAheadForecasts);
      
    } else if (method === ForecastMethod.LINEAR_REGRESSION) {
      // Linear Regression
      const n = data.length;
      const x = Array.from({ length: n }, (_, i) => i); // Time indices
      
      // Calculate means
      const meanX = x.reduce((sum, val) => sum + val, 0) / n;
      const meanY = data.reduce((sum, val) => sum + val, 0) / n;
      
      // Calculate linear regression parameters
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumXY += (x[i] - meanX) * (data[i] - meanY);
        sumXX += (x[i] - meanX) * (x[i] - meanX);
      }
      
      const slope = sumXY / sumXX;
      const intercept = meanY - slope * meanX;
      
      // Calculate predicted values and residuals
      const predicted = x.map(xi => intercept + slope * xi);
      const residuals = data.map((yi, i) => yi - predicted[i]);
      
      // Calculate standard error
      const rss = residuals.reduce((sum, res) => sum + res * res, 0);
      const rse = Math.sqrt(rss / (n - 2));
      
      // Generate forecast
      forecastData = Array.from({ length: periods }, (_, i) => {
        const xi = n + i;
        return intercept + slope * xi;
      });
      
      // Calculate prediction intervals
      const zScore = 1.96; // for 95% confidence
      
      lowerBound = forecastData.map((forecast, i) => {
        const xi = n + i;
        const sePredictor = rse * Math.sqrt(1 + 1/n + Math.pow(xi - meanX, 2) / sumXX);
        return forecast - zScore * sePredictor;
      });
      
      upperBound = forecastData.map((forecast, i) => {
        const xi = n + i;
        const sePredictor = rse * Math.sqrt(1 + 1/n + Math.pow(xi - meanX, 2) / sumXX);
        return forecast + zScore * sePredictor;
      });
      
      // Calculate performance metrics
      mape = this.calculateMAPE(data, predicted);
      rmse = this.calculateRMSE(data, predicted);
    }
    
    return {
      originalData: data,
      forecastData,
      lowerBound,
      upperBound,
      confidence,
      method,
      mape,
      rmse
    };
  }

  /**
   * Generate statistical insights from data
   * @param data The data object, typically containing multiple variables
   * @returns Array of insights
   */
  public generateInsights(data: Record<string, number[]>): StatisticalInsight[] {
    if (!data || Object.keys(data).length === 0) {
      this.logger.warn('Cannot generate insights: empty data object');
      return [];
    }

    const insights: StatisticalInsight[] = [];
    const variables = Object.keys(data);
    
    // Check each variable for basic insights
    variables.forEach(variable => {
      const values = data[variable];
      if (!values || values.length < 3) return;
      
      // Get basic stats
      const stats = this.calculateBasicStats(values);
      
      // Check for extreme skewness
      if (stats.skewness !== undefined && Math.abs(stats.skewness) > 1) {
        insights.push({
          id: uuidv4(),
          type: 'general',
          description: `${variable} has a ${stats.skewness > 0 ? 'positive' : 'negative'} skew (${stats.skewness.toFixed(2)}), indicating the distribution is not symmetric.`,
          confidence: 0.9,
          importance: 0.7,
          relatedVariables: [variable],
          visualizationRecommendation: {
            type: 'histogram',
            config: {
              data: values,
              bins: Math.min(20, Math.ceil(Math.sqrt(values.length))),
              xLabel: variable,
              yLabel: 'Frequency'
            }
          }
        });
      }
      
      // Check for outliers
      const outlierResult = this.detectAndRemoveOutliers(values);
      if (outlierResult.outliers.length > 0) {
        const outlierPct = (outlierResult.outliers.length / values.length) * 100;
        insights.push({
          id: uuidv4(),
          type: 'anomaly',
          description: `${variable} contains ${outlierResult.outliers.length} outliers (${outlierPct.toFixed(1)}% of data) that may skew analysis.`,
          confidence: 0.85,
          importance: outlierPct > 10 ? 0.9 : 0.7,
          relatedVariables: [variable],
          visualizationRecommendation: {
            type: 'boxplot',
            config: {
              data: values,
              xLabel: variable,
              outliers: outlierResult.outliers.map(o => o.value)
            }
          }
        });
      }
      
      // Check for trends in time series
      if (values.length >= 10) {
        const trendResult = this.detectTrend(values);
        if (trendResult && trendResult.isSignificant) {
          insights.push({
            id: uuidv4(),
            type: 'trend',
            description: `${variable} shows a significant ${trendResult.type} trend (p-value: ${trendResult.pValue.toFixed(4)}).`,
            confidence: 1 - trendResult.pValue,
            importance: 0.8,
            relatedVariables: [variable],
            visualizationRecommendation: {
              type: 'line',
              config: {
                data: values.map((v, i) => ({ x: i, y: v })),
                xLabel: 'Time',
                yLabel: variable,
                showTrendLine: true
              }
            }
          });
        }
      }
    });
    
    // Check correlations between variables
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const var1 = variables[i];
        const var2 = variables[j];
        
        const values1 = data[var1];
        const values2 = data[var2];
        
        // Ensure both variables have the same length and enough data
        if (values1.length !== values2.length || values1.length < 5) continue;
        
        const correlation = this.calculateCorrelation(values1, values2, var1, var2);
        if (correlation && correlation.isSignificant) {
          const strength = Math.abs(correlation.coefficient);
          const directionDesc = correlation.coefficient > 0 ? 'positive' : 'negative';
          let strengthDesc = 'moderate';
          
          if (strength > 0.9) strengthDesc = 'very strong';
          else if (strength > 0.7) strengthDesc = 'strong';
          else if (strength > 0.5) strengthDesc = 'moderate';
          else if (strength > 0.3) strengthDesc = 'weak';
          else strengthDesc = 'very weak';
          
          insights.push({
            id: uuidv4(),
            type: 'correlation',
            description: `There is a ${strengthDesc} ${directionDesc} correlation (r=${correlation.coefficient.toFixed(2)}) between ${var1} and ${var2}.`,
            confidence: 1 - correlation.pValue,
            importance: strength * 0.9,
            relatedVariables: [var1, var2],
            visualizationRecommendation: {
              type: 'scatter',
              config: {
                data: values1.map((v, i) => ({ x: v, y: values2[i] })),
                xLabel: var1,
                yLabel: var2,
                showTrendLine: true
              }
            }
          });
        }
      }
    }
    
    // If enough data, generate forecast insights
    variables.forEach(variable => {
      const values = data[variable];
      if (values.length >= 10) {
        const forecast = this.generateForecast(values);
        if (forecast) {
          insights.push({
            id: uuidv4(),
            type: 'forecast',
            description: `Based on historical patterns, ${variable} is projected to ${
              forecast.forecastData[forecast.forecastData.length - 1] > values[values.length - 1]
                ? 'increase'
                : 'decrease'
            } in the future, with a forecast error (MAPE) of ${(forecast.mape * 100).toFixed(1)}%.`,
            confidence: 0.95 - (forecast.mape * 0.5), // Lower confidence for higher error
            importance: 0.85,
            relatedVariables: [variable],
            visualizationRecommendation: {
              type: 'line',
              config: {
                data: [
                  ...values.map((v, i) => ({ x: i, y: v, type: 'historical' })),
                  ...forecast.forecastData.map((v, i) => ({ 
                    x: values.length + i, 
                    y: v, 
                    type: 'forecast',
                    lowerBound: forecast.lowerBound[i],
                    upperBound: forecast.upperBound[i]
                  }))
                ],
                xLabel: 'Time',
                yLabel: variable,
                showConfidenceInterval: true
              }
            }
          });
        }
      }
    });
    
    // Sort insights by importance
    return insights.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Calculate Mean Absolute Percentage Error (MAPE)
   */
  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return NaN;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? sum / count : NaN;
  }
  
  /**
   * Calculate Root Mean Square Error (RMSE)
   */
  private calculateRMSE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return NaN;
    
    let sum = 0;
    
    for (let i = 0; i < actual.length; i++) {
      sum += Math.pow(actual[i] - predicted[i], 2);
    }
    
    return Math.sqrt(sum / actual.length);
  }
  
  /**
   * Calculate autocorrelation for time series
   */
  private calculateAutocorrelation(data: number[], lag: number): number[] {
    const result = [];
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const denominator = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    
    for (let k = 0; k <= lag; k++) {
      let numerator = 0;
      for (let i = 0; i < data.length - k; i++) {
        numerator += (data[i] - mean) * (data[i + k] - mean);
      }
      result.push(numerator / denominator);
    }
    
    return result;
  }
  
  /**
   * Calculate p-value from t-statistic
   * This is an approximation, not an exact calculation
   */
  private calculatePValueFromT(t: number, df: number): number {
    // Absolute t value
    const absT = Math.abs(t);
    
    // Simple approximation for p-value based on the t-distribution
    // This is not exact but gives a reasonable approximation
    // Better implementations would use the incomplete beta function
    const x = df / (df + absT * absT);
    let p = 0;
    
    if (df >= 1) {
      const beta = Math.exp(
        this.logGamma((df + 1) / 2) - 
        this.logGamma(df / 2) - 
        0.5 * Math.log(Math.PI * df)
      );
      
      let probability = 1 - beta * Math.pow(x, df / 2);
      
      // Two-tailed test
      p = 2 * (1 - probability);
    }
    
    return Math.min(Math.max(p, 0.00001), 0.99999);
  }
  
  /**
   * Log-gamma function for p-value calculation
   */
  private logGamma(z: number): number {
    // Approximation of the log-gamma function
    // Lanczos approximation
    const p = [
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    
    if (z < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
    }
    
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < p.length; i++) {
      x += p[i] / (z + i + 1);
    }
    
    const t = z + p.length - 0.5;
    return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
} 