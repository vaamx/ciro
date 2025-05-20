import React, { useState, useEffect } from 'react';
import { MessageMarkdown } from '../MessageMarkdown';
import { EnhancedVisualization } from './EnhancedVisualization';

/**
 * Interface for message from OpenAI Responses API
 */
interface OpenAIResponsesData {
  isResponsesAPI?: boolean;
  steps?: any[];
  visualizations?: any[];
  insights?: string[];
  recommendations?: string[];
  metadata?: {
    processingTime?: number;
    dataSourceIds?: string[];
    dataSourceType?: string;
  };
}

/**
 * Generic chat message interface
 */
interface ChatMessage {
  id?: string;
  content: string | any;
  status?: 'loading' | 'complete' | 'error';
  metadata?: any;
}

/**
 * Props for ModernVisualizationAdapter
 */
interface ModernVisualizationAdapterProps {
  message: ChatMessage;
}

/**
 * Modern visualization adapter component that supports:
 * - OpenAI Responses API formatted messages
 * - Traditional RAG responses
 * - Regular chat messages
 */
export const ModernVisualizationAdapter: React.FC<ModernVisualizationAdapterProps> = ({ 
  message 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [steps, setSteps] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [visualizationData, setVisualizationData] = useState<any>(null);
  const [visualizationsData, setVisualizationsData] = useState<any[]>([]);
  const [dataSourceType, setDataSourceType] = useState<string>('unknown');
  
  // Process the message data
  useEffect(() => {
    // Skip processing if no message or message is loading
    if (!message || message.status === 'loading') {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Detect content and metadata
      const content = typeof message.content === 'string' ? message.content : '';
      const metadata = message.metadata || {};
      
      // Check if we have OpenAI Responses API data
      if (metadata.isResponsesAPI) {
        // Handle Responses API format
        const responsesData = metadata as OpenAIResponsesData;
        
        // Set basic message data
        setSummary(content);
        setSteps(responsesData.steps || []);
        setInsights(responsesData.insights || []);
        setDataSourceType(responsesData.metadata?.dataSourceType || 'unknown');
        
        // Set visualization data
        if (responsesData.visualizations && responsesData.visualizations.length > 0) {
          setVisualizationData(responsesData.visualizations[0]);
          setVisualizationsData(responsesData.visualizations);
        }
      } 
      // Process legacy RAG response
      else {
        setSummary(content);
        
        // Extract structured data
        setDataSourceType(metadata.dataSourceType || 'unknown');
        setSteps(metadata.steps || []);
        setInsights(metadata.insights || []);
        
        // Set visualization data
        if (metadata.visualizationData) {
          setVisualizationData(metadata.visualizationData);
        } else if (metadata.structuredResponse?.visualization) {
          setVisualizationData(metadata.structuredResponse.visualization);
        }
        
        // Set multiple visualizations if available
        if (metadata.visualizations && Array.isArray(metadata.visualizations)) {
          setVisualizationsData(metadata.visualizations);
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Error processing visualization data:', err);
      setError(`Failed to process visualization: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [message]);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="animate-pulse py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2.5"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2.5"></div>
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2.5"></div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-lg">
        <p className="font-medium">Error rendering visualization</p>
        <p className="text-sm">{error}</p>
        <div className="mt-4">
          <MessageMarkdown content={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)} />
        </div>
      </div>
    );
  }
  
  // Extract insights from steps if available
  const allInsights = [
    ...insights,
    ...steps
      .filter(step => step.insights && step.insights.length > 0)
      .flatMap(step => step.insights || [])
  ];
  
  // If no visualization data but message has content, just render the content
  if (!visualizationData && !visualizationsData.length && message.content) {
    return (
      <div className="rag-response-container">
        <MessageMarkdown content={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)} />
      </div>
    );
  }
  
  // Render enhanced visualization
  return (
    <div className="rag-response-container">
      <EnhancedVisualization
        steps={steps}
        insights={allInsights}
        summary={summary}
        visualizationData={visualizationData}
        visualizationsData={visualizationsData}
        dataSourceType={dataSourceType}
      />
    </div>
  );
}; 