/**
 * Type declarations for pdf-poppler module
 */
declare module 'pdf-poppler' {
  export interface ConvertOptions {
    format?: 'png' | 'jpeg' | 'tiff' | 'pdf' | 'svg' | 'ps';
    scale?: number;
    out_dir?: string;
    out_prefix?: string;
    page?: number | null;
    firstPage?: number;
    lastPage?: number;
    density?: number;
    quality?: number;
    grayscale?: boolean;
    cropBox?: boolean;
    cropHeight?: number;
    cropWidth?: number;
    cropX?: number;
    cropY?: number;
  }

  export function info(pdf_path: string): Promise<{
    pages: number;
    encrypted: boolean;
    pageSize: { width: number; height: number };
    file: string;
  }>;

  export function convert(pdf_path: string, options: ConvertOptions): Promise<string[]>;
} 