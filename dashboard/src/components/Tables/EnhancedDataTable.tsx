import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';

export interface TableProps {
  data: any[];
  title?: string;
  width?: string | number;
  height?: string | number;
  paginate?: boolean;
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  className?: string;
  emptyMessage?: string;
  columns?: string[];
  onRowClick?: (row: any) => void;
}

export const EnhancedDataTable: React.FC<TableProps> = ({
  data,
  title,
  width = '100%',
  height = 'auto',
  paginate = true,
  pageSize = 10,
  sortable = true,
  filterable = true,
  className = '',
  emptyMessage = 'No data available',
  columns: propColumns,
  onRowClick
}) => {
  // State for pagination, sorting, and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  // Get column headers from first item or use provided columns
  const columns = useMemo(() => {
    if (propColumns) return propColumns;
    if (data && data.length > 0) return Object.keys(data[0]);
    return [];
  }, [data, propColumns]);

  // Filter data based on search query and column filters
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.filter(row => {
      // Apply search query across all fields
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = Object.values(row).some(value => 
          value !== null && 
          value !== undefined && 
          String(value).toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }
      
      // Apply column-specific filters
      for (const [column, filterValue] of Object.entries(filters)) {
        if (!filterValue) continue;
        
        const cellValue = row[column];
        if (cellValue === null || cellValue === undefined) return false;
        
        const matches = String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        if (!matches) return false;
      }
      
      return true;
    });
  }, [data, searchQuery, filters]);

  // Apply sorting to filtered data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortable) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;
      
      // Compare by type
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Default string comparison
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      
      if (aString < bString) return sortDirection === 'asc' ? -1 : 1;
      if (aString > bString) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, sortable]);

  // Apply pagination
  const paginatedData = useMemo(() => {
    if (!paginate) return sortedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, paginate]);

  // Calculate pagination info
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, sortedData.length);

  // Handle sorting
  const handleSort = (column: string) => {
    if (!sortable) return;
    
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle filter change
  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Handle search query change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  // Handle pagination navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate CSS styles
  const tableStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    maxHeight: typeof height === 'number' ? `${height}px` : height
  };

  return (
    <div className={`enhanced-data-table ${className}`} style={tableStyle}>
      {/* Table header with title, search, and filter controls */}
      <div className="table-header flex justify-between items-center mb-2">
        {title && (
          <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">{title}</h3>
        )}
        
        <div className="table-controls flex gap-2">
          {filterable && (
            <div className="relative">
              <button 
                className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                onClick={() => setFilterVisible(!filterVisible)}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filter
              </button>
              
              {filterVisible && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 z-10 p-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Filter by column
                  </div>
                  {columns.map(column => (
                    <div key={column} className="mb-2">
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {column}
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        value={filters[column] || ''}
                        onChange={e => handleFilterChange(column, e.target.value)}
                        placeholder={`Filter ${column}...`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {filterable && (
            <div className="relative">
              <div className="flex items-center">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1.5 text-gray-400" />
                  <input
                    type="text"
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-40"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search all columns..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Table container */}
      <div className="relative overflow-auto border border-gray-200 dark:border-gray-700 rounded-md" style={{ maxHeight: height !== 'auto' ? height : undefined }}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              {columns.map(column => (
                <th 
                  key={column}
                  className={`px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${sortable ? 'cursor-pointer select-none' : ''}`}
                  onClick={sortable ? () => handleSort(column) : undefined}
                >
                  <div className="flex items-center">
                    <span>{column}</span>
                    {sortable && sortColumn === column && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? 
                          <ChevronUp className="h-3.5 w-3.5" /> : 
                          <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className={`
                    ${rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                    ${onRowClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                  `}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column, colIndex) => (
                    <td 
                      key={colIndex} 
                      className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"
                    >
                      {row[column] !== null && row[column] !== undefined
                        ? typeof row[column] === 'object'
                          ? JSON.stringify(row[column])
                          : String(row[column])
                        : ''}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td 
                  colSpan={columns.length} 
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls */}
      {paginate && sortedData.length > 0 && (
        <div className="pagination-controls flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div>
            Showing {startItem} to {endItem} of {sortedData.length} entries
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              className="p-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 disabled:opacity-50"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <ChevronLeft className="h-3.5 w-3.5 -ml-3" />
            </button>
            
            <button
              className="p-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 disabled:opacity-50"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            
            <div className="flex items-center space-x-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show pages around current page
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else {
                  const offset = Math.min(Math.max(1, currentPage - 2), totalPages - 4);
                  pageNum = offset + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    className={`px-2 py-1 rounded ${
                      currentPage === pageNum
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => goToPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              className="p-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 disabled:opacity-50"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            
            <button
              className="p-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 disabled:opacity-50"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <ChevronRight className="h-3.5 w-3.5 -ml-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDataTable; 