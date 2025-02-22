import React, { useState } from 'react';
import { FileText, X, ChevronLeft } from 'lucide-react';
import type { DataSourceType, DataSourceStatus, LocalFileMetadata, LocalFileType } from './types';
import { LocalFileUploader } from './LocalFileUploader';

interface AddDataSourceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (dataSource: { 
    name: string;
    type: DataSourceType;
    status: DataSourceStatus;
    lastSync: string;
    description: string;
    metadata: LocalFileMetadata;
    metrics: {
      records: number;
      syncRate: number;
      avgSyncTime: string;
      lastError?: string;
    };
  }) => void;
}

interface DataSourceUIType {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'database' | 'crm' | 'storage' | 'analytics' | 'sap';
  logoUrl?: string;
  options?: {
    id: string;
    name: string;
    logoUrl: string;
    description: string;
  }[];
}

const FILE_TYPE_ICONS = {
  csv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=',
  excel: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyMTk2NTMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==',
  pdf: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+',
  json: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGNTlFMEIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg=='
};

const DATA_SOURCE_TYPES: DataSourceUIType[] = [
  {
    id: 'local-files',
    name: 'Local Files',
    icon: <FileText className="w-8 h-8" />,
    description: 'Upload and manage local files',
    category: 'storage',
    options: [
      {
        id: 'csv',
        name: 'CSV Files',
        logoUrl: FILE_TYPE_ICONS.csv,
        description: 'Upload and analyze CSV files'
      },
      {
        id: 'excel',
        name: 'Excel Files',
        logoUrl: FILE_TYPE_ICONS.excel,
        description: 'Upload and analyze Excel spreadsheets'
      },
      {
        id: 'pdf',
        name: 'PDF Files',
        logoUrl: FILE_TYPE_ICONS.pdf,
        description: 'Upload and view PDF documents'
      },
      {
        id: 'json',
        name: 'JSON Files',
        logoUrl: FILE_TYPE_ICONS.json,
        description: 'Upload and parse JSON data'
      }
    ]
  }
];

export const AddDataSourceWizard: React.FC<AddDataSourceWizardProps> = ({ isOpen, onClose, onAdd }) => {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'local-files' as DataSourceType,
    fileMetadata: undefined as LocalFileMetadata | undefined
  });

  const handleTypeSelect = (type: string) => {
    console.log('handleTypeSelect called with:', type);
    setSelectedType(type);
    
    // Split the type into source and id
    const parts = type.split('-');
    const sourceType = parts.slice(0, 2).join('-'); // 'local-files'
    const sourceId = parts[2]; // 'csv'
    console.log('Split type in handler:', { sourceType, sourceId, parts });
    
    setFormData(prev => ({
      ...prev,
      type: sourceType as DataSourceType,
      name: `New ${sourceId.toUpperCase()} File`
    }));
    
    setStep(1);
    console.log('Step set to:', 1);
  };

  const handleFileUploadComplete = (file: LocalFileMetadata) => {
    console.log('Handling file upload complete with file:', file);
    
    // Ensure we have the records count and content
    const recordsCount = file.records || 0;
    const content = file.content || [];
    console.log('Records count:', recordsCount);
    
    // Create metrics object
    const metrics = {
      records: recordsCount,
      syncRate: 100,
      avgSyncTime: '0s'
    };
    
    // Create the data source object with the file's data
    const dataSource = {
      name: file.filename,
      type: 'local-files' as DataSourceType,
      status: 'connected' as DataSourceStatus,
      lastSync: new Date().toISOString(),
      description: `${file.fileType.toUpperCase()} file with ${recordsCount} records`,
      metadata: {
        id: file.id,
        filename: file.filename,
        fileType: file.fileType,
        size: file.size,
        uploadedAt: file.uploadedAt,
        lastModified: file.lastModified,
        status: file.status,
        records: recordsCount,
        content: content,
        preview: file.preview
      },
      metrics
    };

    console.log('Adding data source with data:', dataSource);
    onAdd(dataSource);
    onClose();
  };

  const handleBack = () => {
    setStep(0);
    setSelectedType(null);
    setFormData(prev => ({
      ...prev,
      name: '',
      fileMetadata: undefined
    }));
  };

  const renderFileUploadStep = () => {
    if (!selectedType) {
      console.log('No selectedType');
      return null;
    }
    
    // For local files, the format is 'local-files-csv'
    const parts = selectedType.split('-');
    const sourceType = parts.slice(0, 2).join('-'); // 'local-files'
    const sourceId = parts[2]; // 'csv'
    
    console.log('Split type:', { sourceType, sourceId, parts });
    
    const sourceCategory = DATA_SOURCE_TYPES.find(type => type.id === sourceType);
    console.log('Found category:', sourceCategory);
    
    const sourceOption = sourceCategory?.options?.find(opt => opt.id === sourceId);
    console.log('Found option:', sourceOption);

    if (!sourceCategory || !sourceOption) {
      console.error('Could not find source category or option', {
        selectedType,
        sourceType,
        sourceId,
        availableTypes: DATA_SOURCE_TYPES.map(t => t.id),
        availableOptions: sourceCategory?.options?.map(o => o.id)
      });
      return null;
    }

    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700">
            <img
              src={sourceOption.logoUrl}
              alt={sourceOption.name}
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Upload {sourceOption.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sourceOption.description}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              File Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={`My ${sourceOption.name}`}
            />
          </div>

          <div className="flex-1">
            <div className="w-full h-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
              <LocalFileUploader
                fileType={sourceId as LocalFileType}
                onUploadComplete={handleFileUploadComplete}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTypeSelectionStep = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Select Data Source Type
        </h3>
        <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 -mr-2">
          {DATA_SOURCE_TYPES.map(category => (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center space-x-3 sticky top-0 bg-white dark:bg-gray-800 py-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                  {category.icon}
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {category.description}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {category.options?.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      console.log('Button clicked:', `${category.id}-${option.id}`);
                      handleTypeSelect(`${category.id}-${option.id}`);
                    }}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors group text-left flex items-start space-x-3 cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-gray-900 p-1.5 flex items-center justify-center">
                      <img
                        src={option.logoUrl}
                        alt={option.name}
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate">
                        {option.name}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return renderTypeSelectionStep();
      case 1:
        return renderFileUploadStep();
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl flex flex-col min-h-[500px] max-h-[90vh] relative">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm">Back</span>
                </button>
              )}
              <div className="flex items-center space-x-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <div className={`h-px w-4 ${index <= step ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    )}
                    <div
                      className={`w-2 h-2 rounded-full ${
                        index <= step
                          ? 'bg-purple-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto">
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
}; 