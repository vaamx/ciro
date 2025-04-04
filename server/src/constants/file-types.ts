/**
 * Enum representing the types of files that can be processed
 */
export enum FileType {
  CSV = 'csv',
  TSV = 'csv', // TSV files are handled as CSV
  EXCEL = 'excel',
  PDF = 'pdf',
  WORD = 'word',
  TEXT = 'text',
  MARKDOWN = 'markdown',
  JSON = 'json',
  HTML = 'html',
  IMAGE = 'image',
  UNKNOWN = 'unknown'
} 