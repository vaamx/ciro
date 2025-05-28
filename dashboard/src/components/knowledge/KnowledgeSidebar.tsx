import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useKnowledge } from '../../providers/KnowledgeProvider';
import { logger } from '../../utils/logger';
import { 
  BookOpen, X, FileText, Star, 
  ChevronDown, ChevronRight, CheckCircle,
  Clock3, RefreshCw, FileCode,
  Database, File,
  Folder, FolderOpen, ArrowRight
} from 'lucide-react';

// Debug helper function for component
const debug = (message: string, ...args: any[]) => {
  console.log(`[KnowledgeSidebar] ${message}`, ...args);
};

// Default icons for different file types
const DEFAULT_ICONS: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  doc: '📝',
  xlsx: '📊',
  xls: '📊',
  csv: '📋',
  json: '📋',
  txt: '📝',
  md: '📘',
  html: '🌐',
  js: '⚙️',
  ts: '⚙️',
  css: '🎨',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🎬',
  zip: '📦',
  api: '🔌',
  unknown: '📁'
};

// Try to import FILE_TYPE_ICONS, but use enhanced fallback if not available
let FILE_TYPE_ICONS: Record<string, string>;
try {
  FILE_TYPE_ICONS = require('../DataSources/AddDataSourceWizard').FILE_TYPE_ICONS;
  if (!FILE_TYPE_ICONS) {
    throw new Error('FILE_TYPE_ICONS is undefined');
  }
} catch (e) {
  console.warn('FILE_TYPE_ICONS not found, using enhanced fallbacks');
  FILE_TYPE_ICONS = DEFAULT_ICONS;
}

// Component name for logging
const COMPONENT_NAME = 'KnowledgeSidebar';

interface KnowledgeSidebarProps {
  onItemSelect?: (dataSource: any) => void;
  isMobile?: boolean;
}

// Define data source type groups with available icons
const DATA_SOURCE_TYPES: Record<string, { icon: string, label: string, color: string }> = {
  // File types
  excel: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxRTZGNDkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRTNGNUVDIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==', 
    label: 'Excel Files', 
    color: 'text-green-600 dark:text-green-400' 
  },
  csv: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0MzU1QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRUJGMkZGIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=', 
    label: 'CSV Files', 
    color: 'text-blue-600 dark:text-blue-400' 
  },
  pdf: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNEQzI2MjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRkVFMkUyIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+', 
    label: 'PDF Documents', 
    color: 'text-red-600 dark:text-red-400' 
  },
  docx: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjREJFQUZFIj48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE2IDEzbC00IDZoLTRsNi05eiI+PC9wYXRoPjwvc3ZnPg==', 
    label: 'Word Documents', 
    color: 'text-blue-700 dark:text-blue-300' 
  },
  txt: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QjcyODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRjNGNEY2Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxsaW5lIHgxPSI4IiB5MT0iOSIgeDI9IjE2IiB5Mj0iOSI+PC9saW5lPjwvc3ZnPg==', 
    label: 'Text Files', 
    color: 'text-gray-600 dark:text-gray-300' 
  },
  json: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNEOTdGMDYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6IiBmaWxsPSIjRkVGM0M3Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg==', 
    label: 'JSON Files', 
    color: 'text-yellow-600 dark:text-yellow-300' 
  },
  
  // Database types
  postgresql: { 
    icon: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg', 
    label: 'PostgreSQL', 
    color: 'text-blue-500 dark:text-blue-300' 
  },
  mysql: { 
    icon: 'https://www.mysql.com/common/logos/logo-mysql-170x115.png', 
    label: 'MySQL', 
    color: 'text-orange-500 dark:text-orange-300' 
  },
  snowflake: { 
    icon: 'https://cdn.brandfetch.io/idJz-fGD_q/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B', 
    label: 'Snowflake', 
    color: 'text-blue-300 dark:text-blue-200' 
  },
  mongodb: { 
    icon: 'https://www.mongodb.com/assets/images/global/leaf.png', 
    label: 'MongoDB', 
    color: 'text-green-500 dark:text-green-300' 
  },
  
  // Other types
  api: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4QjVDRjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTggMTBoLTRNMTQgMTRoLTRNNiAxMGgyTTEwIDE0aDJNOSA3djEwIj48L3BhdGg+PHJlY3Qgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB4PSIzIiB5PSIzIiByeD0iMiIgcnk9IjIiPjwvcmVjdD48L3N2Zz4=', 
    label: 'API Sources', 
    color: 'text-purple-500 dark:text-purple-300' 
  },
  other: { 
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QjcyODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PC9zdmc+', 
    label: 'Other Sources', 
    color: 'text-gray-500 dark:text-gray-300' 
  }
};

