import { FileType, MIME_TYPE_MAP } from '../types/file-types';
import { BadRequestError } from './errors';
import * as path from 'path';
import * as fs from 'fs';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [FileUtils]: ${message}`;
      return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [FileUtils]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

/**
 * Detects file type based on mime type and filename
 * @param mimeType The MIME type of the file
 * @param filename The original filename
 * @returns FileType as a string
 */
export function detectFileType(mimeType: string, filename: string): FileType {
    logger.debug(`Detecting file type for: ${filename}, MIME: ${mimeType}`);
    
    // Check extensions first (more reliable in some cases)
    if (filename) {
        const lowerFilename = filename.toLowerCase();
        
        // Excel files
        if (lowerFilename.endsWith('.xlsx') || lowerFilename.endsWith('.xls') || 
            lowerFilename.endsWith('.xlsm') || lowerFilename.endsWith('.ods')) {
            logger.debug(`Detected Excel file by extension: ${lowerFilename}`);
            return 'excel';
        }
        
        // PDF files
        if (lowerFilename.endsWith('.pdf')) {
            return 'pdf';
        }
        
        // Word documents
        if (lowerFilename.endsWith('.docx') || lowerFilename.endsWith('.doc')) {
            return 'docx';
        }
        
        // Markdown
        if (lowerFilename.endsWith('.md') || lowerFilename.endsWith('.markdown')) {
            return 'markdown';
        }
        
        // CSV files
        if (lowerFilename.endsWith('.csv')) {
            return 'csv';
        }
        
        // Text files
        if (lowerFilename.endsWith('.txt')) {
            return 'text';
        }
    }
    
    // Then check MIME types
    if (mimeType) {
        const lowerMimeType = mimeType.toLowerCase();
        
        // Use the MIME_TYPE_MAP if available
        if (MIME_TYPE_MAP[lowerMimeType]) {
            logger.debug(`Detected file type from MIME_TYPE_MAP: ${MIME_TYPE_MAP[lowerMimeType]}`);
            return MIME_TYPE_MAP[lowerMimeType];
        }
        
        // Excel files
        if (lowerMimeType.includes('excel') || 
            lowerMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            lowerMimeType === 'application/vnd.ms-excel' ||
            lowerMimeType === 'application/vnd.oasis.opendocument.spreadsheet') {
            logger.debug(`Detected Excel file by MIME type: ${lowerMimeType}`);
            return 'excel';
        }
        
        // PDF files
        if (lowerMimeType.includes('pdf')) {
            return 'pdf';
        }
        
        // Word documents
        if (lowerMimeType.includes('word') || 
            lowerMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            lowerMimeType === 'application/msword') {
            return 'docx';
        }
        
        // Plain text
        if (lowerMimeType.includes('text/plain')) {
            return 'text';
        }
        
        // CSV files
        if (lowerMimeType.includes('text/csv')) {
            return 'csv';
        }
        
        // Markdown (not a standard MIME type, but sometimes used)
        if (lowerMimeType.includes('text/markdown')) {
            return 'markdown';
        }
    }
    
    // Default to text if we can't determine the type
    logger.debug(`Could not determine file type, defaulting to 'text'`);
    return 'text';
}

/**
 * Checks if a buffer contains a PDF file signature
 * @param buffer The buffer to check
 * @returns true if the buffer contains a PDF signature
 */
export function isPdfFile(buffer: Buffer): boolean {
    // PDF files start with %PDF-
    if (buffer.length < 5) return false;
    
    // Check for PDF signature
    return buffer[0] === 0x25 && // %
           buffer[1] === 0x50 && // P
           buffer[2] === 0x44 && // D
           buffer[3] === 0x46 && // F
           buffer[4] === 0x2D;   // -
}

export function validateFileType(mimeType: string, fileName?: string): void {
  try {
    detectFileType(mimeType, fileName || '');
  } catch (error) {
    throw new BadRequestError(`Unsupported file type: ${mimeType}${fileName ? ` for file ${fileName}` : ''}`);
  }
}

/**
 * Get file extension without the dot
 * @param fileName File name or path
 * @returns File extension without the dot
 */
export function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase().replace(/^\./, '');
}

export function getMimeTypeFromExtension(extension: string): string | undefined {
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'json': 'application/json',
    'csv': 'text/csv',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'html': 'text/html',
    'htm': 'text/html',
    'xml': 'application/xml',
    'zip': 'application/zip',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint'
  };

  // Handle extension with or without the dot
  const normalizedExtension = extension.toLowerCase().replace(/^\./, '');
  return mimeTypes[normalizedExtension];
}

/**
 * Get the correct MIME type for a file based on its extension
 * @param fileName File name or path
 * @returns The MIME type for the file
 */
export function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsm':
      return 'application/vnd.ms-excel.sheet.macroEnabled.12';
    case '.ods':
      return 'application/vnd.oasis.opendocument.spreadsheet';
    case '.csv':
      return 'text/csv';
    case '.txt':
      return 'text/plain';
    case '.md':
      return 'text/markdown';
    case '.json':
      return 'application/json';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.xml':
      return 'application/xml';
    case '.zip':
      return 'application/zip';
    default:
      // If we can't determine the content type, try to get it from the extension
      const mimeType = getMimeTypeFromExtension(ext.replace(/^\./, ''));
      return mimeType || 'application/octet-stream';
  }
}

/**
 * Get the file type enum value based on file extension and/or MIME type
 * @param fileName File name or extension
 * @param mimeType Optional MIME type to help determine file type
 * @returns The FileType enum value
 */
export function getFileType(fileName: string, mimeType?: string): FileType {
  // Get extension from filename
  let ext = path.extname(fileName).toLowerCase();
  
  // If fileName is just an extension (like '.docx' or 'docx'), handle that case
  if (!ext && fileName.startsWith('.')) {
    ext = fileName;
  } else if (!ext) {
    // If fileName doesn't have an extension but might be an extension itself (like 'docx')
    const possibleExts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.ods', '.csv', '.json', '.txt', '.md'];
    for (const possibleExt of possibleExts) {
      if (possibleExt.endsWith(fileName.toLowerCase())) {
        ext = possibleExt;
        break;
      }
    }
  }
  
  logger.debug(`getFileType: fileName=${fileName}, ext=${ext}, mimeType=${mimeType || 'none'}`);
  
  // Try to determine by extension first
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
    case '.doc':
      return 'docx';
    case '.xlsx':
    case '.xls':
    case '.ods':
      return 'excel';
    case '.csv':
      return 'csv';
    case '.json':
      return 'json';
    case '.txt':
    case '.md':
      return 'text';
  }
  
  // If extension didn't match, try MIME type
  if (mimeType) {
    // Check MIME_TYPE_MAP first
    const lowerMimeType = mimeType.toLowerCase();
    if (MIME_TYPE_MAP[lowerMimeType]) {
      return MIME_TYPE_MAP[lowerMimeType];
    }
    
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('spreadsheet') || mimeType.includes('xlsx') || mimeType.includes('xls') || mimeType.includes('excel')) return 'excel';
    if (mimeType.includes('document') || mimeType.includes('docx') || mimeType.includes('doc')) return 'docx';
    if (mimeType.includes('csv')) return 'csv';
    if (mimeType.includes('json')) return 'json';
    if (mimeType.includes('text')) return 'text';
  }
  
  // If we still can't determine the type, default to text for text-based MIME types
  if (mimeType && mimeType.startsWith('text/')) {
    return 'text';
  }
  
  // If we get here, we don't know what type of file this is
  throw new Error(`Unsupported file type: ${ext}, MIME: ${mimeType || 'unknown'}`);
}

/**
 * Check if a file exists and is accessible
 * @param filePath Path to the file
 * @returns True if the file exists and is accessible, false otherwise
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Get file size in bytes
 * @param filePath Path to the file
 * @returns File size in bytes, or -1 if the file doesn't exist
 */
export function getFileSize(filePath: string): number {
  try {
    if (fileExists(filePath)) {
      return fs.statSync(filePath).size;
    }
    return -1;
  } catch (error) {
    return -1;
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param directoryPath The directory path to ensure exists
 */
export function ensureDirectoryExists(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) {
    logger.info(`Creating directory: ${directoryPath}`);
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

/**
 * Generate a unique filename based on original name
 * @param originalName The original file name
 * @returns A unique filename
 */
export function generateUniqueFilename(originalName: string): string {
  const parsed = path.parse(originalName);
  const sanitizedName = parsed.name.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  return `${sanitizedName}_${timestamp}${parsed.ext}`;
}

/**
 * Determine file type based on extension
 * @param filename File name or path
 * @returns File type string
 */
export function determineFileType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  
  // CSV files
  if (extension === '.csv') {
    return 'csv';
  }
  
  // Excel files
  if (['.xlsx', '.xls', '.xlsm', '.ods'].includes(extension)) {
    return 'excel';
  }
  
  // PDF files
  if (extension === '.pdf') {
    return 'pdf';
  }
  
  // Word documents
  if (['.docx', '.doc'].includes(extension)) {
    return 'docx';
  }
  
  // Plain text
  if (extension === '.txt') {
    return 'text';
  }
  
  // JSON files
  if (extension === '.json') {
    return 'json';
  }
  
  // Markdown files
  if (['.md', '.markdown'].includes(extension)) {
    return 'markdown';
  }
  
  // HTML files
  if (['.html', '.htm'].includes(extension)) {
    return 'html';
  }
  
  // XML files
  if (extension === '.xml') {
    return 'xml';
  }
  
  // Default to unknown
  return 'unknown';
}

/**
 * Get absolute path from relative path
 * @param relativePath Relative path from project root
 * @returns Absolute path
 */
export function getAbsolutePath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

/**
 * Write buffer to file, ensuring parent directory exists
 * @param filePath Path to write file to
 * @param data Buffer data to write
 */
export async function writeBufferToFile(filePath: string, data: Buffer): Promise<void> {
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    ensureDirectoryExists(parentDir);
    
    // Write file
    await fs.promises.writeFile(filePath, data);
    logger.info(`File written to: ${filePath}`);
  } catch (error) {
    logger.error(`Error writing file: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Read a file as buffer
 * @param filePath Path to read file from
 * @returns File buffer
 */
export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  try {
    return await fs.promises.readFile(filePath);
  } catch (error) {
    logger.error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Delete a file if it exists
 * @param filePath Path to file to delete
 * @returns True if file was deleted, false if it didn't exist
 */
export async function deleteFileIfExists(filePath: string): Promise<boolean> {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info(`File deleted: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error deleting file: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
} 