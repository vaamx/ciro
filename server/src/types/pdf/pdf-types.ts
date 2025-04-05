/**
 * Unified PDF processing and handling types
 */
import { ChunkMetadata } from '../utils/file-types';

// Re-export from PDF libraries
import { PDFExtractResult, PDFExtractPage, PDFExtractContent, PDFExtractOptions } from 'pdf.js-extract';

// Define types for pdfjs-dist without requiring the module at build time
export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  getMetadata(): Promise<any>;
  destroy(): Promise<void>;
}

export interface PDFPageProxy {
  getViewport(scale: { scale: number }): PDFViewportParams;
  getTextContent(): Promise<PDFTextContent>;
  render(renderParams: PDFRenderParams): PDFRenderTask;
}

export interface PDFTextContent {
  items: PDFTextItem[];
  styles: Record<string, any>;
}

export interface PDFTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
  fontName?: string;
}

// Define types for PDF viewport without DOM dependency
export interface PDFViewportParams {
  width: number;
  height: number;
  rotation: number;
  scale: number;
}

export interface PDFRenderParams {
  viewport: PDFViewportParams;
  canvasContext: any; // Use any to avoid DOM dependency
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

// PDF Chunking types
export interface PDFChunk {
  content: string;
  metadata: PDFChunkMetadata;
}

export interface PDFChunkMetadata extends ChunkMetadata {
  pageNumber: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  font?: string;
  fontSize?: number;
  isHeading?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  sectionTitle?: string;
  paragraphIndex?: number;
}

// PDF Document Information
export interface PDFDocumentInfo {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  version?: string;
  pageCount: number;
  isEncrypted: boolean;
  isFormFillable?: boolean;
  isTagged?: boolean;
  hasOutline?: boolean;
}

// Parsing options
export interface PDFParsingOptions {
  useOCR?: boolean;
  extractStructure?: boolean;
  extractImages?: boolean;
  extractAnnotations?: boolean;
  extractForms?: boolean;
  extractTables?: boolean;
  ocrLanguage?: string;
  ocrResolution?: number;
  preserveFormatting?: boolean;
}

// Type definitions for PDF libraries (these would typically go in separate .d.ts files)
export interface PDFDocumentLoadingTask {
  promise: Promise<PDFDocumentProxy>;
  destroy(): Promise<void>;
}

export interface PDFParseResult {
  numpages: number;
  numrender: number;
  info: any;
  metadata: any;
  text: string;
  version: string;
}

export interface PDFParseOptions {
  pagerender?: (pageData: any) => string;
  max?: number;
} 