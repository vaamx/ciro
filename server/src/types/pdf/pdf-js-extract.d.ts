declare module 'pdf.js-extract' {
  export interface PDFExtractOptions {
    firstPage?: number;
    lastPage?: number;
    password?: string;
    verbosity?: number;
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }

  export interface PDFExtractPage {
    pageInfo: {
      num: number;
      scale: number;
      rotation: number;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
    };
    content: PDFExtractContent[];
  }

  export interface PDFExtractContent {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fontName?: string;
  }

  export interface PDFExtractResult {
    pages: PDFExtractPage[];
    meta?: Record<string, any>;
  }

  export class PDFExtract {
    extract(filePath: string, options?: PDFExtractOptions): Promise<PDFExtractResult>;
  }
} 