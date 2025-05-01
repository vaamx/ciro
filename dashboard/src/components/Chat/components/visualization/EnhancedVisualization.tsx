import React, { useState, useEffect, useMemo } from 'react';
import { VisualizationRenderer } from './VisualizationRenderer';
import { 
  generateInsightsFromData,
  generateDomainSpecificInsights,
  generateSummaryFromData,
  generateRecommendations,
  generateMetricsFromData
} from './utils';
import { MessageMarkdown } from '../MessageMarkdown';

/**
 * Interface for analytical step with visualization
 */
export interface AnalyticalStep {
  id: string;
  type: string;
  description: string;
  order: number;
  data?: any;
  content?: string;
  insights?: string[];
  metrics?: Array<{label: string, value: string | number}>;
  visualization?: {
    type: string;
    config: {
      data?: any[];
      xKey?: string;
      yKey?: string;
      series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
      labels?: { title?: string; xAxis?: string; yAxis?: string };
      options?: Record<string, any>;
    };
  };
  recommendations?: string[];
}

/**
 * Props for EnhancedVisualization
 */
interface EnhancedVisualizationProps {
  steps?: AnalyticalStep[];
  dataSourceType?: string;
  insights?: string[];
  summary?: string;
  visualizationData?: {
    data: any[];
    type: string;
    xKey?: string;
    yKey?: string;
    series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    options?: Record<string, any>;
  } | null;
  visualizationsData?: Array<{
    id: string;
    data: any[];
    type: string;
    xKey?: string;
    yKey?: string;
    series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
    title?: string;
    description?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    options?: Record<string, any>;
  }>;
  autoPlay?: boolean;
  initialStep?: number;
  onComplete?: () => void;
}

/**
 * EnhancedVisualization Component
 * A refactored and modular version of EnhancedStepByStepVisualization
 */
