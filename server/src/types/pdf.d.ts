declare module 'pdfjs-dist/build/pdf.js' {
  export * from 'pdfjs-dist';
}

declare module 'pdfjs-dist/build/pdf.worker.js' {
  export class PDFWorker {
    constructor();
  }
}

// Add explicit declaration for PDF.js types
declare module 'pdfjs-dist' {
  export const version: string;
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
  export function getDocument(options: any): PDFDocumentLoadingTask;
  
  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
    destroy(): Promise<void>;
  }
  
  export interface PDFDocumentProxy {
    numPages: number;
    getMetadata(): Promise<{ info: any; metadata: any }>;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    cleanup(): Promise<void>;
    _pdfInfo?: {
      version?: string;
    };
  }
  
  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
    cleanup(): void;
  }
  
  export interface TextContent {
    items: Array<TextItem>;
  }
  
  export interface TextItem {
    str?: string;
    [key: string]: any;
  }
} 