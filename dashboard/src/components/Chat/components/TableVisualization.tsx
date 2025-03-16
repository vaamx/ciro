import React, { useState, useEffect } from 'react';
import { ChatMessage } from '../types';

interface TableVisualizationProps {
  content: string;
  message: ChatMessage;
  messageId: string;
}

interface TableData {
  headers: string[];
  rows: any[][];
}

/**
 * Table Visualization Component
 * 
 * Renders tabular data (Excel, CSV) in a responsive table format
 */
export const TableVisualization: React.FC<TableVisualizationProps> = ({ 
  content, 
  message, 
  messageId 
}) => {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Parse the table data from the content
  useEffect(() => {
    try {
      setIsLoading(true);
      
      // Try to extract tabular data from various formats
      const data = extractTableData(content, message);
      setTableData(data);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error parsing table data:', err);
      setError('Failed to parse table data');
      setIsLoading(false);
    }
  }, [content, message]);
  
  // Extract tabular data from various formats
  const extractTableData = (content: string, message: ChatMessage): TableData => {
    // Check if we have direct array data in the message metadata
    if (message.metadata?.tableData) {
      return processTableMetadata(message.metadata.tableData);
    }
    
    // Try to parse JSON data from the content
    if (typeof content === 'string') {
      try {
        // Check if content is a JSON string
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          const jsonData = JSON.parse(content);
          return processJsonData(jsonData);
        }
      } catch (err) {
        console.warn('Content is not valid JSON, attempting other formats');
      }
    }
    
    // Try to parse CSV-like content
    const csvData = parseCsvLikeContent(content);
    if (csvData) {
      return csvData;
    }
    
    // Try to extract tables from markdown
    const markdownTable = extractMarkdownTable(content);
    if (markdownTable) {
      return markdownTable;
    }
    
    // Fallback: Just display the content as a simple data view
    return createSimpleDataView(content);
  };
  
  // Process table data from metadata
  const processTableMetadata = (tableData: any): TableData => {
    try {
      // Handle array of arrays (2D array, first row is headers)
      if (Array.isArray(tableData) && tableData.length > 0) {
        // Handle array of objects
        if (typeof tableData[0] === 'object' && !Array.isArray(tableData[0])) {
          const headers = Object.keys(tableData[0]);
          const rows = tableData.map(row => headers.map(header => row[header] ?? ''));
          return { headers, rows };
        }
        
        // Handle array of arrays
        if (Array.isArray(tableData[0])) {
          // First row is headers
          const headers = tableData[0].map((header, index) => 
            header?.toString() || `Column ${index + 1}`
          );
          
          // Rest are data rows
          const rows = tableData.slice(1).map(row => 
            // Map row to match header length, fill with empty strings if needed
            headers.map((_, index) => {
              const value = row[index];
              return value !== undefined && value !== null ? value : '';
            })
          );
          
          return { headers, rows };
        }
        
        // Fallback for simple array - create artificial headers
        const headers = ['Value'];
        const rows = tableData.map(item => [item]);
        return { headers, rows };
      }
      
      // If it's not an array or empty, return empty table
      return { headers: ['No Data'], rows: [] };
    } catch (err) {
      console.error('Error processing table metadata:', err);
      return { headers: ['Error'], rows: [[`Failed to process table data: ${err}`]] };
    }
  };
  
  // Process JSON data into table format
  const processJsonData = (jsonData: any): TableData => {
    if (Array.isArray(jsonData)) {
      if (jsonData.length === 0) {
        return { headers: ['No Data'], rows: [['No data available']] };
      }
      
      // Check if array of objects
      if (typeof jsonData[0] === 'object' && !Array.isArray(jsonData[0])) {
        const headers = Object.keys(jsonData[0]);
        const rows = jsonData.map(item => headers.map(key => item[key]));
        return { headers, rows };
      }
      
      // Array of arrays
      if (Array.isArray(jsonData[0])) {
        return {
          headers: Array.from({ length: jsonData[0].length }, (_, i) => `Column ${i + 1}`),
          rows: jsonData
        };
      }
      
      // Array of primitives
      return {
        headers: ['Value'],
        rows: jsonData.map(item => [item])
      };
    }
    
    // Handle object
    if (typeof jsonData === 'object' && jsonData !== null) {
      const headers = ['Property', 'Value'];
      const rows = Object.entries(jsonData).map(([key, value]) => [
        key, 
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      ]);
      return { headers, rows };
    }
    
    // Fallback for other types
    return {
      headers: ['Data'],
      rows: [[String(jsonData)]]
    };
  };
  
  // Parse CSV-like content
  const parseCsvLikeContent = (content: string): TableData | null => {
    // Check if content looks like CSV
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;
    
    // Check for common delimiters
    const possibleDelimiters = [',', '\t', '|', ';'];
    let bestDelimiter = '';
    let maxColumns = 0;
    
    for (const delimiter of possibleDelimiters) {
      const columns = lines[0].split(delimiter).length;
      if (columns > maxColumns) {
        maxColumns = columns;
        bestDelimiter = delimiter;
      }
    }
    
    if (maxColumns <= 1) return null;
    
    // Parse with the best delimiter
    const headers = lines[0].split(bestDelimiter).map(h => h.trim());
    const rows = lines.slice(1).map(line => 
      line.split(bestDelimiter).map(cell => cell.trim())
    );
    
    return { headers, rows };
  };
  
  // Extract tables from markdown content
  const extractMarkdownTable = (content: string): TableData | null => {
    // Look for markdown table pattern
    const tableRegex = /\|(.+)\|[\r\n]+\|([-:]+\|)+[\r\n]+((?:\|.+\|[\r\n]+)+)/g;
    const match = tableRegex.exec(content);
    
    if (!match) return null;
    
    const headerLine = match[1];
    const bodyLines = match[3];
    
    const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
    const rows = bodyLines
      .split('\n')
      .filter(line => line.includes('|'))
      .map(line => 
        line.split('|')
          .map(cell => cell.trim())
          .filter((_, index) => index > 0 && index <= headers.length)
      );
    
    return { headers, rows };
  };
  
  // Create a simple data view for unstructured content
  const createSimpleDataView = (content: string): TableData => {
    // Split content into lines and create a simple table
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { 
        headers: ['Content'], 
        rows: [['No content available']] 
      };
    }
    
    return {
      headers: ['Line', 'Content'],
      rows: lines.map((line, index) => [String(index + 1), line])
    };
  };
  
  // Format cell value for display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };
  
  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-lg">
        <p className="font-medium">Error rendering table data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }
  
  // No data state
  if (!tableData || tableData.rows.length === 0) {
    return (
      <div className="p-4 bg-gray-50 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 rounded-lg">
        <p>No table data available</p>
      </div>
    );
  }
  
  // Render the table
  return (
    <div className="overflow-x-auto w-full" data-message-id={messageId} data-content-type="table">
      <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
        Table Data
      </div>
      
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden rounded-lg">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {tableData.headers.map((header, index) => (
              <th 
                key={`header-${index}`}
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {tableData.rows.slice(0, 50).map((row, rowIndex) => (
            <tr 
              key={`row-${rowIndex}`}
              className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}
            >
              {row.map((cell, cellIndex) => (
                <td 
                  key={`cell-${rowIndex}-${cellIndex}`}
                  className="px-3 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200"
                >
                  {formatCellValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {tableData.rows.length > 50 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
          Showing 50 of {tableData.rows.length} rows
        </div>
      )}
    </div>
  );
}; 