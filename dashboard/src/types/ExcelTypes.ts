/**
 * ExcelTypes.ts - Type definitions for Excel data analysis
 */

export interface AnalysisStep {
  id: string;
  type: string;
  description: string;
  order: number;
  content?: string;
  data?: any;
  visualization?: Visualization;
}

export interface Visualization {
  type: string;
  config: {
    data: any[];
    xKey?: string;
    yKey?: string;
    series?: Array<{ 
      dataKey: string; 
      name?: string; 
      color?: string; 
      type?: string;
    }>;
    labels?: { 
      title?: string; 
      xAxis?: string; 
      yAxis?: string;
    };
    options?: Record<string, any>;
  };
}

export interface StructuredAnalysisResponse {
  summary: string;
  steps: AnalysisStep[];
  insights: string[];
  visualization: Visualization | null;
}

export interface ExcelAnalysisResult {
  content: string;
  structuredResponse: StructuredAnalysisResponse;
}

export interface AnalyticalResponse {
  summary: string;
  analysis?: string;
  steps: Array<{
    id: string | number;
    type?: string;
    description?: string;
    content: string;
    order?: number;
    data?: any;
  }>;
  insights: string[];
  visualization?: any;
  visualizations?: Visualization[];
} 