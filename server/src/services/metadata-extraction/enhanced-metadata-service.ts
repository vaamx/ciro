import { createServiceLogger } from '../../utils/logger-factory';

/**
 * Represents the various data source types supported by the application
 */
export type DataSourceType = 
  | 'snowflake' 
  | 'file' 
  | '***REMOVED***ql' 
  | 'mysql'
  | 'excel'
  | 'csv'
  | 'pdf'
  | 'docx'
  | 'unknown';

/**
 * Enhanced metadata structure used across all source types
 */
export interface EnhancedMetadata {
  numericRanges: Record<string, { min: number, max: number }>;
  entityFrequencies: Record<string, Record<string|number, number>>;
  uniqueValues: Record<string, (string|number)[]>;
  commonValues: Record<string, (string|number)[]>;
  dateRanges?: Record<string, { min: Date, max: Date }>;
  valueDistributions?: Record<string, Record<string|number, number>>;
  totalRows?: number;
  lastUpdated: Date;
}

/**
 * Options for the metadata extraction process
 */
export interface EnhancedMetadataOptions {
  maxUniqueValues?: number;
  includedFields?: string[];
  excludedFields?: string[];
  calculateDistributions?: boolean;
  extractDates?: boolean;
  sampleSize?: number;
}

/**
 * Service that extracts enhanced metadata from various data sources
 * to improve query processing capabilities.
 */
export class EnhancedMetadataService {
  private readonly logger = createServiceLogger('EnhancedMetadataService');
  private static instance: EnhancedMetadataService | null = null;

  private constructor() {
    this.logger.info('EnhancedMetadataService initialized');
  }

  /**
   * Gets the singleton instance of the service
   */
  public static getInstance(): EnhancedMetadataService {
    if (!EnhancedMetadataService.instance) {
      EnhancedMetadataService.instance = new EnhancedMetadataService();
    }
    return EnhancedMetadataService.instance;
  }

  /**
   * Extract enhanced metadata from any data source
   */
  async extractEnhancedMetadata(
    source: any, 
    sourceType: DataSourceType, 
    options: EnhancedMetadataOptions = {}
  ): Promise<EnhancedMetadata> {
    // Choose appropriate extractor based on source type
    this.logger.info(`Extracting enhanced metadata for source type: ${sourceType}`);
    
    switch(sourceType) {
      case 'snowflake':
        return this.extractSnowflakeMetadata(source, options);
      case 'file':
        return this.extractFileMetadata(source, options);
      case '***REMOVED***ql':
        return this.extractPostgresMetadata(source, options);
      default:
        return this.extractGenericMetadata(source, options);
    }
  }
  
