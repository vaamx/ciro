/**
 * Services index file
 * Re-exports all service modules
 */

// Core services
export * from './core';

// AI services
export * from './ai';

// Vector database services
export * from './vector';

// RAG services
export * from './rag';

// Data processing services (Removed as directory doesn't exist at this level)
// export * from './data-processing';

// Exclude VisualizationType from data-processing to avoid naming conflicts
// export * from './document-processors';

// Utility services
export { 
  ConversationService,
  FileUploadService,
  LocalFileService,
  TextSearchService,
  SocketService,
  EventManager
} from './util';

// Individual exports from metadata-extraction to avoid DataSourceType conflict
export { 
  EnhancedMetadataService, 
  EnhancedMetadata, 
  EnhancedMetadataOptions, 
  SourceData 
} from './shared/metadata/enhanced-metadata.service';

// Embedding services will be added later when implemented
// export * from './embedding';
