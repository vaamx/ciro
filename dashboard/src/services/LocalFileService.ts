import axios from 'axios';
import { getAuthorizationHeader, getAuthToken } from '../utils/authToken';
import { LocalFileType } from '../components/DataSources/types';
import { jwtDecode } from 'jwt-decode';

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
  dataSourceId?: string | number;
}

// Add a function to get the organization ID from the auth token
function getOrganizationIdFromToken(): number | null {
  try {
    const token = getAuthToken();
    if (!token) return null;
    
    const decoded = jwtDecode<{ 
      organizationId?: number | string, 
      organizations?: (number | string)[] 
    }>(token);
    
    // First, check for active organization in local storage
    const activeOrgId = localStorage.getItem('active_organization_id');
    if (activeOrgId) {
      const orgId = parseInt(activeOrgId, 10);
      
      // If token has organization data, validate against it
      if (decoded.organizations && decoded.organizations.length > 0) {
        if (decoded.organizations.some(id => 
            (typeof id === 'string' ? parseInt(id, 10) : id) === orgId)) {
          console.log(`Using active organization ID from storage (validated): ${orgId}`);
          return orgId;
        } else {
          console.warn(`Active organization ${orgId} not found in token organizations, but proceeding anyway`);
          // Still return the active org ID even if not in token (for backwards compatibility)
          return orgId;
        }
      } else {
        // No organization data in token, but we have an active org ID - use it
        console.log(`Using active organization ID from storage (no token validation): ${orgId}`);
        return orgId;
      }
    }
    
    // Fallback to the token's primary organizationId
    if (decoded && decoded.organizationId) {
      const orgId = typeof decoded.organizationId === 'string' 
        ? parseInt(decoded.organizationId, 10) 
        : decoded.organizationId;
      console.log(`Using primary organization ID from token: ${orgId}`);
      return orgId;
    }
    
    // Final fallback - use the first organization in the array
    if (decoded && decoded.organizations && decoded.organizations.length > 0) {
      const firstOrgId = decoded.organizations[0];
      const orgId = typeof firstOrgId === 'string'
        ? parseInt(firstOrgId, 10)
        : firstOrgId;
      console.log(`Using first available organization ID: ${orgId}`);
      return orgId;
    }
    
    console.warn('No organization context available in token or localStorage');
    return null;
  } catch (error) {
    console.error('Error extracting organization ID from token:', error);
    return null;
  }
}

/**
 * Service for handling local file operations
 */
