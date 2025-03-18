import { UniversalDataProcessor, DataSourceType } from './UniversalDataProcessor';
import { UniversalDataHandler } from '../rag/DirectExcelHandler';
import { PromptTemplates } from '../rag/PromptTemplates';

/**
 * ResponseHandlerFactory - Factory class for determining the appropriate handler
 * for different query types and data sources.
 * 
 * This centralized approach ensures that all queries and data sources are processed
 * consistently with the appropriate level of analytical processing and visualization.
 */
export class ResponseHandlerFactory {
  private static universalProcessor: UniversalDataProcessor;
  private static universalDataHandler: UniversalDataHandler;
  private static promptTemplates: PromptTemplates;
  private static clockData: any = null;
  
  /**
   * Initialize the ResponseHandlerFactory with required dependencies
   */
  public static initialize(): void {
    // Initialize processor components if not already done
    if (!this.universalProcessor) {
      try {
        this.universalProcessor = new UniversalDataProcessor();
        this.universalDataHandler = new UniversalDataHandler();
        this.promptTemplates = new PromptTemplates();
        
        // Try to load the newest_clocks.json data
        this.loadClockData().catch(error => {
          console.warn('Failed to load clock data during initialization, using mock data:', error);
          this.mockClockData();
        });
      } catch (error) {
        console.error('Error during ResponseHandlerFactory initialization:', error);
        // Initialize with minimal defaults to keep the system functional
        if (!this.universalProcessor) this.universalProcessor = new UniversalDataProcessor();
        if (!this.universalDataHandler) this.universalDataHandler = new UniversalDataHandler();
        if (!this.promptTemplates) this.promptTemplates = new PromptTemplates();
        
        // Use mock clock data
        this.mockClockData();
      }
    }
  }
  
  /**
   * Load clock data for data synchronization
   */
  private static async loadClockData(): Promise<void> {
    try {
      // Check for authentication token
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Get the API base URL from environment or use default backend URL
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      // Get the currently selected data source from localStorage
      let dataSourceId = null;
      try {
        const selectedDataSource = localStorage.getItem('selectedDataSource');
        if (selectedDataSource) {
          const sourceData = JSON.parse(selectedDataSource);
          if (sourceData && sourceData.id) {
            dataSourceId = sourceData.id.toString();
            console.log(`Using selected data source ID: ${dataSourceId} for clock data`);
          }
        }
      } catch (error) {
        console.warn('Error parsing selectedDataSource from localStorage:', error);
      }
      
      // If no data source is selected, use mock data and return early
      if (!dataSourceId) {
        console.warn('No data source selected, using mock clock data instead');
        this.mockClockData();
        return;
      }
      
      // Determine if we should use the proxy (for development) or direct API URL
      const useProxy = import.meta.env.DEV && !import.meta.env.VITE_DISABLE_PROXY;
      const apiUrl = useProxy ? `/api/qdrant/clock-data/datasource_${dataSourceId}/0` : 
                              `${API_BASE_URL}/api/qdrant/clock-data/datasource_${dataSourceId}/0`;
      
      console.log(`Fetching clock data from: ${apiUrl}`);
      
      // Use the API endpoint instead of direct file access
      const response = await fetch(apiUrl, {
        headers
      });
      
      if (response.ok) {
        this.clockData = await response.json();
        console.log('Clock data loaded successfully');
      } else {
        console.warn(`Could not load clock data for datasource_${dataSourceId}: ${response.statusText}`);
        // Use mock clock data instead
        this.mockClockData();
      }
    } catch (error) {
      console.error('Error loading clock data:', error);
      // Use mock clock data in case of error
      this.mockClockData();
    }
  }
  
  /**
   * Create mock clock data when actual data is unavailable
   */
  private static mockClockData(): void {
    this.clockData = {
      last_updated: new Date().toISOString(),
      clocks: {
        search: Date.now() - 5000,
        embedding: Date.now() - 3000,
        processing: Date.now() - 2000
      }
    };
    console.log('Using mock clock data:', this.clockData);
  }
  
