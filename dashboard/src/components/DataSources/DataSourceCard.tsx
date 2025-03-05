import React from 'react';
import { DataSource, DataSourceStatus } from './types';
import { 
  FileText, 
  AlertCircle, 
  Database, 
  ExternalLink,
  RefreshCw, 
  Trash2,
  Clock,
  Cloud,
  MessageSquare,
  Briefcase
} from 'lucide-react';

// Constants for file type icons
const FILE_TYPE_ICONS = {
  csv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=',
  excel: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyMTk2NTMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==',
  pdf: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+',
  docx: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzNDk4REIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE2IDEzbC00IDZoLTRsNi05eiI+PC9wYXRoPjwvc3ZnPg==',
  json: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGNTlFMEIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg==',
};

// Database logos
const DATABASE_LOGOS = {
  ***REMOVED***ql: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg',
  mysql: 'https://img.icons8.com/?size=100&id=UFXRpPFebwa2&format=png&color=000000',
  mongodb: 'https://www.mongodb.com/assets/images/global/leaf.png',
  clickhouse: 'https://cdn.brandfetch.io/idnezyZEJm/w/625/h/625/theme/dark/icon.png?c=1dxbfHSJFAPEGdCLU4o5B',
  snowflake: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B',
  bigquery: '/images/google-bigquery-logo-1.svg',
  redshift: '/images/redshift_icon.svg',
  kafka: '/images/apache_kafka.svg',
  salesforce: 'https://www.salesforce.com/content/dam/sfdc-docs/www/logos/logo-salesforce.svg',
  sap: 'https://www.sap.com/dam/application/shared/logos/sap-logo-svg.svg',
  oracle: '/images/oracle.svg',
  workday: '/images/workday-seeklogo.svg'
};

interface DataSourceCardProps {
  source: DataSource;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
  onViewDetails?: (source: DataSource) => void;
}

