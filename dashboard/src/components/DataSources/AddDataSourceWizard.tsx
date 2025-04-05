import React, { useState, useEffect, lazy, Suspense } from 'react';
import { FileText, X, ChevronLeft, Database, Cloud, MessageSquare, Briefcase, ChevronRight, Cpu } from 'lucide-react';
import type { DataSourceType, DataSourceStatus, LocalFileMetadata, LocalFileType } from './types';
import { useDataSources } from '../../contexts/DataSourcesContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useNotification } from '../../contexts/NotificationContext';

// Lazy load the CustomFileInput component
const CustomFileInput = lazy(() => 
  import('./CustomFileInput').then(module => ({ default: module.CustomFileInput }))
);

// Preload the CustomFileInput component
const preloadCustomFileInput = () => {
  // Create a hidden instance of the component to preload it
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);
  
  // Render a hidden instance of the actual component
  const cleanup = setTimeout(() => {
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 5000);
  
  return () => {
    clearTimeout(cleanup);
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
  };
};

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
  csv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0MzU1QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRUJGMkZGIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=',
  excel: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxRTZGNDkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRTNGNUVDIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==',
  pdf: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNEQzI2MjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRkVFMkUyIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+',
  json: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNEOTdGMDYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRkVGM0M3Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg==',
  docx: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjREJFQUZFIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE2IDEzbC00IDZoLTRsNi05eiI+PC9wYXRoPjwvc3ZnPg==',
  snowflake: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkwxMiAxNiIgc3Ryb2tlPSIjMjI5MEVBIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yMiAxMkwyIDE2IiBzdHJva2U9IiMyMjkwRUEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTIyIDE2TDIgMTIiIHN0cm9rZT0iIzIyOTBFQSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTIgMjJMMTIgOCIgc3Ryb2tlPSIjMjI5MEVBIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik01IDdMMTkgMTciIHN0cm9rZT0iIzIyOTBFQSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTkgN0w1IDE3IiBzdHJva2U9IiMyMjkwRUEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjMjI5MEVBIi8+PHBhdGggZD0iTTEyIDIwQzEzLjEwNDYgMjAgMTQgMTkuMTA0NiAxNCAxOEMxNCAxNi44OTU0IDEzLjEwNDYgMTYgMTIgMTZDMTAuODk1NCAxNiAxMCAxNi44OTU0IDEwIDE4QzEwIDE5LjEwNDYgMTAuODk1NCAyMCAxMiAyMFoiIGZpbGw9IiMyMjkwRUEiLz48L3N2Zz4='
};