export const EnhancedVisualization: React.FC<EnhancedVisualizationProps> = ({
  steps = [],
  dataSourceType = 'unknown',
  insights = [],
  summary = '',
  visualizationData = null,
  visualizationsData = [],
  autoPlay = false,
  initialStep = 0,
  onComplete
}) => {
  // State for managing visualizations
  const [currentVizIndex, setCurrentVizIndex] = useState(initialStep || 0);
  const [addingToDashboard, setAddingToDashboard] = useState<string | null>(null);
  const [showDataTable, setShowDataTable] = useState(false);
  const [generatedInsights, setGeneratedInsights] = useState<string[]>([]);
  const [generatedSummary, setGeneratedSummary] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // Call onComplete when appropriate (mimic EnhancedStepByStepVisualization behavior)
  useEffect(() => {
    // Simple implementation to call onComplete when visualization is ready
    if (onComplete && (visualizationData || visualizationsData.length > 0 || steps.length > 0)) {
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [onComplete, visualizationData, visualizationsData, steps]);
  
  // Handle auto-play functionality for multiple visualizations
  useEffect(() => {
    // Only auto-play if explicitly enabled and we have multiple visualizations
    if (autoPlay && visualizationsData && visualizationsData.length > 1) {
      // Create an interval to cycle through visualizations
      const intervalId = setInterval(() => {
        setCurrentVizIndex(prev => (prev + 1) % visualizationsData.length);
      }, 3000); // Change visualization every 3 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [autoPlay, visualizationsData]);

  // Normalize data source type for specialized handling
  const normalizedDataSourceType = useMemo(() => {
    if (!dataSourceType) return 'unknown';
    
    // Map data source types to standardized format
    const sourceTypeMap: Record<string, string> = {
      'pdf': 'pdf',
      'excel': 'spreadsheet',
      'csv': 'spreadsheet',
      'doc': 'document',
      'docx': 'document',
      'database': 'database',
      'table': 'database',
      'sql': 'database',
      'api': 'api',
      'rest': 'api',
      'qdrant': 'qdrant',
      'vector_db': 'qdrant',
      'vector-db': 'qdrant',
      'vectordb': 'qdrant'
    };
    
    const normalizedType = dataSourceType.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return sourceTypeMap[normalizedType] || normalizedType || 'unknown';
  }, [dataSourceType]);

  // Process visualizationData if provided
  useEffect(() => {
    if (visualizationData && 
        visualizationData.data && 
        Array.isArray(visualizationData.data) && 
        visualizationData.data.length > 0) {
      console.log('Processing visualization data:', {
        type: visualizationData.type,
        dataPoints: visualizationData.data.length
      });
      
      // Generate insights and summary if not provided
      if (insights.length === 0) {
        const dataInsights = generateInsightsFromData(
          visualizationData.data, 
          visualizationData.type,
          visualizationData.xKey,
          visualizationData.yKey
        );
        const domainInsights = generateDomainSpecificInsights(
          visualizationData.data,
          normalizedDataSourceType
        );
        setGeneratedInsights([...dataInsights, ...domainInsights]);
      }
      
      if (!summary) {
        setGeneratedSummary(generateSummaryFromData(visualizationData.data));
      }
      
      // Generate recommendations based on chart type
      setRecommendations(generateRecommendations(visualizationData.type));
    }
  }, [visualizationData, insights, summary, normalizedDataSourceType]);
  
  // Process visualizationsData if provided
  useEffect(() => {
    if (visualizationsData && 
        visualizationsData.length > 0 && 
        visualizationsData.every(viz => viz.data && Array.isArray(viz.data) && viz.data.length > 0)) {
      console.log('Processing multiple visualizations:', {
        count: visualizationsData.length,
        types: visualizationsData.map(v => v.type).join(', ')
      });
      
      // Generate insights for the first visualization if none provided
      if (insights.length === 0 && visualizationsData[0]?.data) {
        const dataInsights = generateInsightsFromData(
          visualizationsData[0].data, 
          visualizationsData[0].type,
          visualizationsData[0].xKey,
          visualizationsData[0].yKey
        );
        const domainInsights = generateDomainSpecificInsights(
          visualizationsData[0].data,
          normalizedDataSourceType
        );
        setGeneratedInsights([...dataInsights, ...domainInsights]);
      }
      
      // Generate recommendations based on chart type of current viz
      const activeViz = visualizationsData[currentVizIndex];
      if (activeViz?.type) {
        setRecommendations(generateRecommendations(activeViz.type));
      }
    }
  }, [visualizationsData, insights, currentVizIndex, normalizedDataSourceType]);

  // Render visualization function
  function renderVisualization(vizConfig: any, height = 400) {
    if (!vizConfig) return null;
    
    return (
      <VisualizationRenderer 
        visualizationConfig={vizConfig}
        height={height}
        showControls={true}
        onAddToDashboard={() => {
          const id = vizConfig.id || `viz-${Date.now()}`;
          setAddingToDashboard(id);
          // Dashboard logic would go here
          setTimeout(() => setAddingToDashboard(null), 1000);
        }}
      />
    );
  }

  // Helper to get the active visualization
  const activeVisualization = useMemo(() => {
    if (visualizationsData && visualizationsData.length > 0) {
      return visualizationsData[currentVizIndex];
    }
    
    if (visualizationData) {
      return visualizationData;
    }
    
    return null;
  }, [visualizationData, visualizationsData, currentVizIndex]);

  // Combine provided insights with generated ones
  const displayInsights = useMemo(() => {
    return insights.length > 0 ? insights : generatedInsights;
  }, [insights, generatedInsights]);

  // Use provided or generated summary
  const displaySummary = useMemo(() => {
    return summary || generatedSummary;
  }, [summary, generatedSummary]);

  return (
    <div className="enhanced-visualization">
      {/* Summary section */}
      {displaySummary && (
        <div className="summary-section mb-6">
          <h3 className="text-lg font-semibold mb-3">Summary</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <MessageMarkdown content={displaySummary} />
          </div>
        </div>
      )}
      
      {/* Insights section */}
      {displayInsights && displayInsights.length > 0 && (
        <div className="insights-section mb-6">
          <h3 className="text-lg font-semibold mb-3">Key Insights</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <ul className="space-y-2">
              {displayInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* Visualization section */}
      {activeVisualization && (
        <div className="visualization-section mb-6">
          <h3 className="text-lg font-semibold mb-3 flex justify-between items-center">
            <span>Visualization</span>
            {visualizationsData && visualizationsData.length > 1 && (
              <div className="flex space-x-2">
                <button 
                  onClick={() => setCurrentVizIndex(prev => 
                    (prev - 1 + visualizationsData.length) % visualizationsData.length
                  )}
                  className="p-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"
                  aria-label="Previous visualization"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-500">
                  {currentVizIndex + 1} of {visualizationsData.length}
                </span>
                <button 
                  onClick={() => setCurrentVizIndex(prev => 
                    (prev + 1) % visualizationsData.length
                  )}
                  className="p-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"
                  aria-label="Next visualization"
                >
                  Next →
                </button>
              </div>
            )}
          </h3>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            {/* Title and description */}
            {activeVisualization && typeof activeVisualization.title === 'string' && activeVisualization.title && (
              <h4 className="text-base font-medium mb-2">{activeVisualization.title}</h4>
            )}
            {/* Check if it's from visualizationsData which has description property */}
            {activeVisualization && 
              (activeVisualization as {description?: string}) && 
              typeof (activeVisualization as {description?: string}).description === 'string' && 
              (activeVisualization as {description?: string}).description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {(activeVisualization as {description?: string}).description}
              </p>
            )}
            
            {/* Render the visualization */}
            <div className="mb-4">
              {renderVisualization(activeVisualization)}
            </div>
            
            {/* Adding to dashboard indicator */}
            {addingToDashboard && (
              <div className="text-center py-2 text-sm text-green-600">
                Adding visualization to dashboard...
              </div>
            )}
            
            {/* Data table toggle */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowDataTable(!showDataTable)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 flex items-center"
              >
                {showDataTable ? 'Hide Data Table' : 'Show Data Table'}
              </button>
              
              {showDataTable && activeVisualization.data && (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead>
                      <tr>
                        {Object.keys(activeVisualization.data[0]).map(key => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-gray-500">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {activeVisualization.data.slice(0, 5).map((item, index) => (
                        <tr key={index}>
                          {Object.keys(activeVisualization.data[0]).map(key => (
                            <td key={`${index}-${key}`} className="px-3 py-2 whitespace-nowrap">
                              {typeof item[key] === 'number' ? item[key].toLocaleString() : String(item[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activeVisualization.data.length > 5 && (
                    <div className="text-center py-2 text-xs text-gray-500">
                      Showing 5 of {activeVisualization.data.length} rows
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Recommendations section */}
      {recommendations.length > 0 && (
        <div className="recommendations-section mb-6">
          <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <ul className="space-y-2">
              {recommendations.map((recommendation, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* Steps section */}
      {steps && steps.length > 0 && (
        <div className="steps-section">
          <h3 className="text-lg font-semibold mb-3">Analysis Steps</h3>
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h4 className="text-base font-medium mb-2">{step.description}</h4>
                {step.content && <MessageMarkdown content={step.content} />}
                
                {/* Generate and display metrics for the step if available */}
                {step.data && Array.isArray(step.data) && step.data.length > 0 && !step.metrics && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {generateMetricsFromData(step.data).map((metric, idx) => (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <div className="text-xs text-gray-500">{metric.label}</div>
                        <div className="text-lg font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Display existing metrics if available */}
                {step.metrics && step.metrics.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {step.metrics.map((metric, idx) => (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <div className="text-xs text-gray-500">{metric.label}</div>
                        <div className="text-lg font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {step.visualization && (
                  <div className="mt-4">
                    {renderVisualization(step.visualization)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 