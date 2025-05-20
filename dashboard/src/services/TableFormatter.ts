/**
 * TableFormatter Service
 * 
 * A utility service for formatting tabular data consistently across the application.
 * Provides methods for generating markdown tables, structured JSON for UI rendering,
 * and handling large datasets appropriately.
 */

export interface TableConfig {
  type: string;
  data: {
    headers: string[];
    rows: any[][];
  };
  options: {
    title: {
      display: boolean;
      text: string;
    };
    paging?: boolean;
    pageSize?: number;
    searching?: boolean;
    ordering?: boolean;
    responsive?: boolean;
    info?: boolean;
  };
  displayData?: any[];
}

export class TableFormatter {
  /**
   * Convert data to a well-formatted markdown table string
   * @param data Array of objects representing table rows
   * @param columns Optional array of column names to include (defaults to all keys from first row)
   * @param title Optional title for the table
   * @returns Formatted markdown table as a string
   */
  public static toMarkdownTable(data: any[], columns?: string[], title?: string): string {
    // Handle empty data
    if (!data || data.length === 0) return "No data available";
    
    // Get columns from first row if not provided
    const headers = columns || Object.keys(data[0]);
    
    // Start with title if provided
    let table = title ? `### ${title}\n\n` : '';
    
    // Create header row with proper alignment and formatting
    table += "| " + headers.join(" | ") + " |\n";
    
    // Add separator row with alignment indicators
    // Use :-- for left align, :-: for center, --: for right align
    table += "| " + headers.map(() => "---").join(" | ") + " |\n";
    
    // Add data rows
    for (const row of data) {
      const rowValues = headers.map(col => {
        const value = row[col];
        // Properly format different value types
        if (value === null || value === undefined) return "";
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'object') return JSON.stringify(value);
        return value.toString().replace(/\|/g, '\\|'); // Escape pipe characters
      });
      table += "| " + rowValues.join(" | ") + " |\n";
    }
    