  /**
   * Process a query with the appropriate handler based on the data source and query type
   * @param query The user's query
   * @param data The data to analyze
   * @param dataSourceHint Optional hint about the data source type
   * @returns Structured response with visualization and analysis
   */
  public static async processQuery(
    query: string, 
    data: any, 
    dataSourceHint?: string | DataSourceType
  ): Promise<any> {
    console.log(`ResponseHandlerFactory: Processing query with hint: ${dataSourceHint}`);
    
    // Determine data source type
    let dataSourceType: DataSourceType;
    
    if (dataSourceHint) {
      if (typeof dataSourceHint === 'string') {
        dataSourceType = this.mapHintToDataSourceType(dataSourceHint);
      } else {
        // Already a DataSourceType enum
        dataSourceType = dataSourceHint;
      }
    } else {
      // Auto-detect data type
      dataSourceType = this.universalProcessor.detectDataType(data);
    }
    
    console.log(`ResponseHandlerFactory: Using data source type: ${dataSourceType}`);
    
    // Prepare the data for processing (convert to appropriate format)
    const preparedData = this.prepareDataForProcessing(data, dataSourceType);
    
    try {
      // Process the query using the universal processor
      const result = await this.universalProcessor.processDataQuery(
        query,
        preparedData,
        dataSourceType
      );
      
      // Return the processed result directly
      return {
        content: result.summary,
        structuredResponse: result,
        metadata: {
          dataSourceType,
          model: 'gpt-4o', // Default model
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }
  
  /**
   * Prepare data for processing based on type
   */
  private static prepareDataForProcessing(data: any, dataSourceType: DataSourceType): any {
    // For tabular data sources, ensure we have an array of objects
    if (
      dataSourceType === DataSourceType.TABLE || 
      dataSourceType === DataSourceType.CSV || 
      dataSourceType === DataSourceType.EXCEL
    ) {
      if (typeof data === 'string') {
        try {
          // Try to parse JSON
          const parsed = JSON.parse(data);
          return parsed;
        } catch (e) {
          // Not JSON, might be CSV
          const parsedCSV = this.tryParseCSV(data);
          if (parsedCSV) {
            return parsedCSV;
          }
        }
      }
    }
    
    // For nested JSON data, try to flatten it
    if (dataSourceType === DataSourceType.JSON && typeof data === 'object') {
      return this.flattenIfNeeded(data);
    }
    
    return data;
  }
  
  /**
   * Try to parse CSV data
   */
  private static tryParseCSV(data: string): any[] | null {
    const lines = data.trim().split('\n');
    if (lines.length < 2) return null;
    
    const delimiters = [',', '\t', '|', ';'];
    let bestDelimiter = ',';
    let maxColumns = 0;
    
    // Find best delimiter
    for (const delimiter of delimiters) {
      const columns = lines[0].split(delimiter).length;
      if (columns > maxColumns) {
        maxColumns = columns;
        bestDelimiter = delimiter;
      }
    }
    
    if (maxColumns <= 1) return null;
    
    const headers = lines[0].split(bestDelimiter).map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(bestDelimiter);
      const row: Record<string, any> = {};
      
      for (let j = 0; j < headers.length; j++) {
        const value = j < values.length ? values[j].trim() : '';
        row[headers[j]] = this.detectDataType(value);
      }
      
      result.push(row);
    }
    
    return result;
  }
  
  /**
   * Detect and convert the data type of a string value
   */
  private static detectDataType(value: string): any {
    if (!value) return '';
    
    // Try to convert to number
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    
    // Try to convert to boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Return as string
    return value;
  }
  
  /**
   * Flatten nested JSON if needed for better processing
   */
  private static flattenIfNeeded(data: any): any {
    // If it's an array, process each item
    if (Array.isArray(data)) {
      return data.map(item => 
        typeof item === 'object' ? this.flattenIfNeeded(item) : item
      );
    }
    
    // If not an object, return as is
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    // Check if the object has nested objects but no arrays
    const hasNestedObjects = Object.values(data).some(
      value => typeof value === 'object' && value !== null && !Array.isArray(value)
    );
    
    // If the object has nested objects but no arrays, try to flatten
    if (hasNestedObjects) {
      const flattened: Record<string, any> = {};
      
      // Process each property
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Flatten nested object
          const nestedFlattened = this.flattenIfNeeded(value);
          
          // Add flattened nested properties with prefix
          if (typeof nestedFlattened === 'object') {
            for (const [nestedKey, nestedValue] of Object.entries(nestedFlattened)) {
              flattened[`${key}_${nestedKey}`] = nestedValue;
            }
          } else {
            flattened[key] = nestedFlattened;
          }
        } else {
          // Keep non-object properties as is
          flattened[key] = value;
        }
      }
      
      return flattened;
    }
    
    return data;
  }
  
  /**
   * Map a data source hint to a DataSourceType
   * @param hint The data source hint (e.g., file extension or MIME type)
   */
  private static mapHintToDataSourceType(hint: string): DataSourceType {
    const lowerHint = hint.toLowerCase();
    
    if (lowerHint.includes('excel') || lowerHint.includes('xlsx') || lowerHint.includes('xls')) {
      return DataSourceType.EXCEL;
    } else if (lowerHint.includes('csv')) {
      return DataSourceType.CSV;
    } else if (lowerHint.includes('pdf')) {
      return DataSourceType.PDF;
    } else if (lowerHint.includes('doc') || lowerHint.includes('word')) {
      return DataSourceType.DOC;
    } else if (lowerHint.includes('json')) {
      return DataSourceType.JSON;
    } else if (lowerHint.includes('table')) {
      return DataSourceType.TABLE;
    } else if (lowerHint.includes('text') || lowerHint.includes('txt')) {
      return DataSourceType.TEXT;
    }
    
    return DataSourceType.UNKNOWN;
  }
  
  /**
   * Get the appropriate system prompt for a data source and query
   * @param dataSourceType The type of data source
   * @param isAnalytical Whether the query is analytical
   */
  public static getPromptForDataSource(
    dataSourceType: DataSourceType, 
    isAnalytical: boolean
  ): string {
    if (!this.promptTemplates) {
      this.initialize();
    }
    
    if (isAnalytical) {
      return this.promptTemplates.getAnalyticalPrompt();
    }
    
    switch (dataSourceType) {
      case DataSourceType.EXCEL:
        return this.promptTemplates.getExcelDataPrompt();
      case DataSourceType.CSV:
        return this.promptTemplates.getCSVDataExtractionPrompt();
      case DataSourceType.PDF:
      case DataSourceType.DOC:
        return this.promptTemplates.getForceDataExtractionPrompt();
      default:
        return this.promptTemplates.getStandardQueryPrompt();
    }
  }
} 