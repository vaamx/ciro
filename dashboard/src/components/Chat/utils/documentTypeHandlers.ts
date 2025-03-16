/**
 * Document Type Handlers - Simplified Version
 * 
 * A streamlined framework for detecting and processing different document types in chat messages.
 * This version prioritizes Qdrant/RAG responses and reduces complexity.
 */

import { ChatMessage } from '../types';

/**
 * Document type identifiers
 */
export enum DocumentType {
  UNKNOWN = 'unknown',
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  DOCX = 'docx',
  TEXT = 'text',
  QDRANT = 'qdrant'
}

/**
 * Response metadata interface
 */
export interface ResponseMetadata {
  content_type?: string;
  filename?: string;
  source_type?: string;
  document_id?: string;
  collectionName?: string;
  collectionId?: string;
  dataSourceType?: string;
  tableData?: any[];
  isQdrantResponse?: boolean;
  useEnhancedVisualization?: boolean;
  hasVisualization?: boolean;
  isSimpleWelcome?: boolean;
  isSimpleLoading?: boolean;
  suppressVisualization?: boolean;
  forceSimpleDisplay?: boolean;
  skipEnhancedVisualization?: boolean;
  isLoading?: boolean;
  [key: string]: any;
}

/**
 * Document type detection result
 */
export interface DocumentTypeResult {
  type: DocumentType;
  metadata: ResponseMetadata;
}

/**
 * Detects the document type from a message
 * Simplified implementation that prioritizes Qdrant responses
 */
export function detectDocumentType(message: ChatMessage): DocumentTypeResult {
  const content = typeof message.content === 'string' ? message.content : '';
  const metadata = message.metadata || {} as ResponseMetadata;
  
  // Check for any loading state
  if (message.status === 'loading') {
    return {
      type: DocumentType.UNKNOWN,
      metadata: {
        ...metadata,
        isSimpleLoading: true,
        isLoading: true,
        useEnhancedVisualization: false,
        hasVisualization: false,
        suppressVisualization: true,
        forceSimpleDisplay: true,
        skipEnhancedVisualization: true
      }
    };
  }
  
  // Check for simple loading message flag
  if (metadata.isSimpleLoading === true || metadata.isLoading === true) {
    return {
      type: DocumentType.UNKNOWN,
      metadata: {
        ...metadata,
        isSimpleLoading: true,
        isLoading: true,
        useEnhancedVisualization: false,
        hasVisualization: false,
        suppressVisualization: true,
        forceSimpleDisplay: true,
        skipEnhancedVisualization: true
      }
    };
  }
  
  // Check for simple welcome message flag
  if (metadata.isSimpleWelcome === true) {
    return {
      type: DocumentType.UNKNOWN,
      metadata: {
        ...metadata,
        isSimpleWelcome: true,
        useEnhancedVisualization: false,
        hasVisualization: false
      }
    };
  }
  
  // First, always check for explicit flags in metadata
  if (metadata.isQdrantResponse === true) {
    return { 
      type: DocumentType.QDRANT, 
      metadata: { 
        ...metadata, 
        dataSourceType: 'qdrant' 
      } 
    };
  }
  
  // Then check for other Qdrant indicators
  if (
    metadata.collectionName || 
    metadata.collectionId || 
    metadata.dataSourceType === 'qdrant' ||
    (Array.isArray(metadata.collectionNames) && metadata.collectionNames.length > 0) ||
    (Array.isArray(metadata.dataSourceIds) && metadata.dataSourceIds.length > 0)
  ) {
    return { 
      type: DocumentType.QDRANT, 
      metadata: { 
        ...metadata, 
        dataSourceType: 'qdrant',
        isQdrantResponse: true
      } 
    };
  }
  
  // Check for local-files type (often used for Qdrant)
  if (metadata.dataSourceType === 'local-files') {
    return { 
      type: DocumentType.QDRANT, 
      metadata: { 
        ...metadata, 
        dataSourceType: 'qdrant',
        isQdrantResponse: true
      } 
    };
  }
  
  // Check for indicators in content
  if (
    content.includes('knowledge base') ||
    content.includes('vector search') ||
    content.includes('document search') ||
    content.includes('search results') ||
    content.includes('I found the following information')
  ) {
    return { 
      type: DocumentType.QDRANT, 
      metadata: { 
        ...metadata, 
        dataSourceType: 'qdrant',
        isQdrantResponse: true
      } 
    };
  }
  
  // Check for document-specific types
  if (metadata.content_type || metadata.filename || metadata.source_type) {
    // Check for PDF files
    if (
      (metadata.content_type && metadata.content_type.includes('pdf')) ||
      (metadata.filename && metadata.filename.toLowerCase().endsWith('.pdf')) ||
      (metadata.source_type && metadata.source_type.toLowerCase().includes('pdf'))
    ) {
      return { type: DocumentType.PDF, metadata: { ...metadata, dataSourceType: 'pdf' } };
    }
    
    // Check for Excel files
    if (
      (metadata.content_type && metadata.content_type.includes('excel')) ||
      (metadata.filename && (metadata.filename.toLowerCase().endsWith('.xlsx') || metadata.filename.toLowerCase().endsWith('.xls'))) ||
      (metadata.source_type && metadata.source_type.toLowerCase().includes('excel'))
    ) {
      return { type: DocumentType.EXCEL, metadata: { ...metadata, dataSourceType: 'excel' } };
    }
    
    // Check for CSV files
    if (
      (metadata.content_type && metadata.content_type.includes('csv')) ||
      (metadata.filename && metadata.filename.toLowerCase().endsWith('.csv')) ||
      (metadata.source_type && metadata.source_type.toLowerCase().includes('csv'))
    ) {
      return { type: DocumentType.CSV, metadata: { ...metadata, dataSourceType: 'csv' } };
    }
    
    // Check for Word files
    if (
      (metadata.content_type && (metadata.content_type.includes('docx') || metadata.content_type.includes('word'))) ||
      (metadata.filename && (metadata.filename.toLowerCase().endsWith('.docx') || metadata.filename.toLowerCase().endsWith('.doc'))) ||
      (metadata.source_type && (metadata.source_type.toLowerCase().includes('docx') || metadata.source_type.toLowerCase().includes('word')))
    ) {
      return { type: DocumentType.DOCX, metadata: { ...metadata, dataSourceType: 'docx' } };
    }
  }
  
  // Default to Qdrant for unknown types
  return { 
    type: DocumentType.QDRANT, 
    metadata: { 
      ...metadata, 
      dataSourceType: 'qdrant',
      isQdrantResponse: true
    } 
  };
}

