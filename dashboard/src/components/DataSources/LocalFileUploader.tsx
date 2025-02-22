import React, { useState, useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import { LocalFileService } from '../../services/LocalFileService';
import { LocalFileMetadata, LocalFileType } from './types';

interface LocalFileUploaderProps {
  onUploadComplete?: (file: LocalFileMetadata) => void;
  fileType?: LocalFileType;
}

export const LocalFileUploader: React.FC<LocalFileUploaderProps> = ({ 
  onUploadComplete,
  fileType 
}) => {
  const [uploading, setUploading] = useState(false);
  const fileService = LocalFileService.getInstance();

  const getAcceptedFileTypes = (type?: LocalFileType): Accept => {
    switch (type) {
      case 'csv':
        return { 'text/csv': ['.csv'] };
      case 'excel':
        return {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'application/vnd.ms-excel': ['.xls']
        };
      case 'pdf':
        return { 'application/pdf': ['.pdf'] };
      case 'json':
        return { 'application/json': ['.json'] };
      default:
        return {
          'text/csv': ['.csv'],
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'application/vnd.ms-excel': ['.xls'],
          'application/pdf': ['.pdf'],
          'application/json': ['.json']
        };
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    try {
      const file = acceptedFiles[0]; // Only take the first file
      const metadata = await fileService.uploadFile(file);
      onUploadComplete?.(metadata);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFileTypes(fileType),
    maxFiles: 1,
    multiple: false
  });

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div
        {...getRootProps()}
        className={`w-full cursor-pointer focus:outline-none ${
          isDragActive ? 'border-purple-500 dark:border-purple-400' : ''
        }`}
      >
        <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
        
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
              or <span className="text-purple-600 dark:text-purple-400">browse</span> to choose a file
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