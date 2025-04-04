declare module 'pdf-parse' {
  interface PDFParseOptions {
    pagerender?: (pageData: any) => string;
    max?: number;
  }

  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function parse(
    dataBuffer: Buffer | Uint8Array, 
    options?: PDFParseOptions
  ): Promise<PDFParseResult>;

  export default parse;
} 