/**
 * Checks if a message needs visualization
 */
export function needsVisualization(message: ChatMessage): boolean {
  if (!message) return false;
  
  // Never visualize loading messages
  if (message.status === 'loading') {
    return false;
  }
  
  const { type, metadata } = detectDocumentType(message);
  
  // Never visualize simple welcome messages
  if (metadata.isSimpleWelcome === true) {
    return false;
  }
  
  // Never visualize loading messages
  if (metadata.isSimpleLoading === true || 
      metadata.isLoading === true || 
      metadata.suppressVisualization === true || 
      metadata.forceSimpleDisplay === true || 
      metadata.skipEnhancedVisualization === true) {
    return false;
  }
  
  // Always visualize Qdrant responses for consistent experience
  if (type === DocumentType.QDRANT) {
    return true;
  }
  
  // Check metadata flags
  if (
    metadata.useEnhancedVisualization === true ||
    metadata.hasVisualization === true ||
    metadata.visualizationData ||
    (metadata.steps && Array.isArray(metadata.steps) && metadata.steps.length > 0)
  ) {
    return true;
  }
  
  // Check for specific file types
  if (
    (type === DocumentType.EXCEL || type === DocumentType.CSV) &&
    (metadata.tableData || metadata.data)
  ) {
    return true;
  }
  
  // Check for structured data in content
  const content = typeof message.content === 'string' ? message.content : '';
  if (
    content.includes('```json') ||
    content.includes('| --- |') || // Markdown table
    content.match(/\d+\s*%/) // Percentage values
  ) {
    return true;
  }
  
  return false;
}

/**
 * Gets the appropriate rendering component based on document type
 */
export function getDocumentRenderer(message: ChatMessage): string {
  const { type } = detectDocumentType(message);
  
  // Always use visualization for Qdrant
  if (type === DocumentType.QDRANT || needsVisualization(message)) {
    return 'visualization';
  }
  
  // Otherwise fall back to document-specific renderers
  switch (type) {
    case DocumentType.PDF:
      return 'pdf';
    case DocumentType.EXCEL:
    case DocumentType.CSV:
      return 'table';
    case DocumentType.DOCX:
      return 'docx';
    default:
      return 'markdown';
  }
}

/**
 * Extracts content from a chat message
 */
export function extractDocumentContent(message: ChatMessage): string {
  if (!message) return '';
  
  // If the content is already a string, return it
  if (typeof message.content === 'string') {
    return message.content;
  }
  
  // Otherwise try to convert to string
  try {
    return JSON.stringify(message.content);
  } catch (e) {
    return 'Unable to extract content';
  }
} 