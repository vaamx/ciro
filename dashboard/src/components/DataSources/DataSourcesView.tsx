import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  History,
  X,
  Loader2,
  FileText,
  BarChart,
  Cloud,
  MessageSquare,
  Briefcase
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useRag } from '../../hooks/useRag';
import { useKnowledge } from '../../providers/KnowledgeProvider';
import { DataSource, DataSourceStatus } from './types';
import { DataSource as KnowledgeDataSource } from '../../types/knowledge';
import { AddDataSourceWizard } from './AddDataSourceWizard';
import { DataSourceCard } from './DataSourceCard';
import { QdrantService } from '../../services/qdrant/QdrantService';

const API_BASE_URL = 'http://localhost:3001';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('No authentication token found');
  }
  
  return headers;
};

// Mock data for fallback when API fails
const MOCK_DATA_SOURCES: DataSource[] = [
  {
    id: 'mock-1',
    name: 'Sample Excel File',
    type: 'local-files',
    status: 'ready',
    description: 'This is a mock data source for when the API is unavailable',
    lastSync: new Date().toISOString(),
    metadata: { 
      id: 'file-mock-1',
      filename: 'sample.xlsx',
      fileType: 'xlsx',
      size: 1024,
      uploadedAt: new Date(),
      lastModified: new Date(),
      status: 'ready',
      records: 100,
      content: [],
      preview: 'Sample data preview',
      syncRate: 0,
      avgSyncTime: '0s'
    },
    metrics: {
      records: 100,
      syncRate: 0,
      avgSyncTime: '0s'
    }
  }
];

const sourceCategories = [
  { id: 'all', name: 'All Sources', icon: <Database className="w-4 h-4" /> },
  { id: 'local-files', name: 'Files', icon: <FileText className="w-4 h-4" /> },
  { id: 'database', name: 'Databases', icon: <Database className="w-4 h-4" /> },
  { id: 'warehouse', name: 'Data Warehouses', icon: <Cloud className="w-4 h-4" /> },
  { id: 'crm', name: 'CRM Systems', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'analytics', name: 'Analytics Tools', icon: <BarChart className="w-4 h-4" /> },
  { id: 'streaming', name: 'Streaming', icon: <MessageSquare className="w-4 h-4" /> }
];

interface SourceDetailsModalProps {
  source: DataSource | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (sourceId: string, updates: Partial<DataSource>) => void;
}

