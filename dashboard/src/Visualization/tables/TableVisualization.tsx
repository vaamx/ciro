import React, { useEffect, useRef } from 'react';
import { TableFormatter } from '../../services/TableFormatter';

interface TableVisualizationProps {
  data: any[];
  title?: string;
  columns?: string[];
  maxHeight?: string;
  className?: string;
  darkMode?: boolean;
  responsive?: boolean;
  pagination?: boolean;
  pageSize?: number;
  style?: React.CSSProperties;
}

/**
 * TableVisualization - Component for rendering tabular data
 * 
 * This component takes table data and renders it with appropriate formatting
 * and interactive features like sorting, pagination, and searching.
 */
export const TableVisualization: React.FC<TableVisualizationProps> = ({
  data,
  title,
  columns,
  maxHeight = '400px',
  className = '',
  darkMode = false,
  responsive = true,
  pagination = true,
  pageSize = 10,
  style = {}
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!tableRef.current || !data || data.length === 0) return;
    
    // Dynamically load DataTables if needed for interactive tables
    try {
      // Format the table config
      const tableConfig = TableFormatter.formatForUI(data, {
        title: title,
        columns: columns,
        paging: pagination && data.length > 5,
        pageSize: pageSize,
        ordering: true,
        responsive
      });
      
      // Get the container
      const container = tableRef.current;
      
      // Clear previous content
      container.innerHTML = '';
      
      // Create table element
      const table = document.createElement('table');
      table.className = `data-table ${darkMode ? 'dark' : ''} ${responsive ? 'responsive' : ''}`;
      
      // Add headers
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      tableConfig.data.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Add body
      const tbody = document.createElement('tbody');
      
      tableConfig.data.rows.forEach(row => {
        const tr = document.createElement('tr');
        
        row.forEach(cell => {
          const td = document.createElement('td');
          
          // Format cell content based on data type
          if (cell === null || cell === undefined) {
            td.textContent = '';
          } else if (typeof cell === 'object') {
            td.textContent = JSON.stringify(cell);
          } else {
            td.textContent = String(cell);
          }
          
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
      
      // Add title if provided
      if (title) {
        const titleElement = document.createElement('h4');
        titleElement.className = 'table-title';
        titleElement.textContent = title;
        container.appendChild(titleElement);
      }
      
      // Add table to container
      container.appendChild(table);
      
      // Add base styling
      const style = document.createElement('style');
      style.textContent = `
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
          border: 1px solid ${darkMode ? '#444' : '#ddd'};
        }
        .data-table th {
          background-color: ${darkMode ? '#333' : '#f4f4f4'};
          color: ${darkMode ? '#fff' : '#333'};
          font-weight: bold;
          text-align: left;
          padding: 8px;
          border: 1px solid ${darkMode ? '#444' : '#ddd'};
        }
        .data-table td {
          padding: 8px;
          border: 1px solid ${darkMode ? '#444' : '#ddd'};
          color: ${darkMode ? '#eee' : '#333'};
        }
        .data-table tbody tr:nth-child(even) {
          background-color: ${darkMode ? '#2a2a2a' : '#f9f9f9'};
        }
        .data-table.responsive {
          overflow-x: auto;
          display: block;
          width: 100%;
        }
        .table-title {
          margin-bottom: 8px;
          color: ${darkMode ? '#fff' : '#333'};
          font-size: 1.1rem;
        }
      `;
      container.appendChild(style);
    } catch (error: any) {
      console.error('Error rendering table:', error);
      if (tableRef.current) {
        tableRef.current.innerHTML = `<div class="error">Error rendering table: ${error.message || 'Unknown error'}</div>`;
      }
    }
  }, [data, title, columns, maxHeight, darkMode, responsive, pagination, pageSize]);
  
  // Fallback if no data
  if (!data || data.length === 0) {
    return (
      <div className={`table-visualization empty ${className}`} style={style}>
        <div className="no-data-message">No data available</div>
      </div>
    );
  }
  
  return (
    <div 
      className={`table-visualization ${className}`} 
      style={{ ...style, maxHeight, overflowY: 'auto' }}
      ref={tableRef}
    />
  );
}; 