  /**
   * Extract metadata from Snowflake data source
   */
  private async extractSnowflakeMetadata(
    source: any[], 
    options: EnhancedMetadataOptions
  ): Promise<EnhancedMetadata> {
    this.logger.info(`Extracting Snowflake metadata from ${source.length} rows`);
    
    // Sample data if needed
    const data = this.sampleData(source, options.sampleSize);
    
    // Get field names from first row
    const fields = data.length > 0 ? Object.keys(data[0]) : [];
    
    // Filter fields if specified
    const processedFields = this.filterFields(fields, options);
    
    // Process each field type
    const numericRanges = this.extractNumericRanges(data, processedFields);
    const entityFrequencies = this.extractEntityFrequencies(data, processedFields);
    const { uniqueValues, commonValues } = this.extractValueSets(data, processedFields, options.maxUniqueValues || 100);
    
    // Extract date ranges if enabled
    const dateRanges = options.extractDates ? this.extractDateRanges(data, processedFields) : undefined;
    
    // Create value distributions if enabled
    const valueDistributions = options.calculateDistributions ? 
      this.calculateValueDistributions(data, processedFields) : undefined;
    
    return {
      numericRanges,
      entityFrequencies,
      uniqueValues,
      commonValues,
      dateRanges,
      valueDistributions,
      totalRows: source.length,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Extract metadata from file data source
   */
  private async extractFileMetadata(
    source: any[], 
    options: EnhancedMetadataOptions
  ): Promise<EnhancedMetadata> {
    this.logger.info(`Extracting file metadata from ${source.length} rows`);
    
    // For files, use the same approach as generic data
    return this.extractGenericMetadata(source, options);
  }
  
  /**
   * Extract metadata from PostgreSQL data source
   */
  private async extractPostgresMetadata(
    source: any[], 
    options: EnhancedMetadataOptions
  ): Promise<EnhancedMetadata> {
    this.logger.info(`Extracting PostgreSQL metadata from ${source.length} rows`);
    
    // Similar approach as Snowflake but with potential PostgreSQL specific optimizations
    return this.extractGenericMetadata(source, options);
  }
  
  /**
   * Generic metadata extraction for any data source
   */
  private async extractGenericMetadata(
    source: any[], 
    options: EnhancedMetadataOptions
  ): Promise<EnhancedMetadata> {
    this.logger.info(`Extracting generic metadata from ${source.length} rows`);
    
    // Sample data if needed
    const data = this.sampleData(source, options.sampleSize);
    
    // Get field names from first row
    const fields = data.length > 0 ? Object.keys(data[0]) : [];
    
    // Filter fields if specified
    const processedFields = this.filterFields(fields, options);
    
    // Process each field type
    const numericRanges = this.extractNumericRanges(data, processedFields);
    const entityFrequencies = this.extractEntityFrequencies(data, processedFields);
    const { uniqueValues, commonValues } = this.extractValueSets(data, processedFields, options.maxUniqueValues || 100);
    
    return {
      numericRanges,
      entityFrequencies,
      uniqueValues,
      commonValues,
      totalRows: source.length,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Sample data if it's too large
   */
  private sampleData(data: any[], sampleSize?: number): any[] {
    if (!sampleSize || data.length <= sampleSize) {
      return data;
    }
    
    // Random sampling strategy
    const sampled: any[] = [];
    const step = data.length / sampleSize;
    
    // Take some from beginning, middle and end for better representation
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor(i * step);
      sampled.push(data[idx]);
    }
    
    return sampled;
  }
  
  /**
   * Filter fields based on inclusion/exclusion options
   */
  private filterFields(fields: string[], options: EnhancedMetadataOptions): string[] {
    if (options.includedFields && options.includedFields.length > 0) {
      return fields.filter(field => options.includedFields!.includes(field));
    }
    
    if (options.excludedFields && options.excludedFields.length > 0) {
      return fields.filter(field => !options.excludedFields!.includes(field));
    }
    
    return fields;
  }
  
  /**
   * Extract min/max for all numeric fields
   */
  private extractNumericRanges(data: any[], fields: string[]): Record<string, { min: number, max: number }> {
    const ranges: Record<string, { min: number, max: number }> = {};
    
    for (const field of fields) {
      // Skip if no data
      if (data.length === 0) continue;
      
      // Check if this field contains numeric values
      const firstNonNullValue = data.find(row => row[field] !== null && row[field] !== undefined);
      if (!firstNonNullValue) continue;
      
      const sampleValue = firstNonNullValue[field];
      if (typeof sampleValue !== 'number') continue;
      
      // Initialize with first non-null value
      ranges[field] = { 
        min: Number.MAX_VALUE, 
        max: Number.MIN_VALUE 
      };
      
      // Find min and max values
      for (const row of data) {
        const value = row[field];
        if (value === null || value === undefined || typeof value !== 'number') continue;
        
        ranges[field].min = Math.min(ranges[field].min, value);
        ranges[field].max = Math.max(ranges[field].max, value);
      }
    }
    
    return ranges;
  }
  
  /**
   * Count occurrences of entity values
   */
  private extractEntityFrequencies(data: any[], fields: string[]): Record<string, Record<string|number, number>> {
    const frequencies: Record<string, Record<string|number, number>> = {};
    
    for (const field of fields) {
      frequencies[field] = {};
      
      for (const row of data) {
        const value = row[field];
        if (value === null || value === undefined) continue;
        
        // Convert to string for consistency
        const strValue = String(value);
        
        frequencies[field][strValue] = (frequencies[field][strValue] || 0) + 1;
      }
    }
    
    return frequencies;
  }
  
  /**
   * Extract unique values and most common values for fields
   */
  private extractValueSets(
    data: any[], 
    fields: string[], 
    maxValues: number
  ): { uniqueValues: Record<string, (string|number)[]>, commonValues: Record<string, (string|number)[]> } {
    const uniqueValues: Record<string, (string|number)[]> = {};
    const commonValues: Record<string, (string|number)[]> = {};
    
    for (const field of fields) {
      // Get all values for this field
      const values = data.map(row => row[field])
                         .filter(val => val !== null && val !== undefined);
      
      // Calculate frequencies
      const valueFrequencies: Record<string, { value: string|number, count: number }> = {};
      for (const value of values) {
        const strValue = String(value);
        if (!valueFrequencies[strValue]) {
          valueFrequencies[strValue] = { value, count: 0 };
        }
        valueFrequencies[strValue].count++;
      }
      
      // Get unique values (up to the limit)
      const uniqueValuesList = [...new Set(values)];
      uniqueValues[field] = uniqueValuesList.slice(0, maxValues);
      
      // Get most common values
      const sortedByFrequency = Object.values(valueFrequencies)
        .sort((a, b) => b.count - a.count)
        .map(item => item.value);
      
      commonValues[field] = sortedByFrequency.slice(0, maxValues);
    }
    
    return { uniqueValues, commonValues };
  }
  
  /**
   * Extract date ranges (min and max dates) for date fields
   */
  private extractDateRanges(data: any[], fields: string[]): Record<string, { min: Date, max: Date }> {
    const ranges: Record<string, { min: Date, max: Date }> = {};
    
    for (const field of fields) {
      // Skip if no data
      if (data.length === 0) continue;
      
      // Check if this field contains date values
      const dateValues = data
        .map(row => row[field])
        .filter(val => val !== null && val !== undefined)
        .map(val => this.tryParseDate(val))
        .filter(val => val !== null);
      
      if (dateValues.length === 0) continue;
      
      // Initialize with extreme values
      ranges[field] = { 
        min: new Date(8640000000000000), // Max date
        max: new Date(-8640000000000000) // Min date 
      };
      
      // Find min and max dates
      for (const date of dateValues) {
        if (!date) continue;
        
        if (date < ranges[field].min) {
          ranges[field].min = new Date(date);
        }
        
        if (date > ranges[field].max) {
          ranges[field].max = new Date(date);
        }
      }
    }
    
    return ranges;
  }
  
  /**
   * Try to parse a value as Date
   */
  private tryParseDate(value: any): Date | null {
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  }
  
  /**
   * Calculate value distributions for data analytics
   */
  private calculateValueDistributions(data: any[], fields: string[]): Record<string, Record<string|number, number>> {
    // For now, this is the same as entity frequencies but could be enhanced
    // with histogram binning for numeric data in the future
    return this.extractEntityFrequencies(data, fields);
  }
} 