export class LocalFileService {
  private static instance: LocalFileService;
  private readonly apiBaseUrl: string;
  private readonly MAX_CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
  private fileTypeCache: Map<string, string> = new Map(); // Cache for file type determination
  private isInitialized: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
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
  public static getInstance(): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
    return LocalFileService.instance;
  }

  /**
   * Preload the service instance
   */
  public static preload(): void {
    if (!LocalFileService.instance) {
      LocalFileService.getInstance();
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
    console.log('🔧 LocalFileService: uploadFile called with:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    const fileType = this.determineFileType(file);
    console.log('🔧 LocalFileService: Determined file type:', fileType);
    
    // Determine processing method based on file type
    let processingMethod = 'auto';
    if (fileType === 'csv') {
      processingMethod = 'csv-processor';
    } else if (fileType === 'excel') {
      processingMethod = 'enhanced-excel-pipeline';
    }
    console.log('🔧 LocalFileService: Using processing method:', processingMethod);
    
    // For small files, upload directly
    if (file.size <= this.MAX_CHUNK_SIZE) {
      console.log('🔧 LocalFileService: File is small, using direct upload');
      return await this.uploadSmallFile(file, processingMethod, onProgress);
    }
    
    // For large files, use chunked upload
    console.log('🔧 LocalFileService: File is large, using chunked upload');
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
    console.log('🔧 LocalFileService: uploadSmallFile started');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('processingMethod', processingMethod);
    
    console.log('🔧 LocalFileService: Preparing form data');
    
    // Get organization ID from token
    const organizationId = getOrganizationIdFromToken();
    
    // Add the organization ID from the token if available
    if (organizationId) {
      formData.append('organizationId', organizationId.toString());
      console.log(`🔧 LocalFileService: Organization ID from token: ${organizationId}`);
      
      // Also add the active organization ID separately for diagnostics
      const activeOrgId = localStorage.getItem('active_organization_id');
      if (activeOrgId && activeOrgId !== organizationId.toString()) {
        formData.append('active_organization_id', activeOrgId);
        console.log(`🔧 LocalFileService: Note: Active organization (${activeOrgId}) differs from the one used for upload (${organizationId})`);
      }
    } else {
      console.warn('🔧 LocalFileService: No organization ID found - proceeding without organization context');
      // Try to use the active organization ID directly as a fallback
      const activeOrgId = localStorage.getItem('active_organization_id');
      if (activeOrgId) {
        formData.append('organizationId', activeOrgId);
        console.log(`🔧 LocalFileService: Using fallback organization ID from localStorage: ${activeOrgId}`);
      }
    }
    
    // Use the authorization header helper function as an alternative
    const authHeader = getAuthorizationHeader();
    console.log('🔧 LocalFileService: Auth header:', authHeader ? '[PRESENT]' : '[MISSING]');
    
    const config = {
      onUploadProgress: (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log('🔧 LocalFileService: Upload progress:', percentCompleted + '%');
        if (onProgress) {
          onProgress(percentCompleted);
        }
      },
      headers: {
        // Don't set Content-Type here - Axios will set it with the correct boundary for multipart/form-data
        'Authorization': authHeader // Use the full header from the utility function
      },
      timeout: 30000, // 30 second timeout
      validateStatus: (status: number) => {
        // Log all status codes for debugging
        console.log('🔧 LocalFileService: Response status:', status);
        return status < 600; // Don't throw on any status code, let us handle it
      }
    };
    
    const uploadUrl = `${this.apiBaseUrl}/api/files/upload`;
    console.log('🔧 LocalFileService: Making upload request to:', uploadUrl);
    console.log('🔧 LocalFileService: Request config:', {
      url: uploadUrl,
      method: 'POST',
      timeout: config.timeout,
      headers: Object.keys(config.headers)
    });
    
    try {
      console.log('🔧 LocalFileService: About to call axios.post...');
      
      const response = await axios.post(uploadUrl, formData, config);
      
      console.log('🔧 LocalFileService: Upload response received:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      
      // Check if the response was successful
      if (response.status >= 400) {
        console.error('🔧 LocalFileService: Upload failed with status:', response.status);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}${response.data?.message ? ' - ' + response.data.message : ''}`);
      }
      
      return this.mapResponseToFileMetadata(response.data);
    } catch (error: any) {
      console.error('🔧 LocalFileService: Upload failed with error:', error);
      console.error('🔧 LocalFileService: Error type:', error.constructor.name);
      console.error('🔧 LocalFileService: Error message:', error.message);
      
      if (error.response) {
        console.error('🔧 LocalFileService: Response error details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('🔧 LocalFileService: Network error - no response received:', {
          timeout: error.code === 'ECONNABORTED',
          readyState: error.request.readyState,
          status: error.request.status
        });
      } else {
        console.error('🔧 LocalFileService: Request setup error:', error.message);
      }
      
      // Re-throw with more context
      const errorMessage = error.response?.data?.message || error.message || 'Unknown upload error';
      throw new Error(`File upload failed: ${errorMessage}`);
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
      // Get organization ID from token
      const organizationId = getOrganizationIdFromToken();
      
      // Step 1: Initialize the chunked upload
      const initData: any = {
        filename: file.name,
        fileSize: file.size,
        fileType: this.determineFileType(file),
        processingMethod
      };
      
      // Add the organization ID from the token if available
      if (organizationId) {
        initData.organizationId = organizationId;
        console.log(`Using organization ID from token/active selection for chunked upload: ${organizationId}`);
        
        // Also add the active organization ID separately for diagnostics
        const activeOrgId = localStorage.getItem('active_organization_id');
        if (activeOrgId && activeOrgId !== organizationId.toString()) {
          initData.active_organization_id = activeOrgId;
          console.log(`Note: Active organization (${activeOrgId}) differs from the one used for upload (${organizationId})`);
        }
      } else {
        console.warn('No organization ID found for chunked upload - using fallback');
        const activeOrgId = localStorage.getItem('active_organization_id');
        if (activeOrgId) {
          initData.organizationId = activeOrgId;
          console.log(`Using fallback organization ID for chunked upload: ${activeOrgId}`);
        }
      }
      
      const initResponse = await axios.post(
        `${this.apiBaseUrl}/api/files/initiate-chunked-upload`,
        initData,
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
        // Use 'file' as the field name, not 'chunk', to match server multer config
        formData.append('file', chunk);
        
        await axios.post(
          `${this.apiBaseUrl}/api/files/upload-chunk?uploadId=${uploadId}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`,
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
        `${this.apiBaseUrl}/api/files/complete-chunked-upload`,
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
      preview: response.preview || null,
      dataSourceId: response.dataSourceId || response.data_source_id || null
    };
  }
} 