import React, { useRef, useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { LocalFileService } from '../../services/LocalFileService';
import { LocalFileMetadata, LocalFileType } from './types';

interface CustomFileInputProps {
  onUploadComplete?: (file: LocalFileMetadata) => void;
  fileType?: LocalFileType;
}

/**
 * A lightweight custom file input component that uses the native file input
 * for better performance when opening the file browser dialog
 */
export const CustomFileInput: React.FC<CustomFileInputProps> = ({
  onUploadComplete,
  fileType
}) => {
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileService = LocalFileService.getInstance();

  // Preload the file input when the component mounts
  useEffect(() => {
    // Create a dummy click handler to "warm up" the file dialog
    // This can help reduce the initial delay when opening the file browser
    const warmUpFileDialog = () => {
      const dummyInput = document.createElement('input');
      dummyInput.type = 'file';
      dummyInput.style.display = 'none';
      dummyInput.accept = '.csv,.xlsx,.xls,.pdf,.json,.docx,.doc';
      document.body.appendChild(dummyInput);
      
      // Just accessing the click method can help initialize browser resources
      // We don't actually call it to avoid opening the dialog automatically
      dummyInput.click; // Just access the property without storing it
      
      // Remove the dummy input after a short delay
      setTimeout(() => {
        document.body.removeChild(dummyInput);
      }, 1000);
    };

    // Warm up the file dialog
    warmUpFileDialog();
  }, []);

  // Simplified file extension mapping - use a simple string instead of complex objects
  const getAcceptedFileExtensions = (): string => {
    // Use a simplified approach with just the file extensions
    switch (fileType) {
      case 'csv': return '.csv';
      case 'xlsx': return '.xlsx,.xls';
      case 'pdf': return '.pdf';
      case 'json': return '.json';
      case 'docx': return '.docx,.doc';
      default: return '.csv,.xlsx,.xls,.pdf,.json,.docx,.doc';
    }
  };

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔧 CustomFileInput: handleFileChange triggered');
    const files = event.target.files;
    console.log('🔧 CustomFileInput: Selected files:', files);
    
    if (!files || files.length === 0) {
      console.log('🔧 CustomFileInput: No files selected, returning');
      return;
    }

    const file = files[0];
    console.log('🔧 CustomFileInput: Processing file:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    setUploading(true);
    try {
      console.log('🔧 CustomFileInput: Calling fileService.uploadFile()');
      console.log('🔧 CustomFileInput: FileService instance:', fileService);
      
      // Add comprehensive error catching
      const metadata = await fileService.uploadFile(file).catch((uploadError) => {
        console.error('🔧 CustomFileInput: Upload failed in fileService.uploadFile():', uploadError);
        console.error('🔧 CustomFileInput: Upload error stack:', uploadError.stack);
        throw uploadError;
      });
      
      console.log('🔧 CustomFileInput: Upload successful, metadata:', metadata);
      
      // Convert metadata to ensure dataSourceId is a string
      const typeSafeMetadata = {
        ...metadata,
        dataSourceId: metadata.dataSourceId != null ? String(metadata.dataSourceId) : undefined
      };
      
      console.log('🔧 CustomFileInput: Calling onUploadComplete callback');
      onUploadComplete?.(typeSafeMetadata);
    } catch (error) {
      console.error('🔧 CustomFileInput: Upload failed:', error);
      console.error('🔧 CustomFileInput: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error,
        toString: error?.toString?.()
      });
      
      // Show user-friendly error
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🔧 CustomFileInput: Upload process finished, cleaning up');
      setUploading(false);
      // Reset the input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Direct click handler for better responsiveness
  const handleBrowseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use a more direct approach to click the file input
    if (fileInputRef.current) {
      // Focus and click in quick succession
      fileInputRef.current.focus();
      fileInputRef.current.click();
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0]; // Only take the first file
      const metadata = await fileService.uploadFile(file);
      
      // Convert metadata to ensure dataSourceId is a string
      const typeSafeMetadata = {
        ...metadata,
        dataSourceId: metadata.dataSourceId != null ? String(metadata.dataSourceId) : undefined
      };
      
      onUploadComplete?.(typeSafeMetadata);
    } catch (error) {
      console.error('🔧 CustomFileInput: Upload failed:', error);
      console.error('🔧 CustomFileInput: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error
      });
    } finally {
      setUploading(false);
    }
  };

  // Create a separate component for the browse link for better click handling
  const BrowseLink = () => (
    <span 
      className="text-purple-600 dark:text-purple-400 cursor-pointer"
      onClick={handleBrowseClick}
      onKeyDown={(e) => e.key === 'Enter' && handleBrowseClick(e as unknown as React.MouseEvent)}
      tabIndex={0}
      role="button"
      aria-label="Browse files"
    >
      browse
    </span>
  );

  return (
    <div className="flex flex-col items-center justify-center text-center">
      {/* Hidden file input with simplified accept attribute */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={getAcceptedFileExtensions()}
        className="hidden"
        aria-label="File upload"
      />

      {/* Drag and drop area */}
      <div
        className={`w-full cursor-pointer focus:outline-none ${
          isDragActive ? 'border-purple-500 dark:border-purple-400' : ''
        }`}
        onClick={handleBrowseClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        tabIndex={0}
        role="button"
        aria-label="Drop zone"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-full">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
            ) : (
              <Upload className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              or <BrowseLink /> to choose a file
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {fileType ? `Only ${fileType.toUpperCase()} files are accepted` : 'Supported formats: CSV, Excel, PDF, JSON'}
            </p>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Uploading your file...
        </div>
      )}
    </div>
  );
}; 