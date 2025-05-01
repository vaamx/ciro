import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
// Import types from response parsing service (or move to shared types later)
import { StructuredAnalysisResponse, AnalysisStep } from '../ai/response-parsing.service';

@Injectable()
export class VisualizationPreparationService {
  private readonly logger = createServiceLogger('VisualizationPreparationService');

  constructor() {
    this.logger.info('VisualizationPreparationService initialized');
  }

  // --- Start of Methods Moved from DataAnalysisOrchestratorService --- 

  /**
   * Extract data for visualization from a structured response (Moved Method)
   * @param response The structured response
   * @param originalData The original data
   * @returns Data formatted for visualization
   */
  public extractDataForVisualization(response: StructuredAnalysisResponse, originalData: any): any[] {
    // First check if any step contains data
    for (const step of response.steps) {
      if (step.data && Array.isArray(step.data)) {
        this.logger.debug('Found visualization data within analysis step');
        return step.data;
      }
    }
    
    // If no data in steps, use the original data if it's an array
    if (Array.isArray(originalData)) {
      this.logger.debug('Using original data for visualization');
      return originalData;
    }
    
    // If original data is not an array, try to parse it
    if (typeof originalData === 'string') {
      try {
        const parsed = JSON.parse(originalData);
        if (Array.isArray(parsed)) {
          this.logger.debug('Using parsed original string data for visualization');
          return parsed;
        }
      } catch {
        // Not valid JSON, try CSV parsing if applicable
        if (originalData.includes(',') && originalData.includes('\n')) {
          try {
            const lines = originalData.trim().split('\n');
            const headers = lines[0].split(',');
            
            const parsedCsv = lines.slice(1).map(line => {
              const values = line.split(',');
              const row: Record<string, any> = {};
              
              headers.forEach((header, index) => {
                let value = values[index]?.trim() || '';
                
                // Convert to number if possible
                if (/^-?\d+(\.\d+)?$/.test(value)) {
                  row[header] = parseFloat(value);
                } else {
                  row[header] = value.replace(/^\"|\"$/g, ''); // Remove quotes
                }
              });
              
              return row;
            });
            this.logger.debug('Using parsed original CSV string data for visualization');
            return parsedCsv;
          } catch (csvError) {
            this.logger.warn('Failed to parse original data as CSV', csvError);
          }
        }
      }
    }
    
    // Generate sample data if needed
    this.logger.warn('Could not extract or parse data for visualization, returning sample data.');
    return [
      { label: 'Category A', value: 30 },
      { label: 'Category B', value: 45 },
      { label: 'Category C', value: 25 }
    ];
  }

  /**
   * Generate a basic visualization configuration (Moved Method)
   * NOTE: This may need refinement or be replaced by logic in VisualizationService.
   * @param data The data to visualize
   * @param type The visualization type (string, ideally ChartType enum)
   * @param title Title for the visualization
   * @returns Visualization configuration object
   */
  public generateVisualizationConfig(data: any, type: string, title: string | undefined): any {
    const safeTitle = title || 'Visualization';
    this.logger.debug(`Generating basic config for ${type} visualization: ${safeTitle}`);

    // Create basic configuration
    const config: any = {
      data: Array.isArray(data) ? data : [],
      labels: {
        title: safeTitle,
        xAxis: '',
        yAxis: ''
      }
    };
    
    // Process array data to guess axis keys
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const keys = Object.keys(firstItem);
        
        // Find numeric columns for y-axis
        const numericKeys = keys.filter(key => 
          typeof firstItem[key] === 'number' || 
          (typeof firstItem[key] === 'string' && !isNaN(parseFloat(firstItem[key])))
        );
        
        // Find string/category columns for x-axis
        const categoryKeys = keys.filter(key => 
          typeof firstItem[key] === 'string' && 
          !numericKeys.includes(key)
        );
        
        // Assign guessed keys
        const xKey = categoryKeys.length > 0 ? categoryKeys[0] : keys[0];
        const yKey = numericKeys.length > 0 ? numericKeys[0] : (keys.length > 1 ? keys[1] : keys[0]);
        
        config.xKey = xKey;
        config.yKey = yKey;
        config.labels.xAxis = xKey;
        config.labels.yAxis = yKey;
        this.logger.debug(`Guessed axes: x=${xKey}, y=${yKey}`);
      }
    }
    
    return config;
  }

  // --- End of Moved Methods --- 
} 