export const KnowledgeSidebar: React.FC<KnowledgeSidebarProps> = ({
  onItemSelect,
  isMobile = false
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const { 
    activeSource, 
    setActiveSource, 
    sources, 
    isLoading, 
    fetchDataSources 
  } = useKnowledge();
  
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'All Files': true
  });
  
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'recent' | 'starred'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Group data sources by file type
  const getDataSourcesByType = useCallback(() => {
    if (!sources || sources.length === 0) {
      return {};
    }

    const groupedSources: Record<string, any[]> = {};
    
    sources.forEach(source => {
      // Determine file type from metadata or extension
      let fileType = 'other';
      
      // Try to get file type from metadata or name
      const sourceAny = source as any;
      if (sourceAny.metadata && sourceAny.metadata.fileType) {
        fileType = sourceAny.metadata.fileType.toLowerCase();
      } else if (source.name) {
        // For names like "file.docx_2025-03-05T08-31-45.417Z", extract the actual extension
        
        // First, check for common file extensions patterns in the name
        const extensionMatches = source.name.match(/\.(csv|xlsx?|docx?|pdf|txt|json)/i);
        if (extensionMatches && extensionMatches[1]) {
          fileType = extensionMatches[1].toLowerCase();
        } else {
          // Fallback to original method
          const nameParts = source.name.split('.');
          if (nameParts.length > 1) {
            fileType = nameParts[nameParts.length - 1].toLowerCase();
          }
        }
        
        // For Qdrant Collections with timestamp names like "file.csv_2025-03-05T09-40-28.773Z"
        const timestampMatch = source.name.match(/\.(csv|xlsx?|docx?|pdf|txt|json)_\d{4}-\d{2}-\d{2}/i);
        if (timestampMatch && timestampMatch[1]) {
          fileType = timestampMatch[1].toLowerCase();
        }
      }
      
      // Set file type based on type mapping
      let normalizedType: string;
      
      // Map to normalized type
      if (['xlsx', 'xls', 'xlsm'].includes(fileType)) {
        normalizedType = 'excel';
      } else if (['csv', 'tsv'].includes(fileType)) {
        normalizedType = 'csv';
      } else if (['pdf'].includes(fileType)) {
        normalizedType = 'pdf';
      } else if (['doc', 'docx', 'rtf'].includes(fileType)) {
        normalizedType = 'docx';
      } else if (['txt', 'text'].includes(fileType)) {
        normalizedType = 'txt';
      } else if (['json', 'jsonl'].includes(fileType)) {
        normalizedType = 'json';
      } else if (sourceAny.type && sourceAny.type.includes && sourceAny.type.includes('***REMOVED***')) {
        normalizedType = '***REMOVED***';
      } else if (sourceAny.type && sourceAny.type.includes && sourceAny.type.includes('mysql')) {
        normalizedType = 'mysql';
      } else if (sourceAny.type && sourceAny.type.includes && sourceAny.type.includes('snowflake')) {
        normalizedType = 'snowflake';
      } else if (sourceAny.type && sourceAny.type.includes && sourceAny.type.includes('mongodb')) {
        normalizedType = 'mongodb';
      } else if (sourceAny.type && sourceAny.type.includes && sourceAny.type.includes('api')) {
        normalizedType = 'api';
      } else {
        normalizedType = 'other';
      }
      
      if (!groupedSources[normalizedType]) {
        groupedSources[normalizedType] = [];
      }
      
      groupedSources[normalizedType].push(source);
    });
    
    return groupedSources;
  }, [sources]);
  
  // Load data sources on component mount
  useEffect(() => {
    fetchDataSources();
    
    // Expand all folders by default
    const groups = getDataSourcesByType();
    const newExpandedState: Record<string, boolean> = {};
    Object.keys(groups).forEach(type => {
      newExpandedState[type] = true;
    });
    setExpandedFolders(newExpandedState);
  }, [fetchDataSources, getDataSourcesByType]);
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setIsSearchActive(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearchActive(true);
    performSearch(query);
  };
  
  // Perform search
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    setIsSearchActive(true);
    
    try {
      // Search through available data sources
      const filteredSources = sources.filter(source => {
        const sourceAny = source as any;
        return source.name.toLowerCase().includes(query.toLowerCase()) ||
          (sourceAny.description && sourceAny.description.toLowerCase().includes(query.toLowerCase()));
      });
      
      setSearchResults(filteredSources);
    } catch (error) {
      logger.error(COMPONENT_NAME, 'Error searching:', error);
    } finally {
      setIsSearchActive(true); // Keep search active after results are loaded
    }
  };
  
  // Determine data source type from file extension or metadata
  const determineDataSourceType = (source: any): string => {
    // Log the source object to help with debugging
    logger.debug(COMPONENT_NAME, 'Determining data source type for:', source);
    
    // If source has a type property, use it
    if (source.type) {
      logger.debug(COMPONENT_NAME, `Using provided type: ${source.type}`);
      return source.type.toLowerCase();
    }
    
    // If source has a file extension, use it to determine type
    if (source.name) {
      const fileName = source.name;
      logger.debug(COMPONENT_NAME, `Examining file name: ${fileName}`);
      
      // Extract file extension
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      logger.info(COMPONENT_NAME, `Extracted file extension: ${fileExtension}`);
      
      if (fileExtension) {
        // Map common file extensions to data source types
        const extensionMap: Record<string, string> = {
          'csv': 'csv',
          'xlsx': 'excel',
          'xls': 'excel',
          'pdf': 'pdf',
          'docx': 'docx',
          'doc': 'docx',
          'txt': 'txt',
          'json': 'json',
          'md': 'txt',
          'sql': 'database'
        };
        
        if (extensionMap[fileExtension]) {
          const mappedType = extensionMap[fileExtension];
          logger.info(COMPONENT_NAME, `Mapped file extension to type: ${mappedType}`);
          return mappedType;
        }
      }
      
      // If we couldn't determine from extension, try to detect from filename patterns
      if (fileName.includes('_')) {
        const parts = fileName.split('_');
        if (parts.length > 0) {
          const possibleType = parts[0].toLowerCase();
          if (['csv', 'excel', 'pdf', 'document', 'text', 'json', 'database'].includes(possibleType)) {
            logger.info(COMPONENT_NAME, `Detected type from filename pattern: ${possibleType}`);
            return possibleType;
          }
        }
      }
    }
    
    // If source has a format property, use it
    if (source.format) {
      logger.debug(COMPONENT_NAME, `Using format property: ${source.format}`);
      return source.format.toLowerCase();
    }
    
    // If source has metadata, try to extract type information
    if (source.metadata) {
      if (source.metadata.type) {
        logger.debug(COMPONENT_NAME, `Using type from metadata: ${source.metadata.type}`);
        return source.metadata.type.toLowerCase();
      }
      if (source.metadata.format) {
        logger.debug(COMPONENT_NAME, `Using format from metadata: ${source.metadata.format}`);
        return source.metadata.format.toLowerCase();
      }
      if (source.metadata.mimeType) {
        const mimeType = source.metadata.mimeType.toLowerCase();
        logger.debug(COMPONENT_NAME, `Found MIME type: ${mimeType}`);
        
        // Map MIME types to data source types
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType.includes('csv')) return 'csv';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
        if (mimeType.includes('text')) return 'text';
        if (mimeType.includes('json')) return 'json';
      }
    }
    
    // Default to 'unknown' if we can't determine the type
    logger.warn(COMPONENT_NAME, 'Could not determine data source type, defaulting to "unknown"');
    return 'unknown';
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearchActive(false);
    setSearchResults([]);
  };
  
  // Handle data source selection
  const handleDataSourceSelect = (source: any) => {
    // Determine the data source type
    const dataSourceType = determineDataSourceType(source);
    
    // Enhance the source object with the determined type if it doesn't already have one
    const enhancedSource = {
      ...source,
      dataSourceType: source.dataSourceType || dataSourceType
    };
    
    logger.info(COMPONENT_NAME, `Selecting data source: ${enhancedSource.id} - ${enhancedSource.name} (Type: ${enhancedSource.dataSourceType})`);
    
    // Set the active source with the enhanced source that includes dataSourceType
    setActiveSource(enhancedSource);
    
    // Pass the enhanced source to the parent component
    if (onItemSelect) {
      logger.debug(COMPONENT_NAME, `Calling onItemSelect with enhanced source:`, enhancedSource);
      onItemSelect(enhancedSource);
    }
  };
  
  // Toggle folder expansion
  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };
  
  // Get icon for data source type
  const getDataSourceTypeIcon = (type: string) => {
    const typeInfo = DATA_SOURCE_TYPES[type as keyof typeof DATA_SOURCE_TYPES] || DATA_SOURCE_TYPES.other;
    
    if (typeInfo.icon) {
      return (
        <div className={`flex-shrink-0 ${typeInfo.color}`}>
          <img src={typeInfo.icon} alt={typeInfo.label} className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
        </div>
      );
    }
    
    // Fallback to Lucide icons
    switch (type) {
      case '***REMOVED***':
      case 'mysql':
      case 'mongodb':
        return <Database className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-blue-500 dark:text-blue-300`} />;
      case 'api':
        return <FileCode className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-purple-600 dark:text-purple-400`} />;
      default:
        return <File className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-gray-600 dark:text-gray-400`} />;
    }
  };
  
  // Format date helper
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Unknown date';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  // Render file explorer
  const renderFileExplorer = () => {
    const groupedSources = getDataSourcesByType();
    const fileTypes = Object.keys(groupedSources).sort();
    
    if (fileTypes.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          No data sources available. Add data sources to get started.
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        {fileTypes.map(fileType => {
          // Get corresponding type info
          const typeInfo = DATA_SOURCE_TYPES[fileType as keyof typeof DATA_SOURCE_TYPES] || DATA_SOURCE_TYPES.other;
          const sourcesInFolder = groupedSources[fileType] || [];
          
          return (
            <div key={fileType} className="border-b border-gray-100 dark:border-gray-800 pb-1 mb-1">
              {/* Folder header */}
              <div 
                className={`flex items-center ${isMobile ? 'p-2.5' : 'p-2'} hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors duration-150`}
                onClick={() => toggleFolder(fileType)}
              >
                {expandedFolders[fileType] ? (
                  <ChevronDown className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0`} />
                ) : (
                  <ChevronRight className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-gray-500 dark:text-gray-400 mr-1 flex-shrink-0`} />
                )}
                
                <div className="flex items-center">
                  {typeInfo.icon ? (
                    <img src={typeInfo.icon} alt={typeInfo.label} className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} mr-2 flex-shrink-0`} />
                  ) : expandedFolders[fileType] ? (
                    <FolderOpen className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} ${typeInfo.color} mr-2 flex-shrink-0`} />
                  ) : (
                    <Folder className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} ${typeInfo.color} mr-2 flex-shrink-0`} />
                  )}
                  <span className={`font-medium ${isMobile ? 'text-base' : 'text-sm'} text-gray-800 dark:text-gray-200`}>
                    {typeInfo.label || (fileType === 'other' ? 'Other Files' : fileType)}
                  </span>
                  <span className={`ml-2 ${isMobile ? 'text-sm' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
                    ({sourcesInFolder.length})
                  </span>
                </div>
              </div>
              
              {/* Folder contents */}
              {expandedFolders[fileType] && (
                <div className={`${isMobile ? 'ml-8' : 'ml-6'} mt-1 space-y-1`}>
                  {sourcesInFolder.map(source => (
                    <div 
                      key={source.id}
                      className={`
                        flex items-center ${isMobile ? 'py-2.5 px-3' : 'py-1.5 px-2'} rounded cursor-pointer transition-all duration-150
                        ${activeSource?.id === source.id 
                          ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 pl-1' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent pl-1'}
                      `}
                      onClick={() => handleDataSourceSelect(source)}
                      onMouseEnter={() => setHoveredItem(source.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {getDataSourceTypeIcon(fileType)}
                      <div className="ml-2 flex-1 truncate">
                        <div className={`${isMobile ? 'text-base' : 'text-sm'} truncate text-gray-800 dark:text-gray-200 ${activeSource?.id === source.id ? 'font-medium' : ''}`}>
                          {source.name}
                        </div>
                        {source.updatedAt && (
                          <div className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
                            Updated: {formatDate(source.updatedAt)}
                          </div>
                        )}
                      </div>
                      
                      {activeSource?.id === source.id && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                          <CheckCircle className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                        </span>
                      )}
                      
                      {hoveredItem === source.id && activeSource?.id !== source.id && (
                        <button 
                          className={`ml-2 ${isMobile ? 'p-1.5' : 'p-1'} rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400`}
                          title="Select data source"
                        >
                          <ArrowRight className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render search results
  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          No matching data sources found.
        </div>
      );
    }
    
    return (
      <div className="space-y-1 px-2">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 px-2">Search Results:</div>
        {searchResults.map(source => {
          // Determine the file type
          let fileType = 'other';
          const sourceAny = source as any;
          
          if (sourceAny.metadata && sourceAny.metadata.fileType) {
            fileType = sourceAny.metadata.fileType.toLowerCase();
          } else if (source.name) {
            // For names like "file.docx_2025-03-05T08-31-45.417Z", extract the actual extension
            
            // First, check for common file extensions patterns in the name
            const extensionMatches = source.name.match(/\.(csv|xlsx?|docx?|pdf|txt|json)/i);
            if (extensionMatches && extensionMatches[1]) {
              fileType = extensionMatches[1].toLowerCase();
            } else {
              // Fallback to original method
              const nameParts = source.name.split('.');
              if (nameParts.length > 1) {
                fileType = nameParts[nameParts.length - 1].toLowerCase();
              }
            }
            
            // For Qdrant Collections with timestamp names like "file.csv_2025-03-05T09-40-28.773Z"
            const timestampMatch = source.name.match(/\.(csv|xlsx?|docx?|pdf|txt|json)_\d{4}-\d{2}-\d{2}/i);
            if (timestampMatch && timestampMatch[1]) {
              fileType = timestampMatch[1].toLowerCase();
            }
          }
          
          // Normalize the file type
          if (['xlsx', 'xls', 'xlsm'].includes(fileType)) fileType = 'excel';
          else if (['csv', 'tsv'].includes(fileType)) fileType = 'csv';
          else if (['pdf'].includes(fileType)) fileType = 'pdf';
          else if (['doc', 'docx', 'rtf'].includes(fileType)) fileType = 'docx';
          else if (['txt', 'text'].includes(fileType)) fileType = 'txt';
          else if (['json', 'jsonl'].includes(fileType)) fileType = 'json';
          
          return (
            <div 
              key={source.id}
              className={`
                flex items-center py-1.5 px-2 rounded cursor-pointer transition-all duration-150
                ${activeSource?.id === source.id 
                  ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 pl-1' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent pl-1'}
              `}
              onClick={() => handleDataSourceSelect(source)}
            >
              {getDataSourceTypeIcon(fileType)}
              <div className="ml-2 flex-1 truncate">
                <div className={`text-sm truncate text-gray-800 dark:text-gray-200 ${activeSource?.id === source.id ? 'font-medium' : ''}`}>
                  {source.name}
                </div>
                {sourceAny.updatedAt && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Updated: {formatDate(sourceAny.updatedAt)}
                  </div>
                )}
              </div>
              
              {activeSource?.id === source.id && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  <CheckCircle className="w-4 h-4" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  // Return the component with mobile-friendly adjustments
  return (
    <div 
      className="flex flex-col h-full overflow-hidden" 
      onClick={(e) => {
        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();
        debug("Root container clicked, stopping propagation");
      }}
      onTouchStart={(e) => {
        // Also prevent touch events from propagating on mobile
        e.preventDefault();
        e.stopPropagation();
        debug("Touch event on root container, stopping propagation");
      }}
      data-testid="knowledge-sidebar-root"
    >
      {/* Header */}
      <div 
        className={`flex-none ${isMobile ? 'p-3' : 'p-4'} border-b border-gray-200 dark:border-gray-800`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {!isMobile && (
          <h2 className="text-lg font-semibold flex items-center text-gray-800 dark:text-gray-100">
            <BookOpen className="w-5 h-5 mr-2" />
            Knowledge Base
          </h2>
        )}
        
        {/* Search bar - enhance with proper event handling */}
        <div className="relative mt-3">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search data sources..."
            className={`w-full px-3 ${isMobile ? 'py-1.5 text-xs' : 'py-2 text-sm'} bg-gray-100 dark:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400`}
            value={searchQuery}
            onChange={handleSearchChange}
            onClick={(e) => {
              e.stopPropagation();
              debug("Search input clicked, stopping propagation");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              debug("Touch event on search input, stopping propagation");
            }}
          />
          
          {searchQuery && (
            <button
              className="absolute right-2 top-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                debug("Clear search button clicked");
                clearSearch();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <X className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
            </button>
          )}
        </div>
        
        {/* Filter tabs - enhance with proper event handling */}
        <div 
          className={`flex mt-3 border-b border-gray-200 dark:border-gray-800 ${isMobile ? 'text-xs' : 'text-sm'}`}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            className={`flex items-center px-3 py-2 border-b-2 ${
              filterType === 'all' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFilterType('all');
              debug("All files filter selected");
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <FileText className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
            All Files
          </button>
          
          <button
            className={`flex items-center px-3 py-2 border-b-2 ${
              filterType === 'recent' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFilterType('recent');
              debug("Recent filter selected");
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Clock3 className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
            Recent
          </button>
          
          <button
            className={`flex items-center px-3 py-2 border-b-2 ${
              filterType === 'starred' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFilterType('starred');
              debug("Starred filter selected");
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Star className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1`} />
            Starred
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div 
        className={`flex-1 overflow-y-auto ${isMobile ? 'p-1.5' : 'p-2'}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading data sources...</p>
          </div>
        ) : isSearchActive ? (
          renderSearchResults()
        ) : (
          renderFileExplorer()
        )}
      </div>
      
      {/* Footer with refresh button - enhance with proper event handling */}
      <div 
        className={`flex-none ${isMobile ? 'p-2' : 'p-3'} border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          className={`flex items-center ${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-150`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            debug("Refresh button clicked");
            fetchDataSources();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <RefreshCw className={`${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'} mr-1`} />
          Refresh
        </button>
        
        <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
          {sources.length} data source{sources.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}; 