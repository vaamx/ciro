import axios from 'axios';
import { getAuthorizationHeader, getAuthToken } from '../utils/authToken';
import { LocalFileType } from '../components/DataSources/types';

// Define file metadata interface
export interface LocalFileMetadata {
  id: string;
  filename: string;
  fileType: LocalFileType;
  size: number;
  uploadedAt: Date;
  lastModified: Date;
  status: 'ready' | 'processing' | 'error';
  url?: string;
  processingMethod?: string;
  preview?: any;
}

/**
 * Service for handling local file operations
 */
export class LocalFileService {
  private static instance: LocalFileService;
  private readonly apiBaseUrl: string;
  private readonly MAX_CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
  private mockMode: boolean;
  private fileTypeCache: Map<string, string> = new Map(); // Cache for file type determination
  private isInitialized: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(options: { mockMode?: boolean } = {}) {
    this.apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // Use environment variable
    this.mockMode = options.mockMode || false;
    
    // Initialize the service
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private initialize(): void {
    if (this.isInitialized) return;
    
    // Pre-populate the file type cache with common extensions
    const commonExtensions = {
      'csv': 'csv',
      'xlsx': 'excel',
      'xls': 'excel',
      'pdf': 'pdf',
      'doc': 'word',
      'docx': 'word',
      'txt': 'text',
      'text': 'text',
      'json': 'json'
    };
    
    // Add all common extensions to the cache
    Object.entries(commonExtensions).forEach(([ext, type]) => {
      this.fileTypeCache.set(ext, type);
    });
    
    // Mark as initialized
    this.isInitialized = true;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options: { mockMode?: boolean } = {}): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService(options);
    }
    return LocalFileService.instance;
  }

  /**
   * Preload the service to improve performance
   * Call this method early in your application to initialize the service
   */
  public static preload(): void {
    // Create the instance if it doesn't exist
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
  }

  /**
   * Check if the server is available
   */
  async checkServerAvailability(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/health`);
      return response.status === 200;
    } catch (error) {
      console.error('Server health check failed:', error);
      return false;
    }
  }

  /**
   * Determine file type based on extension
   */
  getFileType(filename: string): string {
    // Extract extension
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // Check cache first
    if (this.fileTypeCache.has(extension)) {
      return this.fileTypeCache.get(extension) || 'unknown';
    }
    
    // Determine type based on extension
    let fileType = 'unknown';
    if (extension === 'csv') fileType = 'csv';
    else if (['xlsx', 'xls'].includes(extension)) fileType = 'excel';
    else if (extension === 'pdf') fileType = 'pdf';
    else if (['doc', 'docx'].includes(extension)) fileType = 'word';
    else if (['txt', 'text'].includes(extension)) fileType = 'text';
    else if (extension === 'json') fileType = 'json';
    
    // Cache the result
    this.fileTypeCache.set(extension, fileType);
    
    return fileType;
  }

  /**
   * Determine file type based on extension and MIME type
   */
  determineFileType(file: File): string {
    // First try to determine by extension
    const extensionType = this.getFileType(file.name);
    
    // If we got a valid type from extension, return it immediately
    if (extensionType !== 'unknown') {
      return extensionType;
    }
    
    // Fall back to MIME type
    const mimeType = file.type.toLowerCase();
    
    // Determine type based on MIME type
    let fileType = 'unknown';
    if (mimeType.includes('csv')) fileType = 'csv';
    else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) fileType = 'excel';
    else if (mimeType.includes('pdf')) fileType = 'pdf';
    else if (mimeType.includes('word') || mimeType.includes('document')) fileType = 'word';
    else if (mimeType.includes('text/plain')) fileType = 'text';
    else if (mimeType.includes('json')) fileType = 'json';
    
    return fileType;
  }

  /**
   * Upload a file to the server
   */
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<LocalFileMetadata> {
    const fileType = this.determineFileType(file);
    
    // Determine processing method based on file type
    let processingMethod = 'auto';
    if (fileType === 'csv') {
      processingMethod = 'csv-processor';
    }
    
    // For small files, upload directly
    if (file.size <= this.MAX_CHUNK_SIZE) {
      return await this.uploadSmallFile(file, processingMethod, onProgress);
    }
    
    // For large files, use chunked upload
    return await this.uploadLargeFile(file, processingMethod, onProgress);
  }

  /**
   * Upload a small file directly
   */
  private async uploadSmallFile(
    file: File, 
    processingMethod: string,
    onProgress?: (progress: number) => void
  ): Promise<LocalFileMetadata> {
    if (this.mockMode) {
      return this.mockUpload(file, processingMethod);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('processingMethod', processingMethod);
    
    // Get token from localStorage directly to verify
    
    // Get token using our utility function
    
    // Use the authorization header helper function as an alternative
    const authHeader = getAuthorizationHeader();
    
    const config = {
      onUploadProgress: (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onProgress) {
          onProgress(percentCompleted);
        }
      },
      headers: {
        // Don't set Content-Type here - Axios will set it with the correct boundary for multipart/form-data
        'Authorization': authHeader // Use the full header from the utility function
      }
    };
    
    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/files/upload`, formData, config);
      return this.mapResponseToFileMetadata(response.data);
    } catch (error: any) {
      console.error('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Upload a large file in chunks
   */
  private async uploadLargeFile(
    file: File,
    processingMethod: string,
    onProgress?: (progress: number) => void
  ): Promise<LocalFileMetadata> {
    try {
      // Step 1: Initialize the chunked upload
      const initResponse = await axios.post(
        `${this.apiBaseUrl}/api/files/upload/init`,
        {
          filename: file.name,
          fileSize: file.size,
          fileType: this.determineFileType(file),
          processingMethod
        },
        {
          headers: {
            Authorization: getAuthorizationHeader() || `Bearer ${getAuthToken()}`
          }
        }
      );
      
      const { uploadId } = initResponse.data;
      
      // Calculate total chunks
      const totalChunks = Math.ceil(file.size / this.MAX_CHUNK_SIZE);
      
      // Step 2: Upload each chunk
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * this.MAX_CHUNK_SIZE;
        const end = Math.min(start + this.MAX_CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('chunk', chunk);
        
        await axios.post(
          `${this.apiBaseUrl}/api/files/upload/chunk`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: getAuthorizationHeader() || `Bearer ${getAuthToken()}`
            },
            onUploadProgress: (progressEvent) => {
              if (onProgress && progressEvent.total) {
                // Calculate overall progress considering current chunk
                const chunkProgress = progressEvent.loaded / progressEvent.total;
                const overallProgress = (chunkIndex + chunkProgress) / totalChunks;
                onProgress(overallProgress * 100);
              }
            }
          }
        );
      }
      
      // Step 3: Complete the upload
      const completeResponse = await axios.post(
        `${this.apiBaseUrl}/api/files/upload/complete`,
        {
          uploadId
        },
        {
          headers: {
            Authorization: getAuthorizationHeader() || `Bearer ${getAuthToken()}`
          }
        }
      );
      
      return this.mapResponseToFileMetadata(completeResponse.data);
    } catch (error) {
      console.error('Error in chunked upload:', error);
      throw error;
    }
  }

  /**
   * Map API response to file metadata
   */
  private mapResponseToFileMetadata(response: any): LocalFileMetadata {
    return {
      id: response.id || response.fileId || '',
      filename: response.original_filename || response.originalname || response.name || response.fileName || '',
      fileType: (response.file_type || response.type || 'unknown') as LocalFileType,
      size: response.size || 0,
      uploadedAt: new Date(response.created_at || response.uploadDate || response.createdAt || Date.now()),
      lastModified: new Date(response.updated_at || response.lastModified || Date.now()),
      status: 'ready',
      url: response.url || '',
      processingMethod: response.metadata?.processingMethod || response.processingMethod || 'auto',
      preview: response.preview || null
    };
  }

  /**
   * Mock upload for testing
   */
  private mockUpload(file: File, processingMethod: string): LocalFileMetadata {
    // Removed excessive logging
    // console.log(`Mock uploading file: ${file.name} with processingMethod: ${processingMethod}`);
    
    // Generate a mock file metadata object
    return {
      id: `mock-${Date.now()}`,
      filename: file.name,
      fileType: this.determineFileType(file) as LocalFileType,
      size: file.size,
      uploadedAt: new Date(),
      lastModified: new Date(file.lastModified),
      status: 'ready',
      processingMethod
    };
  }
} 