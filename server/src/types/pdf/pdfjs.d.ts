declare module 'pdfjs-dist/build/pdf.js' {
  export * from 'pdfjs-dist';
}

declare module 'pdfjs-dist/build/pdf.worker.js' {
  export class PDFWorker {
    constructor();
  }
}

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
    getViewport(options: { scale: number; rotation?: number }): PDFViewport;
    render(options: { canvasContext: any; viewport: PDFViewport }): PDFRenderTask;
    cleanup(): void;
  }
  
  export interface PDFViewport {
    width: number;
    height: number;
    rotation: number;
    scale: number;
  }
  
  export interface PDFRenderTask {
    promise: Promise<void>;
    cancel(): void;
  }
  
  export interface TextContent {
    items: Array<TextItem>;
    styles?: Record<string, any>;
  }
  
  export interface TextItem {
    str: string;
    transform: number[];
    width: number;
    height: number;
    dir: string;
    fontName?: string;
  }
} 