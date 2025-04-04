import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, Filter, Download, RefreshCw } from 'lucide-react';

interface DataGridProps {
  data: any[] | null;
  title?: string;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onFilterChange?: (filters: Record<string, any>) => void;
  onSortChange?: (sortField: string, sortDirection: 'asc' | 'desc') => void;
  onExport?: () => void;
}

/**
 * Data Grid component for displaying and interacting with tabular data
 */
export const DataGrid: React.FC<DataGridProps> = ({
  data,
  title = 'Data Preview',
  isLoading = false,
  error = null,
  onRefresh,
  onFilterChange,
  onSortChange,
  onExport
}) => {
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Reset pagination when data changes
  useEffect(() => {
    setPage(1);
  }, [data]);

  // Extract column definitions from data
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Get column names from first row
    const firstRow = data[0];
    return Object.keys(firstRow).map(key => ({
      id: key,
      name: key
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      field: key,
      sortable: true,
      filterable: true
    }));
  }, [data]);

  // Apply sorting and filtering
  const processedData = useMemo(() => {
    if (!data) return [];
    
    // Filter data
    let filtered = [...data];
    if (Object.keys(activeFilters).length > 0) {
      filtered = filtered.filter(row => {
        return Object.entries(activeFilters).every(([field, value]) => {
          if (value === null || value === undefined || value === '') return true;
          
          const rowValue = row[field];
          if (rowValue === null || rowValue === undefined) return false;
          
          // Handle different types of filters
          if (typeof value === 'string') {
            return String(rowValue).toLowerCase().includes(value.toLowerCase());
          } else if (typeof value === 'number') {
            return rowValue === value;
          } else if (typeof value === 'object' && 'min' in value && 'max' in value) {
            return rowValue >= value.min && rowValue <= value.max;
          }
          
          return false;
        });
      });
    }
    
    // Sort data
    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        // Handle null values
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return sortDirection === 'asc' ? -1 : 1;
        if (bValue === null) return sortDirection === 'asc' ? 1 : -1;
        
        // Sort by type
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        } else {
          // Convert to string for mixed types
          const aStr = String(aValue);
          const bStr = String(bValue);
          return sortDirection === 'asc' 
            ? aStr.localeCompare(bStr) 
            : bStr.localeCompare(aStr);
        }
      });
    }
    
    return filtered;
  }, [data, activeFilters, sortField, sortDirection]);
  
  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return processedData.slice(startIndex, startIndex + rowsPerPage);
  }, [processedData, page, rowsPerPage]);
  
  // Handle column sort click
  const handleSortClick = (field: string) => {
    if (sortField === field) {
      // Toggle direction if already sorting by this field
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      if (onSortChange) onSortChange(field, newDirection);
    } else {
      // Set new sort field with default ascending direction
      setSortField(field);
      setSortDirection('asc');
      if (onSortChange) onSortChange(field, 'asc');
    }
  };
  
  // Handle filter change
  const handleFilterChange = (field: string, value: any) => {
    const newFilters = { ...activeFilters, [field]: value };
    if (value === '') {
      delete newFilters[field];
    }
    
    setActiveFilters(newFilters);
    if (onFilterChange) onFilterChange(newFilters);
    
    // Reset to first page
    setPage(1);
  };
  
  // Export data as CSV
  const handleExport = () => {
    if (onExport) {
      onExport();
      return;
    }
    
    if (!data || data.length === 0) return;
    
    // Default export implementation
    const headers = columns.map(column => column.field);
    const csvContent = [
      // Headers
      headers.join(','),
      // Data rows
      ...processedData.map(row => 
        headers.map(header => {
          const value = row[header];
          // Quote strings that contain commas
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Calculate totals for numeric columns
  const columnTotals = useMemo(() => {
    if (!data || data.length === 0) return {};
    
    const totals: Record<string, number> = {};
    
    columns.forEach(column => {
      const field = column.field;
      
      // Check if column is numeric by checking the first non-null value
      const firstNonNullRow = data.find(row => row[field] !== null && row[field] !== undefined);
      if (!firstNonNullRow) return;
      
      if (typeof firstNonNullRow[field] === 'number') {
        // Sum numeric columns
        totals[field] = data.reduce((sum, row) => {
          const value = row[field];
          if (value !== null && value !== undefined && typeof value === 'number') {
            return sum + value;
          }
          return sum;
        }, 0);
      }
    });
    
    return totals;
  }, [data, columns]);

  // Render empty state
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">{title}</h3>
          {onRefresh && (
            <button 
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
              onClick={onRefresh}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="p-8 text-center">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading data...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 dark:text-red-400">
              <p className="font-medium mb-2">Error loading data</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400">
              <p className="mb-2">No data available</p>
              <p className="text-sm">Try connecting to a data source or running a query</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">{title}</h3>
        
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button 
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <button 
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
            onClick={handleExport}
            disabled={isLoading}
          >
            <Download className="w-4 h-4" />
          </button>
          
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <span>Total: {processedData.length} rows</span>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map(column => (
                <th 
                  key={column.id}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  <div className="flex items-center space-x-1">
                    <button 
                      className="hover:text-gray-700 dark:hover:text-gray-300 font-semibold flex items-center"
                      onClick={() => column.sortable && handleSortClick(column.field)}
                    >
                      {column.name}
                      {sortField === column.field && (
                        sortDirection === 'asc' 
                          ? <ArrowUp className="w-3 h-3 ml-1" /> 
                          : <ArrowDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
                    
                    {column.filterable && (
                      <div className="relative inline-block">
                        <button 
                          className={`p-1 rounded-md ${
                            activeFilters[column.field] 
                              ? 'text-blue-500 dark:text-blue-400' 
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                          onClick={() => {
                            // This would typically open a filter dropdown
                            const value = prompt(`Filter ${column.name}:`);
                            if (value !== null) {
                              handleFilterChange(column.field, value);
                            }
                          }}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedData.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                {columns.map(column => (
                  <td 
                    key={`${rowIndex}-${column.id}`}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200"
                  >
                    {row[column.field] === null || row[column.field] === undefined 
                      ? <span className="text-gray-400 dark:text-gray-600">NULL</span>
                      : typeof row[column.field] === 'number'
                        ? row[column.field].toLocaleString()
                        : String(row[column.field])
                    }
                  </td>
                ))}
              </tr>
            ))}
            
            {/* Show totals row for numeric columns */}
            {Object.keys(columnTotals).length > 0 && (
              <tr className="bg-gray-50 dark:bg-gray-700 font-semibold">
                {columns.map(column => (
                  <td 
                    key={`totals-${column.id}`}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200"
                  >
                    {column.field in columnTotals 
                      ? columnTotals[column.field].toLocaleString()
                      : column.field === columns[0].field 
                        ? 'Totals'
                        : ''
                    }
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={rowsPerPage}
            onChange={e => setRowsPerPage(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {Math.min((page - 1) * rowsPerPage + 1, processedData.length)} - {Math.min(page * rowsPerPage, processedData.length)} of {processedData.length}
          </span>
        </div>
        
        <div className="flex space-x-2">
          <button
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 disabled:opacity-50"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          
          <button
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 disabled:opacity-50"
            onClick={() => setPage(p => Math.min(Math.ceil(processedData.length / rowsPerPage), p + 1))}
            disabled={page === Math.ceil(processedData.length / rowsPerPage)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataGrid; 