    return table;
  }
  
  /**
   * Format data for HTML table rendering (basic version)
   * @param data Array of objects representing table rows
   * @param columns Optional array of column names to include
   * @returns HTML table string
   */
  public static toHtmlTable(data: any[], columns?: string[], title?: string): string {
    if (!data || data.length === 0) return "<p>No data available</p>";
    
    const headers = columns || Object.keys(data[0]);
    
    let html = '<div class="table-container">';
    
    if (title) {
      html += `<h3>${title}</h3>`;
    }
    
    html += '<table class="data-table">';
    
    // Add header row
    html += '<thead><tr>';
    for (const header of headers) {
      html += `<th>${header}</th>`;
    }
    html += '</tr></thead>';
    
    // Add data rows
    html += '<tbody>';
    for (const row of data) {
      html += '<tr>';
      for (const header of headers) {
        const value = row[header];
        const formattedValue = value !== null && value !== undefined 
          ? (typeof value === 'object' ? JSON.stringify(value) : value) 
          : '';
        html += `<td>${formattedValue}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';
    
    html += '</table>';
    html += '</div>';
    
    return html;
  }
  
  /**
   * Format data for UI display with configuration options
   * @param data Array of objects representing table rows
   * @param options Configuration options for the table
   * @returns TableConfig object for UI rendering
   */
  public static formatForUI(
    data: any[], 
    options: {
      title?: string;
      columns?: string[];
      paging?: boolean;
      pageSize?: number;
      ordering?: boolean;
      responsive?: boolean;
    } = {}
  ): TableConfig {
    if (!data || data.length === 0) {
      return {
        type: 'table',
        data: {
          headers: [],
          rows: []
        },
        options: {
          title: {
            display: !!options.title,
            text: options.title || 'Data Table'
          }
        },
        displayData: []
      };
    }

    // Determine columns to display
    const allColumns = Object.keys(data[0]);
    const columns = options.columns || allColumns;

    // Convert data to rows format required by the UI
    const rows = data.map(row => columns.map(col => row[col]));

    return {
      type: 'table',
      data: {
        headers: columns,
        rows: rows
      },
      options: {
        title: {
          display: !!options.title,
          text: options.title || 'Data Table'
        },
        paging: options.paging !== false && data.length > 10,
        pageSize: options.pageSize || 10,
        searching: data.length > 10,
        ordering: options.ordering !== false,
        responsive: options.responsive !== false,
        info: true
      },
      displayData: data
    };
  }
  
  /**
   * Detects if data appears to be CSV-formatted and parses it
   * @param text Text that might contain CSV data
   * @returns Parsed data as an array of objects or null if not CSV
   */
  public static parseCSVLikeContent(text: string): any[] | null {
    try {
      // Check if this looks like CSV data
      const lines = text.trim().split('\n');
      if (lines.length < 2) return null;
      
      // Detect possible delimiters
      const possibleDelimiters = [',', '\t', '|', ';'];
      let bestDelimiter = ',';
      let maxColumns = 0;
      
      for (const delimiter of possibleDelimiters) {
        const columnsInFirstRow = lines[0].split(delimiter).length;
        if (columnsInFirstRow > maxColumns) {
          maxColumns = columnsInFirstRow;
          bestDelimiter = delimiter;
        }
      }
      
      // If only one column, probably not CSV
      if (maxColumns <= 1) return null;
      
      // Parse the headers
      const headers = lines[0].split(bestDelimiter).map(h => h.trim());
      
      // Parse the data
      const result = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(bestDelimiter);
        const row: Record<string, any> = {};
        
        // Match values to headers
        for (let j = 0; j < headers.length; j++) {
          const value = j < values.length ? values[j].trim() : '';
          // Try to convert numbers and booleans
          if (!isNaN(Number(value))) {
            row[headers[j]] = Number(value);
          } else if (value.toLowerCase() === 'true') {
            row[headers[j]] = true;
          } else if (value.toLowerCase() === 'false') {
            row[headers[j]] = false;
          } else {
            row[headers[j]] = value;
          }
        }
        
        result.push(row);
      }
      
      return result;
    } catch (error) {
      console.error('Error parsing CSV-like content:', error);
      return null;
    }
  }
  
  /**
   * Extract tables from markdown text
   * @param markdownText Markdown text that may contain tables
   * @returns Array of extracted tables as 2D arrays, where each table has headers as the first row
   */
  public static extractTablesFromMarkdown(markdownText: string): any[][] {
    // Check if the string contains markdown tables
    if (!markdownText.includes('|')) {
      return [];
    }
    
    // Split the text into lines
    const lines = markdownText.split('\n');
    const tables: any[][] = [];
    let currentTable: string[][] = [];
    let inTable = false;
    let hasHeaderSeparator = false;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is a table row (contains | character)
      if (line.includes('|')) {
        // If this is a separator row (|---|---|) following a header row
        if (line.match(/^\|[\s\-:\|]+\|$/)) {
          if (inTable && currentTable.length === 1) {
            hasHeaderSeparator = true;
            continue; // Skip separator rows
          }
        }
        
        // Start a new table if not already in one
        if (!inTable) {
          inTable = true;
          currentTable = [];
        }
        
        // Process table row
        let cells = line.split('|');
        
        // Remove empty first and last elements that result from leading/trailing |
        if (cells[0].trim() === '') cells.shift();
        if (cells[cells.length-1].trim() === '') cells.pop();
        
        // Trim each cell
        cells = cells.map(cell => cell.trim());
        
        // Add row to current table
        currentTable.push(cells);
      } else if (line === '' && inTable) {
        // End of table - a blank line after table rows
        if (currentTable.length > 0) {
          // Make sure the table has a header
          if (!hasHeaderSeparator && currentTable.length >= 2) {
            // If the first and second rows have the same number of columns,
            // assume the first row is a header
            tables.push(currentTable);
          } else if (hasHeaderSeparator) {
            tables.push(currentTable);
          } else if (currentTable.length === 1) {
            // Single row table - synthesize headers from indexes
            const headerRow = currentTable[0].map((_, i) => `Column ${i+1}`);
            tables.push([headerRow, ...currentTable]);
          }
        }
        
        // Reset table state
        inTable = false;
        hasHeaderSeparator = false;
        currentTable = [];
      }
    }
    
    // Handle case where the last table doesn't end with a blank line
    if (inTable && currentTable.length > 0) {
      if (!hasHeaderSeparator && currentTable.length >= 2) {
        tables.push(currentTable);
      } else if (hasHeaderSeparator) {
        tables.push(currentTable);
      } else if (currentTable.length === 1) {
        const headerRow = currentTable[0].map((_, i) => `Column ${i+1}`);
        tables.push([headerRow, ...currentTable]);
      }
    }
    
    // Convert string tables to structured data
    return tables.map(table => {
      try {
        const headers = table[0];
        
        // Create array of objects, using first row as headers
        const rows = [];
        
        for (let i = 1; i < table.length; i++) {
          const row = table[i];
          const obj: Record<string, string> = {};
          
          // Match each cell to its header
          for (let j = 0; j < Math.min(headers.length, row.length); j++) {
            const normalizedHeader = headers[j].replace(/[^a-z0-9]/gi, '_').toLowerCase();
            obj[normalizedHeader] = row[j];
          }
          
          // Also add raw array for TableVisualization
          obj.__raw = row;
          rows.push(obj);
        }
        
        return rows;
      } catch (e) {
        console.error('Error processing table:', e);
        return []; // Return empty array for failed tables
      }
    }).filter(table => table.length > 0);
  }
  
  /**
   * Format a large dataset for efficient display and processing
   * @param data Large dataset to format
   * @param options Formatting options
   * @returns Formatted data with applied limits and summaries
   */
  public static formatLargeDataset(
    data: any[], 
    options: {
      maxRows?: number;
      summaryRow?: boolean;
      truncateStringLength?: number;
    } = {}
  ): { data: any[], isTruncated: boolean, originalRowCount: number } {
    if (!data || data.length === 0) {
      return { data: [], isTruncated: false, originalRowCount: 0 };
    }
    
    const {
      maxRows = 100,
      summaryRow = true,
      truncateStringLength = 100
    } = options;
    
    // Handle very large datasets
    const originalRowCount = data.length;
    const isTruncated = data.length > maxRows;
    
    // Limit rows
    let limitedData = data;
    if (isTruncated) {
      limitedData = data.slice(0, maxRows);
    }
    
    // Process each row to handle large string values
    const processedData = limitedData.map(row => {
      const newRow: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.length > truncateStringLength) {
          newRow[key] = value.substring(0, truncateStringLength) + '...';
        } else {
          newRow[key] = value;
        }
      }
      
      return newRow;
    });
    
    // Add summary row if enabled and data was truncated
    if (summaryRow && isTruncated) {
      processedData.push({
        __summary: `Showing ${maxRows} of ${originalRowCount} rows`
      });
    }
    
    return {
      data: processedData,
      isTruncated,
      originalRowCount
    };
  }

  /**
   * Format JSON object data to properly structured table format
   */
  public static formatJsonToTable(data: any): { markdown: string, tableData: any[] } {
    if (!data) return { markdown: 'No data available', tableData: [] };
    
    // Handle array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) return { markdown: 'No data available', tableData: [] };
      
      // Array of objects case
      if (typeof data[0] === 'object' && data[0] !== null) {
        const columns = Array.from(new Set(
          data.flatMap(obj => Object.keys(obj))
        ));
        
        // Convert to array of arrays for tableData
        const tableData = data.map(obj => {
          return columns.map(col => obj[col] ?? '');
        });
        
        // Create markdown
        let markdown = '| ' + columns.join(' | ') + ' |\n';
        markdown += '| ' + columns.map(() => '---').join(' | ') + ' |\n';
        
        for (const row of data) {
          markdown += '| ' + columns.map(col => row[col] ?? '').join(' | ') + ' |\n';
        }
        
        return { markdown, tableData: [columns, ...tableData] };
      }
      
      // Array of primitives case
      const markdown = data.map(item => `- ${item}`).join('\n');
      return { markdown, tableData: [['Value'], ...data.map(item => [item])] };
    }
    
    // Handle single object
    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data);
      if (entries.length === 0) return { markdown: 'No data available', tableData: [] };
      
      let markdown = '| Key | Value |\n| --- | --- |\n';
      
      for (const [key, value] of entries) {
        if (typeof value === 'object' && value !== null) {
          markdown += `| ${key} | ${JSON.stringify(value)} |\n`;
        } else {
          markdown += `| ${key} | ${value} |\n`;
        }
      }
      
      const tableData = [['Key', 'Value'], ...entries.map(([k, v]) => [k, v])];
      return { markdown, tableData };
    }
    
    // Handle primitive value
    return { 
      markdown: String(data), 
      tableData: [['Value'], [data]] 
    };
  }

  /**
   * Parse and format DNS record data for display
   */
  public static formatDnsRecords(records: any[]): { markdown: string, tableData: any[] } {
    if (!records || records.length === 0) {
      return { markdown: 'No DNS records available', tableData: [] };
    }
    
    // Group records by type
    const recordsByType: Record<string, any[]> = {};
    
    for (const record of records) {
      const type = record.type || 'Unknown';
      if (!recordsByType[type]) {
        recordsByType[type] = [];
      }
      recordsByType[type].push(record);
    }
    
    // Format as markdown
    let markdown = '';
    const tableData: any[] = [];
    
    for (const [type, typeRecords] of Object.entries(recordsByType)) {
      markdown += `### ${type} Records\n\n`;
      
      // Get all possible fields for this record type
      const allFields = new Set<string>();
      typeRecords.forEach(record => {
        Object.keys(record).forEach(key => {
          if (key !== 'type') allFields.add(key);
        });
      });
      
      const fields = Array.from(allFields);
      
      // Add table header
      markdown += '| ' + fields.join(' | ') + ' |\n';
      markdown += '| ' + fields.map(() => '---').join(' | ') + ' |\n';
      
      // Add rows
      for (const record of typeRecords) {
        markdown += '| ' + fields.map(field => record[field] || '').join(' | ') + ' |\n';
      }
      
      markdown += '\n';
      
      // Add to table data for UI rendering
      tableData.push({
        type,
        records: typeRecords
      });
    }
    
    return { markdown, tableData };
  }

  /**
   * Format data by content type with enhanced table detection
   */
  public static formatByContentType(
    data: any, 
    contentType: string,
    subType?: string
  ): { markdown: string, tableData: any[] } {
    console.log(`Formatting data with content type: ${contentType}, subType: ${subType}`);
    
    // Handle DNS records
    if (contentType === 'technical' && subType === 'dns') {
      return this.formatDnsRecords(data);
    }
    
    // Handle tabular data (CSV/Excel)
    if (contentType === 'tabular') {
      // If data is a string, try to parse it as JSON or CSV
      if (typeof data === 'string') {
        try {
          // Try to parse as JSON
          const parsedData = JSON.parse(data);
          data = parsedData;
        } catch {
          // Try to parse as CSV
          const parsedData = this.parseCSVLikeContent(data);
          if (parsedData && parsedData.length > 0) {
            data = parsedData;
          }
        }
      }
      
      // Get table config for UI
      const tableConfig = this.formatForUI(Array.isArray(data) ? data : [data]);
      
      // Convert to markdown
      const markdown = Array.isArray(data) 
        ? this.toMarkdownTable(data) 
        : this.toMarkdownTable([data]);
        
      return { 
        markdown, 
        tableData: tableConfig.data?.rows || []
      };
    }
    
    // Handle general JSON data
    return this.formatJsonToTable(data);
  }

  pivot(data: any[], keysColumn: string, valuesColumn: string, operation: string = 'sum'): any[] {
    // Early return for empty data
    if (!data || data.length === 0) return [];

    // Validate required columns exist in the data
    const sample = data[0];
    if (!sample || !(keysColumn in sample) || !(valuesColumn in sample)) {
      console.error('Invalid columns for pivot operation:', { keysColumn, valuesColumn });
      return data;
    }

    // Get unique values for the keys column
    const uniqueKeys = Array.from(new Set(data.map(row => row[keysColumn])));
    
    // Group data by all the other columns
    const groups: { [key: string]: any[] } = {};
    
    // Find all columns except the keys and values columns for grouping
    const groupColumns = Object.keys(sample).filter(col => col !== keysColumn && col !== valuesColumn);
    
    // Generate groups
    data.forEach(row => {
      const groupKey = groupColumns.map(col => String(row[col])).join('|');
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(row);
    });
    
    // For each group, create a new pivoted row
    const result = Object.entries(groups).map(([_, rows]) => {
      // Create a new row with the group columns
      const newRow: any = {};
      
      if (groupColumns.length > 0) {
        // Extract group column values from the first row in the group
        groupColumns.forEach(col => {
          newRow[col] = rows[0][col];
        });
      }
      
      // Compute the aggregated value for each unique key
      uniqueKeys.forEach(key => {
        const matchingRows = rows.filter(row => row[keysColumn] === key);
        const values = matchingRows.map(row => Number(row[valuesColumn]) || 0);
        
        // Perform the requested operation
        let value;
        switch (operation.toLowerCase()) {
          case 'sum':
            value = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'min':
            value = values.length > 0 ? Math.min(...values) : 0;
            break;
          case 'max':
            value = values.length > 0 ? Math.max(...values) : 0;
            break;
          case 'count':
            value = matchingRows.length;
            break;
          default:
            value = values.reduce((a, b) => a + b, 0);
        }
        
        // Add the pivoted value to the new row
        newRow[String(key)] = value;
      });
      
      return newRow;
    });
    
    return result;
  }
} 