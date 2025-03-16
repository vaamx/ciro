import React, { useCallback, useMemo } from 'react';
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
  csv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0MzU1QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRUJGMkZGIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=',
  excel: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxRTZGNDkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRTNGNUVDIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==',
  pdf: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNEQzI2MjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRkVFMkUyIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+',
  docx: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjREJFQUZFIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE2IDEzbC00IDZoLTRsNi05eiI+PC9wYXRoPjwvc3ZnPg==',
  json: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNEOTdGMDYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRkVGM0M3Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg==',
  snowflake: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkwxMiAxNiIgc3Ryb2tlPSIjMjI5MEVBIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0yMiAxMkwyIDE2IiBzdHJva2U9IiMyMjkwRUEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTIyIDE2TDIgMTIiIHN0cm9rZT0iIzIyOTBFQSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTIgMjJMMTIgOCIgc3Ryb2tlPSIjMjI5MEVBIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik01IDdMMTkgMTciIHN0cm9rZT0iIzIyOTBFQSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTkgN0w1IDE3IiBzdHJva2U9IiMyMjkwRUEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjMjI5MEVBIi8+PHBhdGggZD0iTTEyIDIwQzEzLjEwNDYgMjAgMTQgMTkuMTA0NiAxNCAxOEMxNCAxNi44OTU0IDEzLjEwNDYgMTYgMTIgMTZDMTAuODk1NCAxNiAxMCAxNi44OTU0IDEwIDE4QzEwIDE5LjEwNDYgMTAuODk1NCAyMCAxMiAyMFoiIGZpbGw9IiMyMjkwRUEiLz48L3N2Zz4='
};

// Database logos
const DATABASE_LOGOS = {
  ***REMOVED***ql: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg',
  mysql: 'https://www.mysql.com/common/logos/logo-mysql-170x115.png',
  mongodb: 'https://www.mongodb.com/assets/images/global/leaf.png',
  clickhouse: 'https://cdn.worldvectorlogo.com/logos/clickhouse.svg',
  snowflake: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B',
  bigquery: 'https://cdn.worldvectorlogo.com/logos/google-bigquery-logo-1.svg',
  redshift: 'https://d2908q01vomqb2.cloudfront.net/887309d048beef83ad3eabf2a79a64a389ab1c9f/2019/11/26/redshift-logo.png',
  kafka: 'https://cdn.worldvectorlogo.com/logos/apache-kafka.svg',
  salesforce: 'https://www.salesforce.com/content/dam/sfdc-docs/www/logos/logo-salesforce.svg',
  sap: 'https://www.sap.com/dam/application/shared/logos/sap-logo-svg.svg',
  oracle: 'https://cdn.worldvectorlogo.com/logos/oracle-6.svg',
  workday: 'https://cdn.worldvectorlogo.com/logos/workday-logo.svg'
};

interface DataSourceCardProps {
  source: DataSource;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
  onViewDetails?: (source: DataSource) => void;
}