const SourceDetailsModal: React.FC<SourceDetailsModalProps> = ({
  source,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'preview' | 'performance'>('info');
  const [previewData, setPreviewData] = useState<Record<string, any>[] | null>(null);

  useEffect(() => {
    if (source) {
      setName(source.name || '');
      setDescription(source.description || '');
      // Fetch preview data when source changes or when switched to preview tab
      if (activeTab === 'preview') {
        fetchPreviewData();
      }
    }
  }, [source, activeTab]);

  const fetchPreviewData = async () => {
    if (!source) return;
    
    setIsLoading(true);
    try {
      // Initialize the Qdrant service
      const qdrantService = new QdrantService();
      
      // Try different collection name formats
      const possibleCollectionNames = [
        `datasource_${source.id}`,
        `data_source_${source.id}`,
        `${source.id}`
      ];
      
      console.log(`Attempting to fetch data from collections: ${possibleCollectionNames.join(', ')}`);
      
      // Try each possible collection name
      let collectionData: Array<{ id: string, payload: Record<string, any> }> = [];
      for (const collectionName of possibleCollectionNames) {
        console.log(`Trying to fetch data from collection: ${collectionName}`);
        const points = await qdrantService.getCollectionPoints(collectionName, 10);
        
        if (points && points.length > 0) {
          console.log(`Found data in collection: ${collectionName}, ${points.length} points`);
          collectionData = points;
          break;
        }
      }
      
      if (collectionData.length > 0) {
        // Transform the data for display
        const transformedData = collectionData.map(point => {
          const { payload } = point;
          
          // For document-type data sources (PDF, Word, etc.)
          if (payload.text) {
            return {
              id: point.id,
              content: payload.text.substring(0, 300) + (payload.text.length > 300 ? '...' : ''),
              page: payload.metadata?.page || 1,
              source: payload.metadata?.source || source.name
            };
          }
          
          // For structured data (CSV, Excel, JSON)
          // Create a flattened representation of the payload
          const flattenedData: Record<string, any> = { id: point.id };
          
          // Add metadata fields that aren't objects
          if (payload.metadata) {
            Object.entries(payload.metadata).forEach(([key, value]) => {
              if (typeof value !== 'object') {
                flattenedData[key] = value;
              }
            });
          }
          
          // Add any other payload fields that aren't objects
          Object.entries(payload).forEach(([key, value]) => {
            if (key !== 'metadata' && typeof value !== 'object') {
              flattenedData[key] = value;
            }
          });
          
          return flattenedData;
        });
        
        console.log('Transformed data:', transformedData);
        setPreviewData(transformedData);
      } else {
        // If no real data is found, fall back to mock data
        console.log('No data found in any Qdrant collection, using fallback mock data');
        const fileType = getFileType(source);
        const mockData: Record<string, any>[] = [];
        
        if (fileType === 'csv' || fileType === 'excel') {
          mockData.push(
            { id: "mock1", name: 'John Doe', email: 'john@example.com', department: 'Sales' },
            { id: "mock2", name: 'Jane Smith', email: 'jane@example.com', department: 'Marketing' },
            { id: "mock3", name: 'Bob Johnson', email: 'bob@example.com', department: 'Engineering' }
          );
        } else if (fileType === 'json') {
          mockData.push(
            { id: "mock101", user: 'Alice Cooper', views: 342, comments: 23 },
            { id: "mock102", user: 'Tom Wilson', views: 217, comments: 12 }
          );
        } else if (fileType === 'docx' || fileType === 'pdf') {
          mockData.push(
            { id: "mockdoc1", page: 1, content: 'This is a sample document with text content that would be extracted...' },
            { id: "mockdoc2", page: 2, content: 'Additional content would appear on subsequent pages...' }
          );
        } else {
          mockData.push({ id: "mockgeneric", message: "No preview available for this file type" });
        }
        
        setPreviewData(mockData);
      }
    } catch (error) {
      console.error('Error fetching preview data:', error);
      // Set empty array to show "No preview data available" message
      setPreviewData([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getFileType = (ds: DataSource): string => {
    if (!ds.metadata?.filename) return '';
    
    const filename = ds.metadata.filename as string;
    if (filename.endsWith('.csv')) return 'csv';
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) return 'excel';
    if (filename.endsWith('.pdf')) return 'pdf';
    if (filename.endsWith('.docx') || filename.endsWith('.doc')) return 'docx';
    if (filename.endsWith('.json')) return 'json';
    
    return '';
  };
  
  const handleSave = () => {
    if (!source || !source.id) return;
    
    onUpdate(source.id, {
      name,
      description
    });
    onClose();
  };
  
  const extractBasicFilename = (fullname: string): string => {
    // Remove timestamp suffix if present
    const timestampRegex = /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
    const nameWithoutTimestamp = fullname.replace(timestampRegex, '');
    
    // For paths, extract just the filename part
    const pathParts = nameWithoutTimestamp.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    return filename;
  };
  
  const getFileIcon = () => {
    if (!source) return null;
    
    const fileType = getFileType(source);
    let iconSrc = '';
    
    // File type icons
    interface FileTypeIcons {
      [key: string]: string;
    }
    
    const FILE_TYPE_ICONS: FileTypeIcons = {
      csv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=',
      excel: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyMTk2NTMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==',
      pdf: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+',
      docx: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzNDk4REIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTE2IDEzbC00IDZoLTRsNi05eiI+PC9wYXRoPjwvc3ZnPg==',
      json: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGNTlFMEIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg==',
    };
    
    if (source.type === 'database') {
      // For database sources, use database logo
      // This is simplified, but you could add more database icons here
      iconSrc = '/images/database-icon.svg';
    } else if (fileType && FILE_TYPE_ICONS[fileType]) {
      iconSrc = FILE_TYPE_ICONS[fileType];
    } else {
      // Default file icon
      iconSrc = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2QTcyODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PC9zdmc+';
    }
    
    return <img src={iconSrc} alt={`${fileType} icon`} className="w-16 h-16" />;
  };

  const renderPreviewTable = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading data preview...</span>
        </div>
      );
    }
    
    if (!previewData || previewData.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No preview data available for this file type
        </div>
      );
    }

    // Handle text document preview (docx, pdf)
    if (previewData[0]?.content && (previewData[0]?.page || source?.metadata?.filename?.match(/\.(pdf|docx?)$/i))) {
      // Text document preview
      return (
        <div className="border rounded-md p-4 bg-white dark:bg-gray-800 shadow-sm">
          {previewData.map((item, i) => (
            <div key={i} className="mb-3">
              <div className="text-xs text-gray-500 mb-1">
                {item.page ? `Page ${item.page}` : `Chunk ${i + 1}`}
                {item.source && ` • Source: ${item.source}`}
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                {item.content}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // For structured data (CSV, Excel, JSON)
    // Extract headers from first item
    const firstItem = previewData[0];
    const headers = Object.keys(firstItem).filter(h => h !== 'id'); // Exclude ID column
    
    return (
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {headers.map((header, i) => (
                <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {previewData.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                {headers.map((header, j) => {
                  const cellValue = row[header];
                  return (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {typeof cellValue === 'object' 
                        ? JSON.stringify(cellValue)
                        : String(cellValue ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  if (!source) return null;
  
  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'block' : 'hidden'}`}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
          {/* Header with icon, title and close button */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-16 w-16 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 mr-4">
                {getFileIcon()}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {source.metadata?.filename 
                    ? extractBasicFilename(source.metadata.filename as string) 
                    : extractBasicFilename(source.name)}
                </h3>
                <div className="mt-1 flex items-center">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    source.status === 'connected' || source.status === 'ready'
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                      : source.status === 'processing' || source.status === 'syncing'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' 
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                  }`}>
                    {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                  </span>
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {source.type === 'local-files' ? 'Local File' : source.type}
                  </span>
                </div>
              </div>
            </div>
          <button
              type="button"
              className="rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
            onClick={onClose}
          >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
          </button>
        </div>

          {/* Tab navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex px-4 space-x-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'info'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Information
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'preview'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Data Preview
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'performance'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Performance
              </button>
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'info' && (
              <div className="space-y-6">
            <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <input
                type="text"
                    id="name"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                    id="description"
                rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Add an optional description for this data source"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
              />
          </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Information</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {source.lastSync ? new Date(source.lastSync).toLocaleString() : 'Never'}
                      </dd>
                        </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Source Type</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {source.type}
                      </dd>
                        </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {source.metadata?.size ? `${Math.round(Number(source.metadata.size) / 1024)} KB` : 'Unknown'}
                      </dd>
                      </div>
                    {source.metadata && 'metadata' in source.metadata && source.metadata.metadata?.contentType && (
                      <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Content Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {String(source.metadata.metadata.contentType)}
                        </dd>
                    </div>
                    )}
                  </dl>
                </div>
              </div>
            )}
            
            {activeTab === 'preview' && (
                        <div>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                        </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Preview</h3>
                      <button
                        onClick={fetchPreviewData}
                        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Refresh
                      </button>
                    </div>
                    {renderPreviewTable()}
                  </>
                          )}
                        </div>
            )}
            
            {activeTab === 'performance' && (
                          <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Records</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                        {source.metrics?.records || 0}
                      </dd>
                          </div>
                          </div>
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Sync Rate</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                        {source.metrics?.syncRate || 0}%
                      </dd>
                        </div>
                      </div>
                  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Avg. Sync Time</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                        {source.metrics?.avgSyncTime || '0s'}
                      </dd>
                  </div>
              </div>
            </div>
                
                {source.metrics?.lastError && (
                  <div className="mt-6 bg-red-50 dark:bg-red-900 border-l-4 border-red-500 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-100">Last Error</h3>
                        <div className="mt-1 text-sm text-red-700 dark:text-red-200">
                          {source.metrics.lastError}
            </div>
              </div>
              </div>
              </div>
                )}
            </div>
            )}
          </div>

          {/* Footer with buttons */}
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleSave}
            >
              Save Changes
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const fetchHubSpotData = async (dataSource: DataSource) => {
  try {
    // Fetch contacts with all properties
    const contactsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/contacts?properties=firstname,lastname,email,phone,company,jobtitle,city,state,country,zip,lifecyclestage,lastmodifieddate,createdate,associatedcompanyid&limit=100', {
      headers: { 'Accept': 'application/json' }
    });
    const contactsData = await contactsResponse.json();

    // Fetch companies with all properties
    const companiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/companies?properties=domain,name,hubspot_owner_id,industry,type,city,state,postal_code,numberofemployees,annualrevenue,timezone,description,linkedin_company_page,createdate,lastmodifieddate&limit=100');
    const companiesData = await companiesResponse.json();

    // Fetch deals with all properties
    const dealsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/deals?properties=dealname,amount,dealstage,pipeline,closedate,createdate,lastmodifieddate,hubspot_owner_id,associated_company,associated_vids&limit=100');
    const dealsData = await dealsResponse.json();

    // Fetch recent activities using the correct v3 endpoint
    const activitiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/activities/feed?limit=100');
    const activitiesData = await activitiesResponse.json();

    // Calculate total records - using the correct HubSpot API response structure
    const totalRecords = 
      (contactsData?.total || contactsData?.results?.length || 0) +
      (companiesData?.total || companiesData?.results?.length || 0) +
      (dealsData?.total || dealsData?.results?.length || 0);

    return {
      ...dataSource,
      status: 'connected' as const,
      lastSync: new Date().toISOString(),
      metrics: {
        records: totalRecords,
        syncRate: 100,
        avgSyncTime: '0s'
      },
      data: {
        contacts: {
          total: contactsData?.total || contactsData?.results?.length || 0,
          synced: contactsData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: contactsData?.results || contactsData?.objects || []
        },
        companies: {
          total: companiesData?.total || companiesData?.results?.length || 0,
          synced: companiesData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: companiesData?.results || companiesData?.objects || []
        },
        deals: {
          total: dealsData?.total || dealsData?.results?.length || 0,
          synced: dealsData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: dealsData?.results || dealsData?.objects || []
        },
        activities: {
          total: activitiesData?.total || activitiesData?.results?.length || 0,
          synced: activitiesData?.results?.length || 0,
          lastSync: new Date().toISOString(),
          records: activitiesData?.results || activitiesData?.objects || []
        }
      }
    };
  } catch (error) {
    console.error('Error fetching HubSpot data:', error);
    throw error;
  }
};

const restoreHubSpotConnection = async () => {
  const sessionToken = localStorage.getItem('hubspot_session_token');
  if (sessionToken) {
    // Set the session token in a cookie
    document.cookie = `session_token=${sessionToken}; path=/`;
    return true;
  }
  return false;
};

export const DataSourcesView: React.FC = () => {
  const { showNotification } = useNotification();
  const { currentOrganization } = useOrganization();
  const { activeSource, setActiveSource, removeSource, addSource } = useKnowledge();
  const { clearDataSource } = useRag();
  const { sources: knowledgeSources } = useKnowledge();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncHistoryOpen, setSyncHistoryOpen] = useState(false);
  const [filteredSources, setFilteredSources] = useState<DataSource[]>([]);
  const [displayedSources, setDisplayedSources] = useState<DataSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasNotifiedError, setHasNotifiedError] = useState(false);

  useEffect(() => {
    // Convert knowledge sources to app data sources
    const appSources = knowledgeSources.map(ks => ({
      id: ks.id,
      name: ks.name,
      type: ks.type as DataSource['type'],
      status: (ks.originalSource?.status || 'connected') as DataSource['status'],
      metrics: ks.originalSource?.metrics || {
        records: 0,
        syncRate: 0,
        avgSyncTime: '0s'
      }
    } as DataSource));
    
    // Only update if we have knowledge sources and they're different from current filtered sources
    if (knowledgeSources.length > 0) {
      setFilteredSources(appSources);
    }
  }, [knowledgeSources]);

  // Memoize loadDataSources to prevent recreation on each render
  const loadDataSources = useCallback(async () => {
    try {
      if (!currentOrganization?.id) {
        setFilteredSources([]);
        setDisplayedSources([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      setHasNotifiedError(false);

      try {
        // Use a timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(
          `${API_BASE_URL}/api/data-sources?organization_id=${currentOrganization.id}`,
          { 
            signal: controller.signal,
            headers: getAuthHeaders(),
            credentials: 'include'
          }
        );
        
        clearTimeout(timeoutId);
        
        let sources: DataSource[] = [];
        
        if (!response.ok) {
          // Handle 500 errors more gracefully
          console.warn(`Server returned ${response.status} when fetching data sources`);
          
          // Show notification only once
          if (!hasNotifiedError) {
            showNotification('info', 'Using local data while server is unavailable');
            setHasNotifiedError(true);
          }
          
          // Use mock data for better user experience
          if (response.status === 500) {
            console.info('Using mock data sources due to server error');
            sources = MOCK_DATA_SOURCES;
          } else {
            throw new Error(`API error: ${response.status}`);
          }
        } else {
          sources = await response.json();
        }
        
        setFilteredSources(sources);
        setDisplayedSources(sources);
      } catch (err) {
        console.error('Error loading data sources:', err);
        
        // Show notification only once
        if (!hasNotifiedError) {
          showNotification('info', 'Using local data while server is unavailable');
          setHasNotifiedError(true);
        }
        
        // Use mock data sources when fetch fails
        setFilteredSources(MOCK_DATA_SOURCES);
        setDisplayedSources(MOCK_DATA_SOURCES);
        
        // Log for debugging but don't show to user
        setError('Unable to connect to server. Using local data instead.');
      } finally {
        setIsLoading(false);
      }
    } catch (outerErr) {
      console.error("Unexpected error in loadDataSources:", outerErr);
      setIsLoading(false);
    }
  }, [currentOrganization?.id, showNotification, hasNotifiedError]);

  // Load data sources from database on initial mount or when organization changes
  useEffect(() => {
    loadDataSources();
  }, [loadDataSources, currentOrganization?.id]);

  // Filter sources based on search and category
  useEffect(() => {
    if (filteredSources.length === 0) {
      setDisplayedSources([]);
      return;
    }
    
    const filtered = filteredSources.filter(source => {
      const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (source.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || source.type === activeCategory;
      return matchesSearch && matchesCategory;
    });
    
    setDisplayedSources(filtered);
  }, [searchQuery, activeCategory, filteredSources]);

  // Display error message if there is one, but only once
  useEffect(() => {
    if (error && !hasNotifiedError) {
      showNotification('info', error);
      setHasNotifiedError(true);
    }
  }, [error, hasNotifiedError, showNotification]);

  // Handle sync history modal
  useEffect(() => {
    if (syncHistoryOpen) {
      // You can implement sync history view here
      // For now, just show a notification
      showNotification('info', 'Sync history feature coming soon!');
      setSyncHistoryOpen(false);
    }
  }, [syncHistoryOpen]);

  // Add this effect to restore connections on mount
  useEffect(() => {
    const restoreConnections = async () => {
      try {
        const hasRestoredHubSpot = await restoreHubSpotConnection();
        
        if (hasRestoredHubSpot) {
          // Refresh HubSpot data for all HubSpot sources
          const updatedSources = await Promise.all(
            filteredSources.map(async (source) => {
              if (source.type === 'crm-hubspot') {
                try {
                  // Fetch fresh data
                  const contactsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/contacts', {
                    headers: { 'Accept': 'application/json' }
                  });
                  const contactsData = await contactsResponse.json();

                  const companiesResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/companies');
                  const companiesData = await companiesResponse.json();

                  const dealsResponse = await fetch('/api/proxy/hubspot/crm/v3/objects/deals');
                  const dealsData = await dealsResponse.json();

                  // Update the source with fresh data
                  return {
                    ...source,
                    status: 'connected' as const,
                    lastSync: new Date().toISOString(),
                    data: {
                      contacts: {
                        total: contactsData._metadata?.total || 0,
                        synced: contactsData.records?.length || 0,
                        lastSync: new Date().toISOString(),
                        records: contactsData.records || []
                      },
                      companies: {
                        total: companiesData._metadata?.total || 0,
                        synced: companiesData.records?.length || 0,
                        lastSync: new Date().toISOString(),
                        records: companiesData.records || []
                      },
                      deals: {
                        total: dealsData._metadata?.total || 0,
                        synced: dealsData.records?.length || 0,
                        lastSync: new Date().toISOString(),
                        records: dealsData.records || []
                      }
                    },
                    metrics: {
                      records: (contactsData._metadata?.total || 0) + 
                              (companiesData._metadata?.total || 0) + 
                              (dealsData._metadata?.total || 0),
                      syncRate: 100,
                      avgSyncTime: '0s'
                    }
                  };
                } catch (error) {
                  console.error('Error refreshing HubSpot data:', error);
                  return {
                    ...source,
                    status: 'error' as const,
                    metrics: {
                      ...source.metrics,
                      lastError: 'Failed to refresh HubSpot data'
                    }
                  };
                }
              }
              return source;
            })
          );

          setFilteredSources(updatedSources);
        }
      } catch (error) {
        console.error('Error restoring connections:', error);
      }
    };

    restoreConnections();
  }, []);

  // Add this function before handleAddDataSource
  const startPollingForProcessingStatus = (source: DataSource) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds maximum
    const pollInterval = 2000; // 2 seconds

    const pollStatus = async () => {
      if (attempts >= maxAttempts) {
        console.warn('Max polling attempts reached');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/data-sources/${source.id}`, {
          credentials: 'include',
          headers: getAuthHeaders()
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const updatedSource = await response.json();
        
        // Update the source in the list
        setFilteredSources(prev => 
          prev.map(s => s.id === updatedSource.id ? updatedSource : s)
        );

        // If still processing, continue polling
        if (updatedSource.status === 'processing' || updatedSource.status === 'syncing') {
          attempts++;
          setTimeout(pollStatus, pollInterval);
        } else if (updatedSource.status === 'connected' || updatedSource.status === 'ready') {
          // If the source is now connected or ready, update the Knowledge Base
          console.log('Data source processing completed:', updatedSource);
          
          // Create knowledge source object with the correct type mapping
          const knowledgeSource: KnowledgeDataSource = {
            id: updatedSource.id,
            name: updatedSource.name,
            // Map the type to a compatible type in KnowledgeDataSource
            type: updatedSource.type === 'warehouse' ? 'database' : 
                 (updatedSource.type === 'analytics' || updatedSource.type === 'sap' || updatedSource.type === 'crm-hubspot') ? 'crm' : 
                 updatedSource.type as KnowledgeDataSource['type'],
            icon: 'database',
            isActive: true,
            lastSynced: new Date(),
            originalSource: updatedSource
          };
          
          // Add to knowledge base
          addSource(knowledgeSource);
          
          // Dispatch event to notify other components
          window.dispatchEvent(new CustomEvent('knowledgeBaseUpdated', {
            detail: { action: 'add', source: knowledgeSource }
          }));
          
          showNotification('success', `${updatedSource.name} is now ready to use`);
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    // Start polling
    pollStatus();
  };

  const handleAddDataSource = async (newSource: {
    name: string;
    type: DataSource['type'];
    status: DataSource['status'];
    lastSync: string;
    description: string;
    metadata?: DataSource['metadata'];
    metrics: {
      records: number;
      syncRate: number;
      avgSyncTime: string;
      lastError?: string;
    };
  }) => {
    try {
      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      // If we have a dataSourceId from the chunked upload, we don't need to create a new data source
      if (newSource.type === 'local-files' && newSource.metadata?.dataSourceId) {
        console.log(`Using existing data source ID from chunked upload: ${newSource.metadata.dataSourceId}`);
        
        // Refresh the data sources list to show the new data source
        await loadDataSources();
        return;
      }

      // Create the data source first with fields exactly matching the database schema
      const response = await fetch(`${API_BASE_URL}/api/data-sources`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newSource.name,
          type: newSource.type,
          status: newSource.status,
          description: newSource.description,
          last_sync: newSource.lastSync, // Using snake_case to match DB column
          metadata: newSource.metadata,
          metrics: newSource.metrics,
          organization_id: currentOrganization.id
          // Note: created_by will be set by the server based on the authenticated user
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to create data source: ${response.status}`);
      }

      const dataSource = await response.json();
      console.log('Successfully created data source:', dataSource);

      // For local file data sources, process the content
      if (newSource.type === 'local-files' && newSource.metadata?.content) {
        console.log('Processing content for local file data source');
        
        // Flag to check if this is an Excel file that needs embedding
        const isExcelFile = newSource.metadata.fileType === 'xlsx' || 
                           newSource.name.toLowerCase().endsWith('.xlsx') || 
                           newSource.name.toLowerCase().endsWith('.xls');
        
        if (isExcelFile) {
          console.log('Excel file detected, ensuring it will be processed for embeddings');
        }
        
        // Check if content is chunked
        if (newSource.metadata.chunks && newSource.metadata.chunks.length > 0) {
          console.log('Content is chunked, starting polling for processing status');
          
          // Add the data source to the UI immediately, but mark it as processing
          const processingDataSource: DataSource = {
            ...dataSource,
            status: 'processing'
          };
          
          // Update filtered sources
          setFilteredSources(prev => [...prev, processingDataSource]);
          
          // Start polling for status updates
          startPollingForProcessingStatus(processingDataSource);
          
          // For chunked content, handle the upload through the chunk endpoints
          const chunks = newSource.metadata.chunks || [];
          console.log(`Processing ${chunks.length} chunks`);
          
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const formData = new FormData();
            const blob = new Blob([chunk.data], { type: 'application/octet-stream' });
            formData.append('chunk', blob);
            
            console.log(`Uploading chunk ${i + 1}/${chunks.length}`);
            const chunkResponse = await fetch(`${API_BASE_URL}/api/data-sources/upload/chunk`, {
              method: 'POST',
              headers: {
                ...getAuthHeaders(),
                'X-File-Id': newSource.metadata.id,
                'X-Chunk-Index': chunk.index.toString(),
                'X-Total-Chunks': chunks.length.toString()
              },
              body: formData,
              credentials: 'include'
            });
            
            if (!chunkResponse.ok) {
              throw new Error(`Failed to upload chunk ${i + 1}/${chunks.length}: ${chunkResponse.statusText}`);
            }
            
            const chunkResult = await chunkResponse.json();
            console.log(`Chunk ${i + 1} uploaded successfully:`, chunkResult);
          }
          
          // Complete the chunked upload
          console.log('Completing chunked upload');
          const completeResponse = await fetch(`${API_BASE_URL}/api/data-sources/upload/complete`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              fileId: newSource.metadata.id,
              dataSourceId: dataSource.id,
              metadata: {
                filename: newSource.name,
                contentType: 'application/pdf',
                totalChunks: chunks.length,
                dataSourceId: dataSource.id
              }
            }),
            credentials: 'include'
          });
          
          if (!completeResponse.ok) {
            throw new Error(`Failed to complete chunked upload: ${completeResponse.statusText}`);
          }
          
          const completeResult = await completeResponse.json();
          console.log('Chunked upload completed successfully:', completeResult);
        } else {
          // For non-chunked content, proceed with direct upload
          console.log('Content is not chunked, proceeding with direct upload');
          
          // Add the data source to the UI immediately, but mark it as processing
          const processingDataSource: DataSource = {
            ...dataSource,
            status: 'processing'
          };
          
          // Update filtered sources
          setFilteredSources(prev => [...prev, processingDataSource]);
          
          // Start polling for status updates
          startPollingForProcessingStatus(processingDataSource);
          
          // Flag to check if this is an Excel file that needs embedding
          const isExcelFile = newSource.metadata.fileType === 'xlsx' || 
                             newSource.name.toLowerCase().endsWith('.xlsx') || 
                             newSource.name.toLowerCase().endsWith('.xls');
          
          // Always process Excel files, even if they appear to be "ready"
          const contentResponse = await fetch(`${API_BASE_URL}/api/data-sources/${dataSource.id}/content`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              content: newSource.metadata?.content,
              metadata: {
                ...newSource.metadata,
                requiresEmbedding: true,
                isExcelFile: isExcelFile
              }
            }),
            credentials: 'include'
          });
          
          if (!contentResponse.ok) {
            const error = await contentResponse.text();
            console.error('Error processing content:', error);
            try {
              const errorJson = JSON.parse(error);
              throw new Error(errorJson.message || 'Failed to process content');
            } catch (e) {
              throw new Error(`Failed to process content: ${error}`);
            }
          }
        }
      } else {
        // For non-file data sources, add them directly to the knowledge base
        
        // Create knowledge source
        const knowledgeSource: KnowledgeDataSource = {
          id: dataSource.id,
          name: dataSource.name,
          // Map the type to a compatible type in KnowledgeDataSource
          type: dataSource.type === 'warehouse' ? 'database' : 
               (dataSource.type === 'analytics' || dataSource.type === 'sap' || dataSource.type === 'crm-hubspot') ? 'crm' : 
               dataSource.type as KnowledgeDataSource['type'],
          icon: 'database',
          isActive: true,
          lastSynced: new Date(),
          originalSource: dataSource
        };

        // Add to knowledge base
        addSource(knowledgeSource);

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('knowledgeBaseUpdated', {
          detail: { action: 'add', source: knowledgeSource }
        }));

        // Show success notification
        showNotification('success', `Successfully added ${dataSource.name}`);

        // Update filtered sources
        setFilteredSources(prev => [...prev, dataSource]);
      }
      
      // Close modal
      setIsModalOpen(false);
      
      // Refresh the data sources list to ensure UI is updated
      await loadDataSources();
    } catch (error) {
      console.error('Error adding data source:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to add data source');
      throw error;
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      console.log(`Attempting to delete data source with ID: ${sourceId}`);
      
      const response = await fetch(`${API_BASE_URL}/api/data-sources/${sourceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        let errorMessage = `Failed to delete data source: ${response.status} - ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData?.error || errorData?.details) {
            errorMessage = errorData?.details || errorData?.error || errorMessage;
          }
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      console.log(`Successfully deleted data source with ID: ${sourceId}`);
      
      // Remove from local state
      setFilteredSources(prev => prev.filter(source => source.id !== sourceId));
      
      // Clear from RAG service
      if (typeof clearDataSource === 'function') {
        clearDataSource(sourceId);
      }
      
      // Remove from knowledge base state
      if (typeof removeSource === 'function') {
        removeSource(sourceId);
      }
      
      // If this was the active source, clear it
      if (activeSource && activeSource.id === sourceId) {
        setActiveSource(null);
      }
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('knowledgeBaseUpdate', { 
        detail: { deletedSourceId: sourceId } 
      }));

      showNotification('success', 'Data source deleted successfully');
    } catch (error) {
      console.error('Error deleting data source:', error);
      showNotification('error', error instanceof Error ? error.message : 'Failed to delete data source');
    }
  };

  const handleRefreshSource = async (sourceId: string) => {
    try {
      const source = filteredSources.find(s => s.id === sourceId);
      if (!source) return;

      const updatedSources = filteredSources.map(s => 
        s.id === sourceId ? { ...s, status: 'syncing' as DataSource['status'] } : s
      );
      setFilteredSources(updatedSources);

      if (source.type === 'crm-hubspot') {
        try {
          const refreshedSource = await fetchHubSpotData(source);
          const finalSources = filteredSources.map(s => 
            s.id === sourceId ? refreshedSource : s
          );
          
          setFilteredSources(finalSources);
          showNotification('success', 'Data source refreshed successfully');
        } catch (error) {
          console.error('Error refreshing HubSpot data:', error);
          const errorSources = filteredSources.map(s => 
            s.id === sourceId ? {
              ...s,
              status: 'error' as DataSource['status'],
              metrics: {
                ...s.metrics,
                lastError: 'Failed to refresh HubSpot data'
              }
            } : s
          );
          setFilteredSources(errorSources);
          showNotification('error', 'Failed to refresh HubSpot data');
        }
      } else {
        const finalSources = updatedSources.map(s => 
          s.id === sourceId ? { ...s, status: 'connected' as DataSource['status'] } : s
        );
        setFilteredSources(finalSources);
        showNotification('success', 'Data source refreshed successfully');
      }
    } catch (error) {
      showNotification('error', 'Failed to refresh data source');
    }
  };

  const handleUpdateSource = async (sourceId: string, updates: Partial<DataSource>) => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedSources = filteredSources.map(source => 
        source.id === sourceId ? { ...source, ...updates } : source
      );
      
      setFilteredSources(updatedSources);
      showNotification('success', 'Data source updated successfully');
    } catch (error) {
      showNotification('error', 'Failed to update data source');
    } finally {
      setIsLoading(false);
    }
  };

  // Add this effect to listen for the startPollingDataSource event
  useEffect(() => {
    const handleStartPolling = (event: CustomEvent) => {
      const { sourceId, filename } = event.detail;
      console.log(`Received startPollingDataSource event for source ${sourceId} (${filename})`);
      
      if (!sourceId) {
        console.warn('No source ID provided in startPollingDataSource event');
        return;
      }
      
      // Create a temporary data source object to start polling
      const tempSource: DataSource = {
        id: sourceId,
        name: filename || `Data Source ${sourceId}`,
        type: 'local-files',
        status: 'processing' as DataSourceStatus,
        lastSync: new Date().toISOString(),
        metrics: {
          records: 0,
          syncRate: 0,
          avgSyncTime: '0s'
        }
      };
      
      console.log('Starting polling for data source:', tempSource);
      startPollingForProcessingStatus(tempSource);
    };
    
    window.addEventListener('startPollingDataSource', handleStartPolling as EventListener);
    
    return () => {
      window.removeEventListener('startPollingDataSource', handleStartPolling as EventListener);
    };
    // No dependencies needed as this should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading data sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Sources</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connect and manage your data sources
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              // Dispatch event to refresh knowledge base
              window.dispatchEvent(new CustomEvent('knowledgeBaseUpdate', { 
                detail: { timestamp: new Date().toISOString() } 
              }));
              
              // Show notification
              showNotification('info', 'Refreshing data sources...');
            }}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 flex items-center space-x-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setSyncHistoryOpen(true)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 flex items-center space-x-2 text-sm"
          >
            <History className="w-4 h-4" />
            <span>Sync History</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white flex items-center space-x-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Connection</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search data sources..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex">
          <button className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg flex items-center justify-center space-x-2 text-sm">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex overflow-x-auto hide-scrollbar pb-1">
        {sourceCategories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
              activeCategory === category.id
                  ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {category.icon}
              <span>{category.name}</span>
              {activeCategory === category.id && category.id !== 'all' && (
                <span className="ml-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-xs px-2 py-0.5 rounded-full">
                  {displayedSources.length}
                </span>
              )}
              {category.id === 'all' && (
                <span className="ml-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  {filteredSources.length}
                </span>
              )}
          </button>
        ))}
        </div>
      </div>

      {/* Data Sources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-6">
        {displayedSources.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-full p-6 mb-6">
              <Database className="w-16 h-16 text-purple-500 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">No data sources found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
              {searchQuery
                ? `No results found for "${searchQuery}". Try adjusting your search or filters.`
                : 'Connect your data sources to enhance your AI assistant with relevant knowledge.'}
            </p>
            
              <button
                onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
              <Plus className="w-4 h-4" />
                <span>Add Data Source</span>
              </button>
          </div>
        ) : (
          <>
            {displayedSources.map(source => (
              <DataSourceCard
            key={source.id}
                source={source}
                onRefresh={handleRefreshSource}
                onDelete={handleDeleteSource}
                onViewDetails={setSelectedSource}
              />
            ))}

        {/* Add New Data Source Card */}
            <div className="h-full">
              <div 
          onClick={() => setIsModalOpen(true)}
                className="h-full w-full bg-white dark:bg-gray-800 shadow-subtle rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group p-6 card-hover-effect cursor-pointer"
        >
                <div className="mb-3 p-3 file-icon-bg rounded-full w-12 h-12 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                  <Plus className="w-6 h-6 text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors" />
            </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
              Add New Data Source
            </span>
          </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <AddDataSourceWizard
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAdd={(dataSource) => {
            // Convert the metadata to include required fields
            const metadata = dataSource.metadata ? {
              ...dataSource.metadata,
              records: dataSource.metadata.records || 0,
              syncRate: 100,
              avgSyncTime: '0s'
            } : undefined;

            handleAddDataSource({
              ...dataSource,
              metadata
            });
          }}
        />
      )}
      <SourceDetailsModal
        source={selectedSource}
        isOpen={!!selectedSource}
        onClose={() => setSelectedSource(null)}
        onUpdate={handleUpdateSource}
      />
    </div>
  );
}; 