export const DataSourceCard: React.FC<DataSourceCardProps> = ({ 
  source, 
  onRefresh, 
  onDelete,
  onViewDetails 
}) => {
  console.log('Rendering DataSourceCard for:', source.name, 'Type:', source.type, 'Metadata:', source.metadata);
  
  // Extract file type from metadata or source name
  const getFileTypeFromMetadata = () => {
    console.log('Extracting file type from metadata:', source.metadata);
    
    if (source.metadata?.filename) {
      // Remove timestamp suffix if present (e.g., filename_2025-03-05T08-31-45.417Z)
      const timestampRegex = /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
      const originalFilename = source.metadata.filename.replace(timestampRegex, '');
      console.log('Original filename (without timestamp):', originalFilename);
      
      // Extract extension from filename
      const lastDot = originalFilename.lastIndexOf('.');
      if (lastDot > 0) {
        const extension = originalFilename.substring(lastDot + 1).toLowerCase();
        console.log('Detected extension:', extension);
        
        // Map extension to file type
        if (extension === 'csv') return 'csv';
        if (['xlsx', 'xls'].includes(extension)) return 'excel';
        if (extension === 'pdf') return 'pdf';
        if (['docx', 'doc'].includes(extension)) return 'docx';
        if (extension === 'json') return 'json';
        
        return extension;
      }
    }
    
    // Fallback: try to extract from source name
    if (source.name) {
      if (source.name.toLowerCase().includes('csv')) return 'csv';
      if (source.name.toLowerCase().includes('xlsx') || source.name.toLowerCase().includes('xls')) return 'excel';
      if (source.name.toLowerCase().includes('pdf')) return 'pdf';
      if (source.name.toLowerCase().includes('docx') || source.name.toLowerCase().includes('doc')) return 'docx';
      if (source.name.toLowerCase().includes('json')) return 'json';
    }
    
    return null;
  };

  // Get file type from metadata
  const fileType = source.metadata?.fileType || getFileTypeFromMetadata();
  console.log('Determined file type for source:', fileType);

  // Get status color and animation
  const getStatusIndicator = () => {
    switch (source.status as DataSourceStatus) {
      case 'connected':
      case 'ready':
        return {
          color: 'bg-green-500',
          animation: '',
          tooltip: 'Ready'
        };
      case 'processing':
      case 'syncing':
        return {
          color: 'bg-blue-500',
          animation: '',
          tooltip: 'Processing'
        };
      case 'error':
        return {
          color: 'bg-red-500',
          animation: '',
          tooltip: 'Error'
        };
      case 'disconnected':
        return {
          color: 'bg-gray-400',
          animation: '',
          tooltip: 'Disconnected'
        };
      default:
        return {
          color: 'bg-yellow-500',
          animation: '',
          tooltip: source.status
        };
    }
  };

  const statusIndicator = getStatusIndicator();

  // Truncate long filenames
  const truncateFilename = (filename: string, maxLength: number = 20) => {
    if (!filename || filename.length <= maxLength) return filename;
    const extension = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = name.length > maxLength - 4 - (extension?.length || 0)
      ? `${name.substring(0, maxLength - 7 - (extension?.length || 0))}...`
      : name;
    return `${truncatedName}.${extension}`;
  };

  // Function to extract a clean display name without timestamps
  const extractBasicFilename = (fullname: string): string => {
    // Remove timestamp suffix if present (e.g., filename_2025-03-05T08-31-45.417Z)
    const timestampRegex = /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
    const nameWithoutTimestamp = fullname.replace(timestampRegex, '');
    
    // For paths, extract just the filename part
    const pathParts = nameWithoutTimestamp.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    return filename;
  };

  // Get display name with proper formatting
  const getDisplayName = () => {
    if (source.type === 'local-files') {
      if (source.metadata?.filename) {
        // Extract basic filename without timestamp
        const basicFilename = extractBasicFilename(source.metadata.filename as string);
        return truncateFilename(basicFilename, 25);
      }
      
      // Fallback to source name if no filename in metadata
      if (source.name) {
        const basicName = extractBasicFilename(source.name);
        return truncateFilename(basicName, 25);
      }
    }
    
    // For non-file sources or as fallback
    return source.name ? truncateFilename(source.name, 25) : 'Unknown Source';
  };

  // Use the new display name function
  const displayName = getDisplayName();
    
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Get descriptive text based on source type
  const getDescriptiveText = () => {
    if (source.type === 'local-files') {
      // For local files, extract and shorten the filename
      let filename = '';
      
      // Extract base filename without timestamp or extra info
      const extractBasicFilename = (fullFilename: string) => {
        // First remove any timestamp suffix
        // Pattern like: filename.ext_YYYY-MM-DDTHH-MM-SS.sssZ
        const timestampPattern = /(.+?)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
        const match = fullFilename.match(timestampPattern);
        
        let cleanName = match ? match[1] : fullFilename;
        
        // Then extract just the base filename without any path
        const pathSeparator = cleanName.lastIndexOf('/');
        if (pathSeparator !== -1) {
          cleanName = cleanName.substring(pathSeparator + 1);
        }
        
        return cleanName;
      };
      
      // Try to get filename from metadata
      if (source.metadata?.filename) {
        filename = extractBasicFilename(source.metadata.filename);
      } 
      // Fallback to using the source name if it looks like a filename
      else if (source.name && source.name.includes('.')) {
        filename = extractBasicFilename(source.name);
      }
      
      // Truncate the filename to keep it reasonably short
      const shortenedFilename = truncateFilename(filename, 25);
      
      console.log('Original filename:', filename, 'Shortened to:', shortenedFilename);
      return `File upload: ${shortenedFilename}`;
    }
    
    // For other types, use the description or fall back to type
    return source.description || `${source.type} data source`;
  };

  // Get the appropriate icon or logo
  const getSourceIcon = () => {
    console.log('Getting source icon for source:', source.name, 'Type:', source.type, 'FileType:', fileType);
    
    // For local files
    if (source.type === 'local-files') {
      // Special check for Word documents based on filename
      if (source.name.toLowerCase().includes('docx') || source.name.toLowerCase().includes('doc')) {
        console.log('Filename contains doc/docx, using Word icon');
        return <img src={FILE_TYPE_ICONS.docx} alt="Word document" className="w-8 h-8" />;
      }
      
      // Special check for Excel files based on filename
      if (source.name.toLowerCase().includes('xlsx') || source.name.toLowerCase().includes('xls')) {
        console.log('Filename contains xlsx/xls, using Excel icon');
        return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
      }
      
      // Special check for PDF files based on filename
      if (source.name.toLowerCase().includes('pdf')) {
        console.log('Filename contains pdf, using PDF icon');
        return <img src={FILE_TYPE_ICONS.pdf} alt="PDF file" className="w-8 h-8" />;
      }
      
      // Special check for CSV files based on filename
      if (source.name.toLowerCase().includes('csv')) {
        console.log('Filename contains csv, using CSV icon');
        return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
      }
      
      // Fallback icon if no file type is detected
      const defaultIcon = <FileText className="w-8 h-8 text-gray-600" />;
      
      if (!fileType) {
        console.log('No file type detected, using default icon');
        return defaultIcon;
      }
      
      console.log('Looking for icon for fileType:', fileType);
      
      // Handle Excel files
      if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'excel') {
        console.log('Using Excel icon');
        return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
      }
      
      // Handle Word documents
      if (fileType === 'docx' || fileType === 'doc') {
        console.log('Using Word icon');
        return <img src={FILE_TYPE_ICONS.docx} alt="Word document" className="w-8 h-8" />;
      }
      
      // Handle PDF files
      if (fileType === 'pdf') {
        console.log('Using PDF icon');
        return <img src={FILE_TYPE_ICONS.pdf} alt="PDF file" className="w-8 h-8" />;
      }
      
      // Handle CSV files
      if (fileType === 'csv') {
        console.log('Using CSV icon');
        return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
      }
      
      // Handle JSON files
      if (fileType === 'json') {
        console.log('Using JSON icon');
        return <img src={FILE_TYPE_ICONS.json} alt="JSON file" className="w-8 h-8" />;
      }
      
      // If we have an icon for this file type, use it
      if (FILE_TYPE_ICONS[fileType as keyof typeof FILE_TYPE_ICONS]) {
        console.log('Found matching icon in FILE_TYPE_ICONS');
        return <img 
          src={FILE_TYPE_ICONS[fileType as keyof typeof FILE_TYPE_ICONS]} 
          alt={`${fileType} file`} 
          className="w-8 h-8" 
        />;
      }
      
      console.log('No matching icon found, using default icon');
      return defaultIcon;
    } 
    // For databases
    else if (source.type === 'database') {
      const dbType = source.metadata && 'databaseType' in source.metadata 
        ? (source.metadata.databaseType as string)?.toLowerCase() 
        : undefined;
      
      console.log('Database type:', dbType);
      
      if (dbType && DATABASE_LOGOS[dbType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[dbType as keyof typeof DATABASE_LOGOS];
        console.log(`Database icon for ${dbType}:`, logoUrl);
        return <img src={logoUrl} alt={dbType} className="w-8 h-8" />;
      }
      return <Database className="w-8 h-8" />;
    }
    // For data warehouses
    else if (source.type === 'warehouse' || source.type === 'analytics') {
      const warehouseType = source.metadata && 'warehouseType' in source.metadata 
        ? (source.metadata.warehouseType as string)?.toLowerCase() 
        : undefined;
      
      console.log('Warehouse type:', warehouseType);
      
      if (warehouseType && DATABASE_LOGOS[warehouseType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[warehouseType as keyof typeof DATABASE_LOGOS];
        console.log(`Warehouse icon for ${warehouseType}:`, logoUrl);
        return <img src={logoUrl} alt={warehouseType} className="w-8 h-8" />;
      }
      return <Cloud className="w-8 h-8" />;
    }
    // For streaming services
    else if (source.type === 'storage') {
      const streamingType = source.metadata && 'streamingType' in source.metadata 
        ? (source.metadata.streamingType as string)?.toLowerCase() 
        : undefined;
      
      console.log('Streaming type:', streamingType);
      
      if (streamingType && DATABASE_LOGOS[streamingType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[streamingType as keyof typeof DATABASE_LOGOS];
        console.log(`Streaming icon for ${streamingType}:`, logoUrl);
        return <img src={logoUrl} alt={streamingType} className="w-8 h-8" />;
      }
      return <MessageSquare className="w-8 h-8" />;
    }
    // For business applications
    else if (source.type === 'crm' || source.type === 'crm-hubspot' || source.type === 'sap') {
      const appType = source.metadata && 'appType' in source.metadata 
        ? (source.metadata.appType as string)?.toLowerCase() 
        : undefined;
      
      console.log('Business app type:', appType);
      
      if (appType && DATABASE_LOGOS[appType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[appType as keyof typeof DATABASE_LOGOS];
        console.log(`Business app icon for ${appType}:`, logoUrl);
        return <img src={logoUrl} alt={appType} className="w-8 h-8" />;
      }
      return <Briefcase className="w-8 h-8" />;
    }
    
    console.log('Using default Database icon for type:', source.type);
    // Default fallback
    return <Database className="w-8 h-8" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-subtle rounded-lg card-border overflow-hidden flex flex-col h-full card-hover-effect">
      {/* Card Header */}
      <div className="p-4 flex items-start space-x-3">
        <div className="w-10 h-10 flex-shrink-0 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
          {getSourceIcon()}
                          </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate" title={source.name}>
              {displayName}
            </h3>
            <div className="relative ml-2 group">
              <div className={`w-2.5 h-2.5 rounded-full ${statusIndicator.color} ${statusIndicator.animation} ring-2 ring-white dark:ring-gray-800`} 
                   title={statusIndicator.tooltip}></div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-subtle">
                {statusIndicator.tooltip}
                        </div>
                      </div>
                  </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={getDescriptiveText()}>
            {getDescriptiveText()}
          </p>
          
          {source.lastSync && (
            <div className="flex items-center mt-2 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              <span>Updated {formatDate(source.lastSync)}</span>
            </div>
          )}
          
          {/* Error Message - Inline */}
          {source.metrics?.lastError && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-start space-x-1.5">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-1">
                {typeof source.metrics.lastError === 'string' 
                  ? source.metrics.lastError 
                  : (source.metrics.lastError as { message: string }).message}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Card Footer - Actions */}
      <div className="mt-auto p-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <button
          onClick={() => onViewDetails?.(source)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Details</span>
        </button>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => source.id && onRefresh(source.id)}
            disabled={source.status === 'processing'}
            className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${source.status === 'processing' ? 'animate-spin' : ''}`} />
          </button>
          
              <button
            onClick={() => source.id && onDelete(source.id)}
          disabled={source.status === 'processing'}
            className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete"
              >
            <Trash2 className="w-3.5 h-3.5" />
              </button>
        </div>
            </div>
          </div>
  );
}; 