// Create a base component that will be wrapped with React.memo
const DataSourceCardBase: React.FC<DataSourceCardProps> = ({ 
  source, 
  onRefresh, 
  onDelete,
  onViewDetails 
}) => {
  // Use useCallback for event handlers to prevent unnecessary re-renders
  const handleRefresh = useCallback(() => {
    if (source.id) {
      onRefresh(source.id);
    }
  }, [onRefresh, source.id]);

  const handleDelete = useCallback(() => {
    if (source.id) {
      onDelete(source.id);
    }
  }, [onDelete, source.id]);

  const handleViewDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails(source);
    }
  }, [onViewDetails, source]);

  // Define all helper functions first
  const getFileTypeFromMetadata = () => {
    // Removed log: console.log('Extracting file type from metadata:', source.metadata);
    
    if (source.metadata?.filename) {
      // Remove timestamp suffix if present (e.g., filename_2025-03-05T08-31-45.417Z)
      const timestampRegex = /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
      const originalFilename = source.metadata.filename.replace(timestampRegex, '');
      // Removed log: console.log('Original filename (without timestamp):', originalFilename);
      
      // Extract extension from filename
      const lastDot = originalFilename.lastIndexOf('.');
      if (lastDot > 0) {
        const extension = originalFilename.substring(lastDot + 1).toLowerCase();
        // Removed log: console.log('Detected extension:', extension);
        
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
          animation: 'animate-pulse',
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
  
  const getIndexingStatus = () => {
    if (!source.metadata) return null;
    
    try {
      // Extract indexing_status from metadata
      const metadata = typeof source.metadata === 'string' 
        ? JSON.parse(source.metadata) 
        : source.metadata;
      
      // If metadata exists but no indexing_status, create initial status for certain types
      if (!metadata.indexing_status && ['snowflake', 'database'].includes(source.type)) {
        return {
          progress: 0,
          message: 'Preparing to index data...',
          currentTable: '',
          lastUpdated: new Date().toISOString()
        };
      }
      
      const indexingStatus = metadata.indexing_status;
      
      if (!indexingStatus) return null;
      
      return {
        progress: indexingStatus.progress || 0,
        message: indexingStatus.message || 'Processing data...',
        currentTable: indexingStatus.current_table || '',
        lastUpdated: indexingStatus.last_updated
      };
    } catch (e) {
      console.error('Error parsing indexing status:', e);
      return null;
    }
  };

  const truncateFilename = (filename: string, maxLength: number = 20) => {
    if (!filename || filename.length <= maxLength) return filename;
    const extension = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = name.length > maxLength - 4 - (extension?.length || 0)
      ? `${name.substring(0, maxLength - 7 - (extension?.length || 0))}...`
      : name;
    return `${truncatedName}.${extension}`;
  };

  const extractBasicFilename = (fullname: string): string => {
    // Remove timestamp suffix if present (e.g., filename_2025-03-05T08-31-45.417Z)
    const timestampRegex = /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
    const nameWithoutTimestamp = fullname.replace(timestampRegex, '');
    
    // For paths, extract just the filename part
    const pathParts = nameWithoutTimestamp.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    return filename;
  };

  const getDisplayName = () => {
    if (source.type === 'local-files' || source.type.includes('local-files')) {
      // First try to get the original filename from metadata
      if (source.metadata?.originalFilename) {
        const basicFilename = extractBasicFilename(source.metadata.originalFilename as string);
        console.log('Using originalFilename from metadata:', basicFilename);
        return truncateFilename(basicFilename, 25);
      }
      
      // Then try the filename in metadata
      if (source.metadata?.filename) {
        // Extract basic filename without timestamp
        const basicFilename = extractBasicFilename(source.metadata.filename as string);
        console.log('Using filename from metadata:', basicFilename);
        return truncateFilename(basicFilename, 25);
      }
      
      // Fallback to source name if no filename in metadata
      if (source.name) {
        const basicName = extractBasicFilename(source.name);
        console.log('Using source name as fallback:', basicName);
        return truncateFilename(basicName, 25);
      }
    }
    
    // For non-file sources or as fallback
    return source.name ? truncateFilename(source.name, 25) : 'Unknown Source';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

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

  const getSourceIcon = () => {
    console.log('Getting source icon for:', source.type, 'Metadata:', source.metadata);
    
    // First check for Excel files regardless of source type
    if (source.metadata?.fileType && 
        (source.metadata.fileType.toString().toLowerCase() === 'excel' || 
         source.metadata.fileType.toString().toLowerCase() === 'xlsx' || 
         source.metadata.fileType.toString().toLowerCase() === 'xls')) {
      console.log('Found Excel fileType, using Excel icon');
      return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
    }
    
    // Also check filename extension for Excel files
    if (source.metadata?.filename && 
        (source.metadata.filename.toLowerCase().endsWith('.xlsx') || 
         source.metadata.filename.toLowerCase().endsWith('.xls'))) {
      console.log('Found Excel extension, using Excel icon');
      return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
    }
    
    // Check for CSV files (keep the existing code)
    if (source.metadata?.fileType && source.metadata.fileType.toString().toLowerCase() === 'csv') {
      console.log('Found CSV fileType, using CSV icon');
      return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
    }
    
    // Also check filename extension for CSV
    if (source.metadata?.filename && source.metadata.filename.toLowerCase().endsWith('.csv')) {
      console.log('Found CSV extension, using CSV icon');
      return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
    }
    
    // Then continue with the existing source.type checks
    // For local files
    if (source.type === 'local-files') {
      // First check the fileType in metadata directly
      if (source.metadata?.fileType) {
        const metadataFileType = source.metadata.fileType.toLowerCase();
        console.log('Found fileType in metadata:', metadataFileType);
        
        // Check for CSV files in metadata
        if (metadataFileType === 'csv') {
          console.log('Using CSV icon from metadata fileType');
          return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
        }
        
        // Check for Excel files in metadata
        if (['xlsx', 'xls', 'excel'].includes(metadataFileType)) {
          console.log('Using Excel icon from metadata fileType');
          return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
        }
        
        // Check for PDF files in metadata
        if (metadataFileType === 'pdf') {
          console.log('Using PDF icon from metadata fileType');
          return <img src={FILE_TYPE_ICONS.pdf} alt="PDF file" className="w-8 h-8" />;
        }
        
        // Check for Word files in metadata
        if (['docx', 'doc', 'word'].includes(metadataFileType)) {
          console.log('Using Word icon from metadata fileType');
          return <img src={FILE_TYPE_ICONS.docx} alt="Word document" className="w-8 h-8" />;
        }
        
        // Check for JSON files in metadata
        if (metadataFileType === 'json') {
          console.log('Using JSON icon from metadata fileType');
          return <img src={FILE_TYPE_ICONS.json} alt="JSON file" className="w-8 h-8" />;
        }
      }
      
      // Check original filename in metadata
      if (source.metadata?.filename) {
        const filename = source.metadata.filename.toLowerCase();
        
        if (filename.endsWith('.csv')) {
          console.log('Using CSV icon from filename extension');
          return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
        }
        
        if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
          console.log('Using Excel icon from filename extension');
          return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
        }
        
        if (filename.endsWith('.pdf')) {
          console.log('Using PDF icon from filename extension');
          return <img src={FILE_TYPE_ICONS.pdf} alt="PDF file" className="w-8 h-8" />;
        }
        
        if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
          console.log('Using Word icon from filename extension');
          return <img src={FILE_TYPE_ICONS.docx} alt="Word document" className="w-8 h-8" />;
        }
        
        if (filename.endsWith('.json')) {
          console.log('Using JSON icon from filename extension');
          return <img src={FILE_TYPE_ICONS.json} alt="JSON file" className="w-8 h-8" />;
        }
      }
      
      // Special check for Word documents based on filename
      if (source.name.toLowerCase().includes('docx') || source.name.toLowerCase().includes('doc')) {
        return <img src={FILE_TYPE_ICONS.docx} alt="Word document" className="w-8 h-8" />;
      }
      
      // Special check for Excel files based on filename
      if (source.name.toLowerCase().includes('xlsx') || source.name.toLowerCase().includes('xls')) {
        return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
      }
      
      // Special check for PDF files based on filename
      if (source.name.toLowerCase().includes('pdf')) {
        return <img src={FILE_TYPE_ICONS.pdf} alt="PDF file" className="w-8 h-8" />;
      }
      
      // Special check for CSV files based on filename
      if (source.name.toLowerCase().includes('csv')) {
        return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
      }
      
      // Fallback icon if no file type is detected
      const defaultIcon = <FileText className="w-8 h-8 text-gray-600" />;
      
      if (!fileType) {
        return defaultIcon;
      }
      
      // Handle Excel files
      if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'excel') {
        return <img src={FILE_TYPE_ICONS.excel} alt="Excel file" className="w-8 h-8" />;
      }
      
      // Handle PDF files
      if (fileType === 'pdf') {
        return <img src={FILE_TYPE_ICONS.pdf} alt="PDF file" className="w-8 h-8" />;
      }
      
      // Handle Word files
      if (fileType === 'docx' || fileType === 'doc' || fileType === 'word') {
        return <img src={FILE_TYPE_ICONS.docx} alt="Word file" className="w-8 h-8" />;
      }
      
      // Handle CSV files
      if (fileType === 'csv') {
        return <img src={FILE_TYPE_ICONS.csv} alt="CSV file" className="w-8 h-8" />;
      }
      
      // Handle JSON files
      if (fileType === 'json') {
        return <img src={FILE_TYPE_ICONS.json} alt="JSON file" className="w-8 h-8" />;
      }
      
      // If we have an icon for this file type, use it
      if (FILE_TYPE_ICONS[fileType as keyof typeof FILE_TYPE_ICONS]) {
        return <img 
          src={FILE_TYPE_ICONS[fileType as keyof typeof FILE_TYPE_ICONS]} 
          alt={`${fileType} file`} 
          className="w-8 h-8" 
        />;
      }
      
      return defaultIcon;
    } 
    // For databases
    else if (source.type === 'database') {
      const dbType = source.metadata && 'databaseType' in source.metadata 
        ? (source.metadata.databaseType as string)?.toLowerCase() 
        : undefined;
      
      // Removed log: console.log('Database type:', dbType);
      
      if (dbType && DATABASE_LOGOS[dbType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[dbType as keyof typeof DATABASE_LOGOS];
        // Removed log: console.log(`Database icon for ${dbType}:`, logoUrl);
        return <img src={logoUrl} alt={dbType} className="w-8 h-8" />;
      }
      return <Database className="w-8 h-8" />;
    }
    // For data warehouses
    else if (source.type === 'warehouse' || source.type === 'analytics') {
      const warehouseType = source.metadata && 'warehouseType' in source.metadata 
        ? (source.metadata.warehouseType as string)?.toLowerCase() 
        : undefined;
      
      // Removed log: console.log('Warehouse type:', warehouseType);
      
      if (warehouseType && DATABASE_LOGOS[warehouseType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[warehouseType as keyof typeof DATABASE_LOGOS];
        // Removed log: console.log(`Warehouse icon for ${warehouseType}:`, logoUrl);
        return <img src={logoUrl} alt={warehouseType} className="w-8 h-8" />;
      }
      return <Cloud className="w-8 h-8" />;
    }
    // For streaming services
    else if (source.type === 'storage') {
      const streamingType = source.metadata && 'streamingType' in source.metadata 
        ? (source.metadata.streamingType as string)?.toLowerCase() 
        : undefined;
      
      // Removed log: console.log('Streaming type:', streamingType);
      
      if (streamingType && DATABASE_LOGOS[streamingType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[streamingType as keyof typeof DATABASE_LOGOS];
        // Removed log: console.log(`Streaming icon for ${streamingType}:`, logoUrl);
        return <img src={logoUrl} alt={streamingType} className="w-8 h-8" />;
      }
      return <MessageSquare className="w-8 h-8" />;
    }
    // For business applications
    else if (source.type === 'crm' || source.type === 'crm-hubspot' || source.type === 'sap') {
      const appType = source.metadata && 'appType' in source.metadata 
        ? (source.metadata.appType as string)?.toLowerCase() 
        : undefined;
      
      // Removed log: console.log('Business app type:', appType);
      
      if (appType && DATABASE_LOGOS[appType as keyof typeof DATABASE_LOGOS]) {
        const logoUrl = DATABASE_LOGOS[appType as keyof typeof DATABASE_LOGOS];
        // Removed log: console.log(`Business app icon for ${appType}:`, logoUrl);
        return <img src={logoUrl} alt={appType} className="w-8 h-8" />;
      }
      return <Briefcase className="w-8 h-8" />;
    }
    // For Snowflake data sources
    else if (source.type === 'snowflake') {
      // Removed log: console.log('Using Snowflake icon');
      return <img src={DATABASE_LOGOS.snowflake} alt="Snowflake" className="w-8 h-8" />;
    }
    
    console.log('Using default Database icon for type:', source.type);
    // Default fallback
    return <Database className="w-8 h-8" />;
  };

  // Now use useMemo with the functions already defined
  const fileType = useMemo(() => getFileTypeFromMetadata(), [source.metadata]);
  const statusIndicator = useMemo(() => getStatusIndicator(), [source.status]);
  const indexingStatus = useMemo(() => getIndexingStatus(), [source.status, source.metrics]);
  const displayName = useMemo(() => getDisplayName(), [source.name, source.metadata]);
  const descriptiveText = useMemo(() => getDescriptiveText(), [source.description, source.metadata]);
  const sourceIcon = useMemo(() => getSourceIcon(), [source.type, fileType]);

  // Removed log: console.log('Rendering DataSourceCard for:', source.name, 'Type:', source.type, 'Metadata:', source.metadata);
  
  // Show progress bar even when status is 'connected' for newly created sources
  // We'll use lastSync to determine if it's a new source (if it doesn't have a lastSync date)
  const isProcessing = 
    ['processing', 'syncing'].includes(source.status as string) || 
    (['connected', 'ready'].includes(source.status as string) && !source.lastSync && indexingStatus);

  return (
    <div className="bg-white dark:bg-gray-800 shadow-subtle rounded-lg card-border overflow-hidden flex flex-col h-full card-hover-effect">
      {/* Card Header */}
      <div className="p-4 flex items-start space-x-3">
        <div className="w-10 h-10 flex-shrink-0 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
          {sourceIcon}
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

          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={descriptiveText}>
            {descriptiveText}
          </p>
          
          {source.lastSync && (
            <div className="flex items-center mt-2 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              <span>Updated {formatDate(source.lastSync)}</span>
            </div>
          )}
          
          {/* Indexing Progress Bar - Show when processing and has progress info */}
          {isProcessing && indexingStatus && (
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {indexingStatus.message}
                </span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {indexingStatus.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${indexingStatus.progress}%` }}
                ></div>
              </div>
              {indexingStatus.currentTable && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                  Table: {indexingStatus.currentTable}
                </p>
              )}
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
          onClick={handleViewDetails}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Details</span>
        </button>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${source.status === 'processing' ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleDelete}
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

// Custom equality function for React.memo
// Only re-render if important properties change
const areEqual = (prevProps: DataSourceCardProps, nextProps: DataSourceCardProps) => {
  // Compare the important properties that would affect rendering
  return (
    prevProps.source.id === nextProps.source.id &&
    prevProps.source.name === nextProps.source.name &&
    prevProps.source.status === nextProps.source.status &&
    prevProps.source.lastSync === nextProps.source.lastSync &&
    prevProps.source.description === nextProps.source.description &&
    // For metrics, only compare the properties we display
    prevProps.source.metrics.records === nextProps.source.metrics.records &&
    prevProps.source.metrics.syncRate === nextProps.source.metrics.syncRate &&
    prevProps.source.metrics.avgSyncTime === nextProps.source.metrics.avgSyncTime &&
    (prevProps.source.metrics.lastError === nextProps.source.metrics.lastError)
  );
};

// Export the memoized component
export const DataSourceCard = React.memo(DataSourceCardBase, areEqual); 