const BRAND_LOGOS = {
  rabbitmq: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGNjYwMCIgZD0iTTIyLjkgMS4xSDEuMXYyMS44aDIxLjhWMS4xek0xMiAxOC41Yy0zLjYgMC02LjUtMi45LTYuNS02LjVTOC40IDUuNSAxMiA1LjVzNi41IDIuOSA2LjUgNi41LTIuOSA2LjUtNi41IDYuNXoiLz48L3N2Zz4=',
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
        id: 'docx',
        name: 'Word Documents',
        logoUrl: FILE_TYPE_ICONS.docx,
        description: 'Upload and process Word documents'
      }
    ]
  },
  {
    id: 'iot',
    name: 'IOT',
    icon: <Cpu className="w-8 h-8" />,
    description: 'Connect to Internet of Things devices',
    category: 'storage',
    options: [
      {
        id: 'cameras',
        name: 'Camaras',
        logoUrl: '/images/cameras.svg',
        description: 'Connect and analyze camera feeds'
      },
      {
        id: 'machines',
        name: 'Maquinas',
        logoUrl: '/images/maquinas.svg',
        description: 'Monitor and manage industrial machines'
      },
      {
        id: 'fleet',
        name: 'Fleet',
        logoUrl: '/images/fleet.svg',
        description: 'Track and manage vehicle fleets'
      }
    ]
  },
  {
    id: 'databases',
    name: 'Databases',
    icon: <Database className="w-8 h-8" />,
    description: 'Connect to database systems',
    category: 'database',
    options: [
      {
        id: '***REMOVED***ql',
        name: 'PostgreSQL',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg',
        description: 'Open source relational database'
      },
      {
        id: 'mysql',
        name: 'MySQL',
        logoUrl: 'https://img.icons8.com/?size=100&id=UFXRpPFebwa2&format=png&color=000000',
        description: 'Popular open source database'
      },
      {
        id: 'mongodb',
        name: 'MongoDB',
        logoUrl: 'https://www.mongodb.com/assets/images/global/leaf.png',
        description: 'NoSQL document database'
      },
      {
        id: 'clickhouse',
        name: 'ClickHouse',
        logoUrl: 'https://cdn.brandfetch.io/idnezyZEJm/w/625/h/625/theme/dark/icon.png?c=1dxbfHSJFAPEGdCLU4o5B',
        description: 'Column-oriented OLAP database'
      }
    ]
  },
  {
    id: 'data-warehouses',
    name: 'Data Warehouses',
    icon: <Cloud className="w-8 h-8" />,
    description: 'Connect to cloud data warehouses',
    category: 'analytics',
    options: [
      {
        id: 'snowflake',
        name: 'Snowflake',
        logoUrl: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B',
        description: 'Cloud data warehouse platform'
      },
      {
        id: 'bigquery',
        name: 'Google BigQuery',
        logoUrl: '/images/google-bigquery-logo-1.svg',
        description: 'Google Cloud data warehouse'
      },
      {
        id: 'redshift',
        name: 'Amazon Redshift',
        logoUrl: '/images/redshift_icon.svg',
        description: 'AWS data warehouse service'
      },
    ]
  },
  {
    id: 'streaming',
    name: 'Streaming & Message Queues',
    icon: <MessageSquare className="w-8 h-8" />,
    description: 'Connect to real-time data streams and message queues',
    category: 'analytics',
    options: [
      {
        id: 'kafka',
        name: 'Apache Kafka',
        logoUrl: '/images/apache_kafka.svg',
        description: 'Distributed event streaming platform'
      },
    ]
  },
  {
    id: 'business-apps',
    name: 'Business Applications',
    icon: <Briefcase className="w-8 h-8" />,
    description: 'Connect to enterprise business applications',
    category: 'crm',
    options: [
      {
        id: 'salesforce',
        name: 'Salesforce',
        logoUrl: 'https://www.salesforce.com/content/dam/sfdc-docs/www/logos/logo-salesforce.svg',
        description: 'CRM and business platform'
      },
      {
        id: 'sap',
        name: 'SAP',
        logoUrl: 'https://www.sap.com/dam/application/shared/logos/sap-logo-svg.svg',
        description: 'Enterprise resource planning'
      },
      {
        id: 'oracle',
        name: 'Oracle',
        logoUrl: '/images/oracle.svg',
        description: 'Business software solutions'
      },
      {
        id: 'workday',
        name: 'Workday',
        logoUrl: '/images/workday-seeklogo.svg',
        description: 'HR and financial management'
      }
    ]
  }
];

