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

  /**
   * Private constructor for singleton pattern
   */
  private constructor(options: { mockMode?: boolean } = {}) {
    this.apiBaseUrl = 'http://localhost:3001'; // Default API URL
    this.mockMode = options.mockMode || false;
    console.log('LocalFileService initialized');
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
    if (!filename) return 'unknown';
    
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    console.log(`File extension: ${extension}`);
    
    if (extension === 'csv') return 'csv';
    if (['xlsx', 'xls'].includes(extension)) return 'excel';
    if (extension === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(extension)) return 'word';
    if (['txt', 'text'].includes(extension)) return 'text';
    if (extension === 'json') return 'json';
    
    return 'unknown';
  }

  /**
   * Determine file type based on extension and MIME type
   */
  determineFileType(file: File): string {
    // First try to determine by extension
    const extensionType = this.getFileType(file.name);
    if (extensionType !== 'unknown') {
      console.log(`File type determined by extension: ${extensionType}`);
      return extensionType;
    }
    
    // Fall back to MIME type
    const mimeType = file.type;
    console.log(`MIME type: ${mimeType}`);
    
    if (mimeType.includes('csv') || mimeType === 'text/csv') return 'csv';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheetml')) return 'excel';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.includes('text/plain')) return 'text';
    if (mimeType.includes('json')) return 'json';
    
    return 'unknown';
  }

  /**
   * Upload a file to the server
   */
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<LocalFileMetadata> {
    try {
      console.log(`Uploading file: ${file.name} (${file.size} bytes)`);
      const fileType = this.determineFileType(file);
      console.log(`Detected file type: ${fileType}`);
      
      // Determine processing method based on file type
      let processingMethod = 'auto';
      if (fileType === 'csv') {
        console.log('Setting processing method to csv-processor for CSV file');
        processingMethod = 'csv-processor';
      }
      
      // For small files, upload directly
      if (file.size <= this.MAX_CHUNK_SIZE) {
        return await this.uploadSmallFile(file, processingMethod, onProgress);
      }
      
      // For large files, use chunked upload
      return await this.uploadLargeFile(file, processingMethod, onProgress);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
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
    const localStorageToken = localStorage.getItem('jwt');
    console.log('Token from localStorage:', localStorageToken ? 'Found (first 10 chars: ' + localStorageToken.substring(0, 10) + '...)' : 'Not found');
    
    // Get token using our utility function
    const token = getAuthToken();
    console.log('Token from getAuthToken():', token ? 'Found (first 10 chars: ' + token.substring(0, 10) + '...)' : 'Not found');
    
    // Use the authorization header helper function as an alternative
    const authHeader = getAuthorizationHeader();
    console.log('Authorization header:', authHeader ? 'Found (value: ' + authHeader + ')' : 'Empty');
    
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
    
    console.log('Upload config:', { 
      url: `${this.apiBaseUrl}/api/files/upload`,
      hasAuthHeader: !!config.headers.Authorization,
      processingMethod,
      authHeaderValue: config.headers.Authorization
    });
    
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
    if (this.mockMode) {
      return this.mockUpload(file, processingMethod);
    }

    console.log('Starting chunked upload for file:', file.name, `(${file.size} bytes)`);
    
    // Initiate chunked upload
    const initiateResponse = await axios.post(
      `${this.apiBaseUrl}/api/files/initiate-chunked-upload`,
      {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        processingMethod
      },
      { headers: { Authorization: getAuthorizationHeader() } }
    );
    
    const { uploadId } = initiateResponse.data;
    console.log('Received upload ID:', uploadId);
    
    const totalChunks = Math.ceil(file.size / this.MAX_CHUNK_SIZE);
    console.log(`File will be uploaded in ${totalChunks} chunks of max size ${this.MAX_CHUNK_SIZE} bytes`);
    
    let uploadedChunks = 0;
    
    // Upload each chunk
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.MAX_CHUNK_SIZE;
      const end = Math.min(start + this.MAX_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      console.log(`Uploading chunk ${chunkIndex}/${totalChunks} (${start}-${end}, ${chunk.size} bytes)`);
      
      const chunkFormData = new FormData();
      chunkFormData.append('file', chunk, file.name);
      
      // Instead of adding parameters to the form data, add them as URL query parameters
      try {
        const response = await axios.post(
          `${this.apiBaseUrl}/api/files/upload-chunk?uploadId=${uploadId}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`,
          chunkFormData,
          { headers: { Authorization: getAuthorizationHeader() } }
        );
        
        console.log(`Chunk ${chunkIndex} upload successful:`, response.data);
        
        uploadedChunks++;
        if (onProgress) {
          onProgress(Math.round((uploadedChunks / totalChunks) * 100));
        }
      } catch (error) {
        console.error(`Error uploading chunk ${chunkIndex}:`, error);
        console.error('Error details:', {
          response: (error as any).response?.data,
          status: (error as any).response?.status,
          message: (error as any).message
        });
        throw error;
      }
    }
    
    console.log('All chunks uploaded successfully. Completing upload...');
    
    // Complete chunked upload
    const completeResponse = await axios.post(
      `${this.apiBaseUrl}/api/files/complete-chunked-upload`,
      { 
        uploadId,
        totalChunks
      },
      { headers: { Authorization: getAuthorizationHeader() } }
    );
    
    console.log('Upload completion response:', completeResponse.data);
    
    return this.mapResponseToFileMetadata(completeResponse.data);
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
    console.log(`Mock uploading file: ${file.name} with processingMethod: ${processingMethod}`);
    
    // Generate a mock file ID
    const mockId = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Determine file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    let fileType: LocalFileType = 'csv';
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      fileType = 'xlsx';
    } else if (fileExtension === 'pdf') {
      fileType = 'pdf';
    } else if (fileExtension === 'docx' || fileExtension === 'doc') {
      fileType = 'docx';
    } else if (fileExtension === 'json') {
      fileType = 'json';
    }
    
    return {
      id: mockId,
      filename: file.name,
      fileType,
      size: file.size,
      uploadedAt: new Date(),
      lastModified: new Date(),
      status: 'ready',
      url: URL.createObjectURL(file),
      processingMethod,
      preview: null
    };
  }
} 