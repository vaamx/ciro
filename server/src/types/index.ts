/**
 * Type definitions index file
 * Re-exports all types from organized type directories
 */

// References to declaration files
/// <reference path="./declarations/exceljs.d.ts" />
/// <reference path="./declarations/global.d.ts" />
/// <reference path="./declarations/mammoth.d.ts" />
/// <reference path="./declarations/mime-types.d.ts" />
/// <reference path="./declarations/openai.d.ts" />
/// <reference path="./declarations/sharp.d.ts" />
/// <reference path="./declarations/tesseract.d.ts" />
/// <reference path="./declarations/uuid.d.ts" />
/// <reference path="./pdf/pdf-js-extract.d.ts" />
/// <reference path="./pdf/pdf-parse.d.ts" />
/// <reference path="./pdf/pdfjs.d.ts" />

// Module declarations for external libraries without types
// Note: These are now referenced from the .d.ts files above
// and don't need separate declarations here

// PDF related types
export * from './pdf/pdf-types';

// Document processing types - export with selective re-exports to avoid ambiguity
export {
  ProcessingState,
  DocumentProcessingJob,
  ProcessingEvent,
  ProcessingEventType,
  ProcessingErrorType,
  RetryStrategy
} from './document/document-processing';

export {
  ProcessingStatus,
  ProcessingPhase,
  ProcessingOptions,
  AnalyticalOperationType,
  VisualizationType
} from './document/processing';

// Special handling for conflicting types
export { DataSourceType as DocumentDataSourceType } from './document/processing';

// Express and API types
export { 
  Request, 
  Response, 
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
  Router,
  Application
} from './express/express-types';

// Utility types (config, file, data source)
export * from './utils/config';
export * from './utils/data-source';
export * from './utils/file-types';
export * from './utils/file';
export * from './utils/user';

// Export default express
export { default as express } from './express/express-types'; 