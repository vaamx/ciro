/**
 * Enumeration of supported file types
 */
export enum FileType {
  PDF = 'pdf',
  CSV = 'csv',
  TEXT = 'txt',
  DOCX = 'docx',
  XLSX = 'xlsx',
  JSON = 'json',
  UNKNOWN = 'unknown'
}

/**
 * Determines if a file is supported based on its extension
 */
export function isSupportedFileType(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return Object.values(FileType).includes(extension as FileType);
}

/**
 * Gets the file type from a filename
 */
export function getFileTypeFromFilename(filename: string): FileType {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return Object.values(FileType).includes(extension as FileType) 
    ? extension as FileType 
    : FileType.UNKNOWN;
} 