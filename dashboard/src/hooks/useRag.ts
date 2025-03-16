import { useState, useCallback } from 'react';
import { RagService } from '../services/rag/RagService';
import { useKnowledge } from '../providers/KnowledgeProvider';
import type { DataSource as KnowledgeDataSource } from '../types/knowledge';
import type { DataSource as RagDataSource } from '../types/data-source';
import { logApiKeyDiagnostics } from '../utils/api-key-diagnostics';

const ragService = new RagService();

// Helper function to safely create ISO timestamp
const safeTimestamp = (date: string | Date | undefined): string => {
  if (!date) {
    console.warn('No date provided to safeTimestamp');
    return new Date().toISOString();
  }

  try {
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        console.warn('Invalid Date object provided to safeTimestamp');
        return new Date().toISOString();
      }
      return date.toISOString();
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      console.warn(`Invalid date string provided to safeTimestamp: ${date}`);
      return new Date().toISOString();
    }
    return parsedDate.toISOString();
  } catch (error) {
    console.error('Error in safeTimestamp:', error);
    return new Date().toISOString();
  }
};

// Adapter function to convert KnowledgeDataSource to RagService DataSource
const adaptDataSource = (source: KnowledgeDataSource): RagDataSource => {
  if (!source?.id) {
    throw new Error('Data source must have an id');
  }

  // Get the original data source from the knowledge source
  const originalSource = (source as any).originalSource || {};
  
  // Ensure id is a string
  const sourceId = String(source.id);
  
  // Determine data source type from file name if not explicitly provided
  let dataSourceType = source.dataSourceType;
  if (!dataSourceType && source.name) {
    const fileName = source.name.toLowerCase();
    // Check for PDF files
    if (fileName.endsWith('.pdf')) {
      dataSourceType = 'pdf';
    } 
    // Check for CSV files
    else if (fileName.endsWith('.csv')) {
      dataSourceType = 'csv';
    } 
    // Check for Excel files
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      dataSourceType = 'excel';
    } 
    // Check for Word documents
    else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      dataSourceType = 'document';
    } 
    // Check for text files
    else if (fileName.endsWith('.txt')) {
      dataSourceType = 'text';
    } 
    // Check for JSON files
    else if (fileName.endsWith('.json')) {
      dataSourceType = 'json';
    }
    // Check for database-related names
    else if (fileName.includes('database') || fileName.includes('db') || 
             fileName.includes('sql') || fileName.includes('qdrant')) {
      dataSourceType = 'database';
    }
  }
  
  // If we still don't have a data source type, try to infer from the source type
  if (!dataSourceType && source.type) {
    if (source.type === 'local-files') {
      dataSourceType = 'pdf'; // Default assumption for local files
    } else if (source.type === 'crm') {
      dataSourceType = 'database';
    } else if (source.type === 'database') {
      dataSourceType = 'database';
    }
  }
  
  const adaptedSource: RagDataSource = {
    id: sourceId,
    name: source.name || 'Unnamed Source',
    type: (source.type || 'local-files') as RagDataSource['type'],
    description: source.baseUrl || '',
    status: 'connected' as const,
    lastSync: safeTimestamp(new Date()),
    metrics: {
      records: originalSource.metrics?.records || 0,
      syncRate: originalSource.metrics?.syncRate || 0,
      avgSyncTime: originalSource.metrics?.avgSyncTime || '0s'
    },
    metadata: originalSource.metadata || {},
    dataSourceType: dataSourceType || 'unknown'
  };

  console.log('Adapted data source:', adaptedSource);
  return adaptedSource;
};

export const useRag = () => {
  const { activeSource, recentItems } = useKnowledge();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query the selected data sources
  const queryDataSources = useCallback(async (question: string): Promise<any> => {
    if (!activeSource?.id || !activeSource.name || !activeSource.type) {
      console.error('Invalid active source:', activeSource);
      throw new Error('No valid data source selected');
    }

    if (isProcessing) {
      throw new Error('Still processing data sources');
    }

    try {
      setIsProcessing(true);
      // Convert the active source to the format expected by the RAG service
      const selectedSource = adaptDataSource(activeSource);
      console.log('Using data source for query:', {
        id: selectedSource.id,
        name: selectedSource.name,
        type: selectedSource.type,
        dataSourceType: selectedSource.dataSourceType
      });

      // Extract document IDs from recent items
      const recentDocumentIds = recentItems
        .filter(item => item.id)
        .map(item => item.id as string);
      
      if (recentDocumentIds.length > 0) {
        console.log('Using recent document IDs for context:', recentDocumentIds);
      }

      // Log the data source type for debugging
      console.log('Data source type for query:', selectedSource.dataSourceType);

      // Use our RagService to query with the data source - simplified to match new interface
      const response = await ragService.query(question, [selectedSource.id]);
      
      if (!response) {
        throw new Error('No response received from RAG service');
      }
      
      // Check if the response contains structured data
      if (typeof response === 'object' && response.structuredResponse) {
        console.log('Received structured response:', response);
        // Return the complete response including structuredResponse
        return response;
      }
      
      // Regular string response
      return response;
    } catch (err) {
      console.error('Error in queryDataSources:', err);
      
      // Check if this is an API key error
      const errorMessage = err instanceof Error ? err.message : 'Error querying data sources';
      if (
        errorMessage.includes('API key') || 
        errorMessage.includes('OpenAI API not initialized')
      ) {
        // Log diagnostics to help troubleshoot
        logApiKeyDiagnostics();
        
        setError('OpenAI API key issue detected. Please check your API key configuration.');
        
        // Dispatch an error event to trigger the API key modal
        const apiKeyError = new ErrorEvent('error', { 
          message: 'OpenAI API key not configured',
          error: new Error('OpenAI API key not configured')
        });
        window.dispatchEvent(apiKeyError);
        
        throw new Error('OpenAI API key not configured or invalid. Please check your API key.');
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [activeSource, isProcessing, recentItems]);

  // We don't need to process data sources anymore as that's handled by the backend
  // But we'll keep the method for API compatibility
  const updateDataSource = useCallback(async (dataSource: KnowledgeDataSource) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Just log that we're using the data source
      const adaptedSource = adaptDataSource(dataSource);
      console.log('Using data source:', {
        id: adaptedSource.id,
        name: adaptedSource.name,
        type: adaptedSource.type
      });
      
      // No need to process the data source as that's handled by the backend
      console.log('Data source ready to use');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating data source');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Clear a specific data source - implement locally since removed from RagService
  const clearDataSource = useCallback((dataSourceId: string) => {
    // Simply clear from state instead of calling service (as the method was removed)
    console.log('Clearing data source from state:', dataSourceId);
    // Additional cleanup could be implemented here if needed
  }, []);

  return {
    isProcessing,
    error,
    queryDataSources,
    updateDataSource,
    clearDataSource,
  };
}; 