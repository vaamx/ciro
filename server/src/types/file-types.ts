export type FileType = 
  | 'text' 
  | 'markdown' 
  | 'pdf' 
  | 'docx' 
  | 'json' 
  | 'csv' 
  | 'html'
  | 'xml'
  | 'yaml'
  | 'code'
  | 'pptx'
  | 'xlsx'
  | 'excel';

export const MIME_TYPE_MAP: Record<string, FileType> = {
  // Text formats
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/html': 'html',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'text/yaml': 'yaml',
  'application/x-yaml': 'yaml',
  'text/csv': 'csv',
  
  // Document formats
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.oasis.opendocument.spreadsheet': 'excel',
  
  // Data formats
  'application/json': 'json',
  
  // Code formats
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/typescript': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  'text/x-c': 'code',
  'text/x-c++': 'code',
  'text/x-csharp': 'code'
};

export interface ChunkMetadata {
  pageNumber?: number;
  section?: string;
  style?: string;
  heading?: string;
  slideNumber?: number;
  slideTitle?: string;
  sheetName?: string;
  range?: string;
  headers?: string[];
  rowRange?: [number, number];
  page?: number;
  totalPages?: number;
  sourceId?: string;
  chunkIndex?: number;
  fileType?: string;
  error?: boolean;
  pdfVersion?: string;
  producer?: string;
  author?: string;
  title?: string;
  documentName?: string;
  documentType?: string;
  creationDate?: string;
  modificationDate?: string;
  totalRows?: number;
  totalSheets?: number;
  recordIndex?: number;
}

export interface DocumentChunk {
  content: string;
  metadata?: ChunkMetadata;
}

export interface ChunkingStrategy {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
  preserveStructure?: boolean;
  customTokenizer?: (text: string) => string[];
  metadataExtractors?: ((chunk: DocumentChunk) => Record<string, any>)[];
}

export const DEFAULT_CHUNKING_STRATEGIES: Record<FileType, ChunkingStrategy> = {
  text: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ']
  },
  markdown: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n## ', '\n### ', '\n\n', '\n']
  },
  html: {
    chunkSize: 2000,
    chunkOverlap: 400,
    separators: ['</div>', '</section>', '</p>', '\n'],
    preserveStructure: true,
    metadataExtractors: [
      // Extract HTML metadata
      (chunk: DocumentChunk) => {
        const titleMatch = chunk.content.match(/<title>(.+?)<\/title>/);
        const h1Match = chunk.content.match(/<h1[^>]*>(.+?)<\/h1>/);
        return {
          title: titleMatch ? titleMatch[1] : undefined,
          heading: h1Match ? h1Match[1] : undefined
        };
      }
    ]
  },
  code: {
    chunkSize: 800,
    chunkOverlap: 150,
    separators: ['\n\n', '\n', ';'],
    preserveStructure: true,
    metadataExtractors: [
      // Extract function and class definitions
      (chunk: DocumentChunk) => {
        const functionMatch = chunk.content.match(/(?:function|class)\s+(\w+)/);
        return functionMatch ? { 
          codeEntity: functionMatch[1],
          entityType: chunk.content.startsWith('class') ? 'class' : 'function'
        } : {};
      }
    ]
  },
  json: {
    chunkSize: 800,
    chunkOverlap: 100,
    separators: ['},', '}\n'],
    preserveStructure: true,
    customTokenizer: (text) => {
      // Custom JSON tokenizer that preserves object structure
      try {
        const parsed = JSON.parse(text);
        return JSON.stringify(parsed, null, 2).split('\n');
      } catch {
        return text.split('\n');
      }
    }
  },
  yaml: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n---\n', '\n\n'],
    preserveStructure: true
  },
  xml: {
    chunkSize: 1500,
    chunkOverlap: 300,
    separators: ['</record>', '</item>', '</entry>'],
    preserveStructure: true
  },
  pdf: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n'],
    metadataExtractors: [
      // Extract page numbers and sections
      (chunk: DocumentChunk) => ({
        pageNumber: chunk.metadata?.pageNumber,
        section: chunk.metadata?.section
      })
    ]
  },
  docx: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n'],
    metadataExtractors: [
      // Extract heading styles and formatting
      (chunk: DocumentChunk) => ({
        style: chunk.metadata?.style,
        heading: chunk.metadata?.heading
      })
    ]
  },
  pptx: {
    chunkSize: 800,
    chunkOverlap: 150,
    separators: ['\n---\n', '\n\n'],
    metadataExtractors: [
      // Extract slide information
      (chunk: DocumentChunk) => ({
        slideNumber: chunk.metadata?.slideNumber,
        slideTitle: chunk.metadata?.slideTitle
      })
    ]
  },
  xlsx: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n'],
    preserveStructure: true,
    metadataExtractors: [
      // Extract sheet and cell information
      (chunk: DocumentChunk) => ({
        sheetName: chunk.metadata?.sheetName,
        headers: chunk.metadata?.headers,
        rowRange: chunk.metadata?.rowRange,
        totalRows: chunk.metadata?.totalRows,
        totalSheets: chunk.metadata?.totalSheets,
        recordIndex: chunk.metadata?.recordIndex
      })
    ]
  },
  excel: {
    // Use the same strategy as xlsx
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n'],
    preserveStructure: true,
    metadataExtractors: [
      // Extract sheet and cell information
      (chunk: DocumentChunk) => ({
        sheetName: chunk.metadata?.sheetName,
        headers: chunk.metadata?.headers,
        rowRange: chunk.metadata?.rowRange,
        totalRows: chunk.metadata?.totalRows,
        totalSheets: chunk.metadata?.totalSheets,
        recordIndex: chunk.metadata?.recordIndex
      })
    ]
  },
  csv: {
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ['\n'],
    metadataExtractors: [
      // Extract column headers
      (chunk: DocumentChunk) => ({
        headers: chunk.metadata?.headers,
        rowRange: chunk.metadata?.rowRange
      })
    ]
  }
}; 