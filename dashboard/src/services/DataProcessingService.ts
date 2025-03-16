import { ResponseHandlerFactory } from './processors/ResponseHandlerFactory';
import { DataSourceType } from './processors/UniversalDataProcessor';
import { StructuredAnalysisResponse } from '../types/ExcelTypes';
import { MessageMetadata } from '../components/Chat/types';

/**
 * DataProcessingService - Central service for processing data queries
 * using the Universal Structured Response System.
 * 
 * This service serves as an integration point between the application
 * and the ResponseHandlerFactory.
 */
export class DataProcessingService {
  private static instance: DataProcessingService;

  private constructor() {
    try {
      // Initialize the ResponseHandlerFactory
      ResponseHandlerFactory.initialize();
    } catch (error) {
      console.error('Error initializing ResponseHandlerFactory:', error);
      // Continue with initialization even if clock data fails to load
      // This ensures the service is still usable for data processing
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DataProcessingService {
    if (!DataProcessingService.instance) {
      DataProcessingService.instance = new DataProcessingService();
    }
    return DataProcessingService.instance;
  }

  /**
   * Process a query with data from any source
   * @param query User's query text
   * @param data Data to analyze (can be any format)
   * @param dataSourceType Optional hint about the data type
   * @returns Structured response with visualizations and insights
   */
  public async processQuery(
    query: string,
    data: any,
    dataSourceType?: string
  ): Promise<{
    content: string;
    structuredResponse: StructuredAnalysisResponse;
    metadata: MessageMetadata;
  }> {
    // Initialize dataSourceEnum outside try-catch to make it available in catch block
    let dataSourceEnum: DataSourceType = DataSourceType.UNKNOWN;
    
    try {
      console.log('Processing query with DataProcessingService:', query);
      
      // Map string dataSourceType to enum if provided, or detect type
      if (dataSourceType) {
        // Convert string type to enum
        dataSourceEnum = this.mapStringToDataSourceType(dataSourceType);
      } else {
        // Auto-detect data type if not specified
        dataSourceEnum = this.detectDataType(data);
      }
      
      console.log(`Data source type determined: ${dataSourceEnum}`);
      
      // Process the query using the ResponseHandlerFactory
      const result = await ResponseHandlerFactory.processQuery(query, data, dataSourceEnum);
      
      if (!result || !result.structuredResponse) {
        throw new Error('Failed to generate structured response');
      }
      
      // Create metadata for the message
      const metadata: MessageMetadata = {
        dataSourceType: dataSourceEnum,
        processingTime: Date.now(),
        structuredResponse: result.structuredResponse,
        model: result.model || 'gpt-4o-mini'
      };
      
      // Return the formatted result
      return {
        content: result.content || 'Analysis complete',
        structuredResponse: result.structuredResponse,
        metadata
      };
    } catch (error) {
      console.error('Error in DataProcessingService.processQuery:', error);
      
      // Return a fallback response in case of error
      const fallbackResponse: StructuredAnalysisResponse = {
        summary: 'An error occurred while processing your query. Please try again.',
        steps: [
          {
            id: 'error',
            type: 'error',
            description: 'Error processing query',
            content: error instanceof Error ? error.message : 'Unknown error',
            order: 1
          }
        ],
        insights: ['Unable to process query due to an error.'],
        visualization: null // Add visualization property as null to satisfy interface
      };
      
      return {
        content: 'An error occurred while processing your query. Please try again.',
        structuredResponse: fallbackResponse,
        metadata: {
          dataSourceType: dataSourceEnum,
          processingTime: Date.now(),
          structuredResponse: fallbackResponse,
          model: 'gpt-4o-mini',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Map string data source type to enum
   */
  private mapStringToDataSourceType(type: string): DataSourceType {
    type = type.toLowerCase();
    
    switch (type) {
      case 'excel':
      case 'xlsx':
      case 'xls':
        return DataSourceType.EXCEL;
        
      case 'csv':
        return DataSourceType.CSV;
        
      case 'pdf':
        return DataSourceType.PDF;
        
      case 'doc':
      case 'docx':
      case 'document':
        return DataSourceType.DOC;
        
      case 'text':
      case 'txt':
        return DataSourceType.TEXT;
        
      case 'json':
        return DataSourceType.JSON;
        
      case 'table':
        return DataSourceType.TABLE;
        
      default:
        return DataSourceType.UNKNOWN;
    }
  }

  /**
   * Detect the type of data
   * @param data Data to analyze
   * @returns Detected data type
   */
  public detectDataType(data: any): DataSourceType {
    // Use the UniversalDataProcessor to detect the data type
    const factory = ResponseHandlerFactory as any;
    if (factory.universalProcessor) {
      return factory.universalProcessor.detectDataType(data);
    }
    
    // Fallback to UNKNOWN if not initialized
    return DataSourceType.UNKNOWN;
  }
  
  /**
   * Add a visualization to the dashboard
   * @param visualization Visualization configuration
   * @param dashboardId Optional dashboard ID (uses current dashboard if not specified)
   * @returns Success status
   */
  public async addToDashboard(
    visualization: any,
    dashboardId?: string
  ): Promise<boolean> {
    try {
      console.log('Adding visualization to dashboard:', JSON.stringify(visualization, null, 2));
      
      // Map the visualization type to a supported type
      const mapToSupportedType = (type: string): string => {
        const typeMap: Record<string, string> = {
          'bar_chart': 'bar',
          'line_chart': 'line',
          'pie_chart': 'pie',
          'area_chart': 'area',
          'scatter_chart': 'scatter'
        };
        return typeMap[type] || type;
      };
      
      // Get dashboard context from window if available
      // @ts-ignore
      if (window.dashboardContext) {
        console.log('Dashboard context found');
        
        // @ts-ignore
        const currentDashboard = dashboardId ? await window.dashboardContext.getDashboard(dashboardId) : window.dashboardContext.currentDashboard;
        
        if (currentDashboard) {
          // Ensure we have valid data
          const visualizationData = visualization.config?.data || [];
          if (!Array.isArray(visualizationData) || visualizationData.length === 0) {
            console.error('No valid data found in visualization:', visualization);
            return false;
          }
          
          // Get the correct visualization type
          const visualizationType = mapToSupportedType(visualization.type) || 'bar';
          console.log('Using visualization type:', visualizationType);
          
          // Create a new widget configuration
          const newWidget = {
            id: `viz-${Date.now()}`,
            content: "visualization-widget",
            type: "visualization-widget",
            widget_type: "visualization-widget",
            title: visualization.config?.labels?.title || "Analysis Visualization",
            size: "medium",
            settings: {
              visualization: {
                type: visualizationType,
                data: JSON.parse(JSON.stringify(visualization.config?.data || [])), // Deep copy
                xKey: visualization.config?.xKey || 'Segment',
                yKey: visualization.config?.yKey || 'Sales',
                series: visualization.config?.series || [
                  {
                    dataKey: visualization.config?.yKey || 'Sales',
                    name: visualization.config?.labels?.yAxis || visualization.config?.yKey || "Value",
                    color: '#4f46e5'
                  }
                ],
                labels: {
                  title: visualization.config?.labels?.title || "Analysis Visualization",
                  xAxis: visualization.config?.labels?.xAxis || visualization.config?.xKey || 'Segment',
                  yAxis: visualization.config?.labels?.yAxis || visualization.config?.yKey || 'Sales'
                },
                options: {
                  useMultipleColors: visualizationType === 'bar' ? true : false,
                  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
                }
              },
              refreshInterval: 0,
              showTitle: true,
              expandable: true
            },
            position: Math.floor(Math.random() * 1000) // Random position
          };
          
          console.log('New widget configuration:', JSON.stringify(newWidget, null, 2));
          
          // Add the new widget to the dashboard
          const updatedWidgets = [...currentDashboard.widgets, newWidget];
          
          // @ts-ignore
          await window.dashboardContext.updateWidgets(updatedWidgets);
          console.log('Widget added successfully');
          
          return true;
        } else {
          console.warn('No dashboard found to add visualization');
        }
      } else {
        console.warn('Dashboard context not available');
      }
      
      return false;
    } catch (error: any) {
      console.error('Error adding visualization to dashboard:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const dataProcessingService = DataProcessingService.getInstance(); 