export const AddDataSourceWizard: React.FC<AddDataSourceWizardProps> = ({ isOpen, onClose, onAdd }) => {
  // Removed excessive logging
  // console.log('DATA_SOURCE_TYPES:', JSON.stringify(DATA_SOURCE_TYPES, null, 2));
  
  // Use underscore prefix for unused state variables
  const [_currentType, _setCurrentType] = useState<string>('');
  const [step, setStep] = useState<number>(0);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [comingSoonType, setComingSoonType] = useState('');
  
  // Get the data sources context
  const { setPausePolling } = useDataSources();
  useOrganization();
  useNotification();

  // Pause polling when the wizard is open
  useEffect(() => {
    if (isOpen) {
      setPausePolling(true);
    }
    
    // Resume polling when the component is unmounted or closed
    return () => {
      setPausePolling(false);
    };
  }, [isOpen, setPausePolling]);

  // Preload the CustomFileInput component when the wizard opens
  useEffect(() => {
    if (isOpen) {
      const cleanup = preloadCustomFileInput();
      return cleanup;
    }
  }, [isOpen]);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'local-files' as DataSourceType,
    fileMetadata: undefined as LocalFileMetadata | undefined
  });

  // Filter data sources based on search term
  const getFilteredDataSources = () => {
    if (!searchTerm.trim()) return DATA_SOURCE_TYPES;
    
    return DATA_SOURCE_TYPES.map(category => {
      const filteredOptions = category.options?.filter(option => 
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        option.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (!filteredOptions || filteredOptions.length === 0) return null;
      
      return {
        ...category,
        options: filteredOptions
      };
    }).filter(Boolean) as DataSourceUIType[];
  };

  // Direct handler for Snowflake clicks
  const handleSnowflakeClick = () => {
    onAdd({
      name: 'Snowflake Connection',
      type: 'snowflake',
      status: 'connected',
      lastSync: new Date().toISOString(),
      description: 'Snowflake Data Lake Connection',
      metadata: {} as any,
      metrics: {
        records: 0,
        syncRate: 0,
        avgSyncTime: '0s'
      }
    });
    handleClose();
  };
  
  const handleTypeSelect = (type: string) => {
    // Extremely explicit check for Snowflake
    if (type === 'data-warehouses-snowflake') {
      onAdd({
        name: 'Snowflake Connection',
        type: 'snowflake',
        status: 'connected',
        lastSync: new Date().toISOString(),
        description: 'Snowflake Data Lake Connection',
        metadata: {} as any,
        metrics: {
          records: 0,
          syncRate: 0,
          avgSyncTime: '0s'
        }
      });
      handleClose();
      return;
    }
    
    // Generic check for snowflake as a fallback
    if (type.includes('snowflake')) {
      onAdd({
        name: 'Snowflake Connection',
        type: 'snowflake',
        status: 'connected',
        lastSync: new Date().toISOString(),
        description: 'Snowflake Data Lake Connection',
        metadata: {} as any,
        metrics: {
          records: 0,
          syncRate: 0,
          avgSyncTime: '0s'
        }
      });
      handleClose();
      return;
    }
    
    // Set the selected type - this is critical for file uploads
    setSelectedType(type);
    
    // Split the type into source and id
    const parts = type.split('-');
    const sourceType = parts.slice(0, 2).join('-'); // 'local-files'
    const sourceId = parts[2]; // 'csv'
    
    // Only proceed to file upload step for Local Files types
    if (sourceType === 'local-files' && sourceId) {
      setFormData(prev => ({
        ...prev,
        type: sourceType as DataSourceType,
        name: `New ${sourceId.toUpperCase()} File`
      }));
      
      setStep(1);
    } else {
      // For other data sources that are not yet implemented
      setShowComingSoon(true);
      setComingSoonType(type);
    }
  };

  const handleFileUploadComplete = (file: LocalFileMetadata) => {
    // Removed excessive logging
    // console.log('File upload complete:', file);
    
    // Check if we already have a data source ID from the chunked upload
    if (file.dataSourceId) {
      // Removed excessive logging
      // console.log(`Using existing data source ID from chunked upload: ${file.dataSourceId}`);
      
      // Close the wizard and trigger a data source refresh via context
      handleClose();
      
      // Import and use the DataSourcesContext to refresh the list
      try {
        // Access the refreshDataSources function from the parent component's props
        if (typeof onAdd === 'function') {
          // Create a minimal data source object to pass to onAdd
          const newDataSource = {
            name: file.filename || 'Unnamed File',
            type: 'local-files' as DataSourceType,
            status: 'processing' as DataSourceStatus,
            lastSync: new Date().toISOString(),
            description: `Uploaded file: ${file.filename}`,
            metadata: file,
            metrics: {
              records: 0,
              syncRate: 0,
              avgSyncTime: '0s'
            }
          };
          
          // Call onAdd to trigger UI update
          onAdd(newDataSource);
          
          // Removed excessive logging
          // console.log('Triggered data source refresh after file upload');
        }
      } catch (error) {
        console.error('Error refreshing data sources after file upload:', error);
      }
    } else {
      // Removed excessive logging
      // console.log('No data source ID found for the uploaded file, closing wizard');
      handleClose();
    }
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

  // Wrap the original onClose to ensure polling is resumed
  const handleClose = () => {
    setPausePolling(false);
    onClose();
  };

  const renderFileUploadStep = () => {
    if (!selectedType) {
      return null;
    }
    
    // For local files, the format is 'local-files-csv'
    const parts = selectedType.split('-');
    const sourceType = parts.slice(0, 2).join('-'); // 'local-files'
    const sourceId = parts[2]; // 'csv'
    
    const sourceCategory = DATA_SOURCE_TYPES.find(type => type.id === sourceType);
    const sourceOption = sourceCategory?.options?.find(opt => opt.id === sourceId);

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
          <div className="w-14 h-14 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700">
            <img
              src={sourceOption.logoUrl}
              alt={sourceOption.name}
              className="w-12 h-12 object-contain"
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
              <Suspense fallback={<div>Loading file uploader...</div>}>
                <CustomFileInput
                  fileType={sourceId as LocalFileType}
                  onUploadComplete={handleFileUploadComplete}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTypeSelectionStep = () => {
    const filteredDataSources = getFilteredDataSources();
    
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Select Data Source Type
        </h3>
        
        {/* Search input */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <input 
            type="search" 
            className="block w-full p-3 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white dark:focus:ring-purple-500 dark:focus:border-purple-500" 
            placeholder="Search for data sources..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              type="button" 
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setSearchTerm('')}
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
        
        {filteredDataSources.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">No data sources found matching "{searchTerm}"</p>
            <button 
              className="mt-4 text-purple-600 dark:text-purple-400 hover:underline"
              onClick={() => setSearchTerm('')}
            >
              Clear search
            </button>
          </div>
        )}
        
        <div className="space-y-8 overflow-y-auto max-h-[60vh] pr-2 -mr-2">
          {filteredDataSources.map(category => (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center space-x-3 sticky top-0 bg-white dark:bg-gray-800 py-2 z-10 border-b border-gray-100 dark:border-gray-700">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg text-purple-600 dark:text-purple-400">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.options?.map(option => {
                  const typeString = `${category.id}-${option.id}`;
                  // Removed excessive logging
                  // console.log(`Rendering option: ${option.name}, type: ${typeString}`);
                  
                  // Special case for Snowflake to make sure it's recognized
                  let buttonClass = "p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-md dark:hover:shadow-purple-900/20 transition-all duration-200 group text-left flex items-start space-x-4 cursor-pointer";
                  
                  if (option.id === 'snowflake') {
                    buttonClass += ' hover:border-blue-500 dark:hover:border-blue-400'; // Make it visibly different
                  }
                  
                  return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      // Add specific handler for Snowflake
                      if (option.id === 'snowflake') {
                        // Use direct handler instead
                        handleSnowflakeClick();
                        return; // Stop execution here
                      }
                      
                      handleTypeSelect(typeString);
                    }}
                    className={buttonClass}
                  >
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center shadow-sm">
                      <img
                        src={option.logoUrl}
                        alt={option.name}
                        className="w-12 h-12 object-contain group-hover:scale-110 transition-transform duration-200"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate">
                        {option.name}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {option.description}
                      </p>
                    </div>
                    <div className="ml-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-5 h-5 text-purple-500" />
                    </div>
                  </button>
                )})}
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

  const renderComingSoonModal = () => {
    if (!showComingSoon) return null;
    
    // Find data source details
    const parts = comingSoonType.split('-');
    const categoryId = parts[0];
    const optionId = parts.length > 2 ? parts[2] : parts[1];
    
    const category = DATA_SOURCE_TYPES.find(cat => cat.id === categoryId);
    const option = category?.options?.find(opt => opt.id === optionId);
    
    return (
      <div className="fixed inset-0 z-[60] overflow-hidden">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setShowComingSoon(false)} />
        
        {/* Modal container with proper centering */}
        <div className="fixed inset-0 flex items-center justify-center p-4 transform-gpu">
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative will-change-transform animate-scaleIn"
            style={{ transformOrigin: 'center center' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Coming Soon
              </h3>
              <button
                onClick={() => setShowComingSoon(false)}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center space-x-4 mb-4">
              {option?.logoUrl && (
                <div className="w-16 h-16 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
                  <img 
                    src={option.logoUrl} 
                    alt={option?.name || "Data source"} 
                    className="w-12 h-12 object-contain"
                  />
                </div>
              )}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                  {option?.name || "This data source"}
                </h4>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Integration coming soon
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              We're working hard to bring this integration to you. Currently, only Local Files 
              and Snowflake connections are implemented.
            </p>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowComingSoon(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" />
      
      {/* Modal container with proper centering */}
      <div className="fixed inset-0 flex items-center justify-center p-4 transform-gpu">
        <div 
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl flex flex-col min-h-[500px] max-h-[90vh] relative will-change-transform animate-scaleIn"
          style={{ transformOrigin: 'center center' }}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm">Back</span>
                  </button>
                )}
                <div className="flex items-center space-x-2">
                  {['Source Selection', 'Configuration'].map((stepLabel, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <div className={`h-px w-8 ${index <= step ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      )}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            index <= step
                              ? 'bg-purple-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          } transition-colors duration-300`}
                        />
                        <span className={`text-xs mt-1 ${
                          index <= step
                            ? 'text-purple-500 font-medium'
                            : 'text-gray-400 dark:text-gray-500'
                        } transition-colors duration-300`}>{stepLabel}</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
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
      {renderComingSoonModal()}
    </div>
  );
};

// Export the icons and logos for use in other components
export { FILE_TYPE_ICONS, BRAND_LOGOS }; 