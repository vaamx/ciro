# Improvement Plan: Enhanced CSV Processing & Tabular Data Presentation

## Current Situation

From the codebase analysis, we've identified the following issues:

1. **CSV Processing Gap**: While Excel files benefit from enhanced intelligence with multi-step processing, CSV files don't receive the same treatment, despite having similar tabular structures.

2. **Tabular Output Formatting**: The system doesn't consistently generate well-formatted tabular responses for CSV data.

3. **Inconsistent Query Handling**: Different file types (Excel vs CSV) are handled differently in the query processing pipeline.

## Proposed Solution

We'll implement a comprehensive solution with four main components:

### 1. Enhanced CSV Processor Implementation

Apply the same multi-step processing approach used for Excel files to CSV files:

- Create an `EnhancedCsvProcessorService` class extending the current `CsvProcessorService`
- Implement specialized analytical and statistical processing for CSV data
- Add metadata extraction similar to Excel processing

### 2. Unified Query Processing Pipeline

Standardize the query handling for tabular data regardless of source format:

- Update the `RagService` to detect and handle CSV data similarly to Excel data
- Implement CSV-specific handling in `processAnalyticalQuery` and related methods
- Extend the `isTabularDataQuery` detector to better handle CSV-specific terminologies

### 3. Improved Tabular Response Generation

Enhance the formatting of tabular data in responses:

- Create a dedicated `TableFormatter` service responsible for rendering tabular data consistently
- Implement markdown table generation for chat responses
- Add structured JSON response format for UI rendering

### 4. Enhanced UI Rendering for Tables

Improve how tables are displayed in the UI:

- Update `DataTable` component to better handle large data sets
- Add pagination, sorting, and filtering capabilities to table displays
- Improve the visual styling of tables for better readability

## Implementation Details

### 1. Enhanced CSV Processor Service

```typescript
// server/src/services/document-processors/enhanced-csv-processor.service.ts

import { CsvProcessorService } from './csv-processor.service';
// ... other imports

export class EnhancedCsvProcessorService extends CsvProcessorService {
  // Similar structure to EnhancedExcelProcessorService
  
  async processFile(filePath: string, dataSourceId: string, metadata: Record<string, any> = {}): Promise<ProcessingResult> {
    // Enhanced multi-step processing:
    // 1. Parse CSV and extract metadata
    // 2. Analyze structure and content
    // 3. Generate embeddings with enhanced context
    // 4. Store with rich metadata for better retrieval
    // ...
  }
  
  // Add methods for statistical analysis similar to Excel processor
  private generateBasicStatistics(headers: string[], data: any[][]): string {
    // Similar to Excel implementation
  }
}
```

### 2. CSV Query Processing Integration

```typescript
// dashboard/src/services/rag/RagService.ts - Update to detect CSV data

private isCSVData(documents: Document[]): boolean {
  return documents.some(doc => 
    doc.metadata?.source === 'csv' || 
    (doc.content && doc.content.includes('CSV Columns:'))
  );
}

private async processQuery(query: string, documents: Document[]): Promise<string> {
  // Existing Excel detection
  const isExcelData = documents.some(doc => 
    doc.metadata?.source === 'excel' || 
    (doc.content && doc.content.includes('Sheet:') && doc.content.includes('\t'))
  );
  
  // Add CSV detection
  const isCSVData = this.isCSVData(documents);
  
  // Merge tabular data handling
  const isTabularData = isExcelData || isCSVData;
  const isTabularDataQuery = this.isTabularDataQuery(query);
  
  if (isTabularData && isTabularDataQuery) {
    return await this.processTabularDataQuery(query, documents);
  }
  
  // Rest of the method...
}

// New unified method for tabular data processing
private async processTabularDataQuery(query: string, documents: Document[]): Promise<string> {
  // Handle both Excel and CSV data with appropriate templates
  const dataSource = documents[0]?.metadata?.source === 'csv' ? 'CSV' : 'Excel';
  
  // Use appropriate template based on data source
  const promptTemplate = dataSource === 'CSV' 
    ? this.promptTemplates.getCSVDataExtractionPrompt() 
    : this.promptTemplates.getForceDataExtractionPrompt();
    
  // Rest of processing...
}
```

### 3. Adding CSV-Specific Templates

```typescript
// dashboard/src/services/rag/PromptTemplates.ts - Add CSV template

/**
 * Get a special override template for CSV data extraction
 */
public getCSVDataExtractionPrompt(): string {
  return `CRITICAL: This is a CSV data extraction task. You must extract EXACTLY what is in the provided data and format it as proper tables.

DATA:
{context}

QUERY:
{query}

INSTRUCTIONS:
1. DO NOT hallucinate or make up ANY information
2. ONLY present what is EXPLICITLY found in the data above
3. PRESERVE the exact table structure from the CSV data
4. Format tables using markdown table syntax with proper alignment
5. Include column headers and maintain column relationships
6. Keep all numerical values EXACTLY as they appear in the data (do not reformat numbers)
7. If information isn't available, say "This information is not in the provided data"

TABLE FORMATTING EXAMPLES:
For data like:
"Record 1:
Name: John
Age: 34
Location: New York" 

Create a properly formatted markdown table:

| Name | Age | Location |
|------|-----|----------|
| John | 34  | New York |

Begin with: "Based ONLY on the data provided, here is the requested information in table format:"`;
}
```

### 4. Table Formatter Service

```typescript
// dashboard/src/services/TableFormatter.ts

export class TableFormatter {
  /**
   * Convert data to a markdown table string
   */
  public static toMarkdownTable(data: any[], columns?: string[]): string {
    if (!data || data.length === 0) return "No data available";
    
    // Get columns from first row if not provided
    const headers = columns || Object.keys(data[0]);
    
    // Create header row
    let table = "| " + headers.join(" | ") + " |\n";
    
    // Add separator row
    table += "| " + headers.map(() => "---").join(" | ") + " |\n";
    
    // Add data rows
    for (const row of data) {
      const rowValues = headers.map(col => {
        const value = row[col];
        return value !== null && value !== undefined ? String(value) : "";
      });
      table += "| " + rowValues.join(" | ") + " |\n";
    }
    
    return table;
  }
  
  /**
   * Format data for UI display
   */
  public static formatForUI(data: any[], columns?: string[]): TableConfig {
    // Implementation for UI formatting
  }
}
```

### 5. Enhanced UI Table Components

```tsx
// dashboard/src/components/Tables/EnhancedDataTable.tsx

import React, { useState } from 'react';
import { TableProps } from './types';

export const EnhancedDataTable: React.FC<TableProps> = ({
  data,
  title,
  width = '100%',
  height = 400,
  paginate = true,
  pageSize = 10,
  sortable = true,
  filterable = true
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Get column headers from first item
  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
  
  // Apply sorting
  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data;
    
    return [...data].sort((a, b) => {
      if (a[sortColumn] < b[sortColumn]) return sortDirection === 'asc' ? -1 : 1;
      if (a[sortColumn] > b[sortColumn]) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);
  
  // Apply pagination
  const paginatedData = React.useMemo(() => {
    if (!paginate) return sortedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, paginate]);
  
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
  
  // Pagination controls
  const totalPages = paginate ? Math.ceil(data.length / pageSize) : 1;
  
  // Render table implementation
  // ...table rendering code...
};
```

## Implementation Plan

1. **Phase 1: Enhanced CSV Processing (Week 1-2)**
   - Create `EnhancedCsvProcessorService` class
   - Implement multi-step processing for CSV files
   - Add unit tests for CSV processing

2. **Phase 2: Unified Query Processing (Week 2-3)**
   - Update `RagService` to handle CSV data
   - Add CSV-specific templates
   - Update query detection logic

3. **Phase 3: Improved Table Formatting (Week 3-4)**
   - Create `TableFormatter` service
   - Implement markdown and JSON table generation
   - Add support for large datasets and pagination

4. **Phase 4: Enhanced UI Components (Week 4-5)**
   - Create enhanced table components
   - Implement sorting, filtering, and pagination
   - Update styling for better readability

5. **Phase 5: Testing and Refinement (Week 5-6)**
   - End-to-end testing
   - Performance optimization
   - User feedback and adjustments

## Expected Outcomes

- **Consistent Experience**: Users will get the same high-quality experience whether querying Excel or CSV data
- **Better Tabular Outputs**: All tabular data will be presented in well-formatted, easy-to-read tables
- **Enhanced UI**: Tables in the UI will be more interactive and user-friendly
- **Improved Response Quality**: The multi-step processing will provide more context-aware and accurate responses

## Future Enhancements

- Add support for more tabular formats (JSON, YAML, etc.)
- Implement cross-file querying for related data
- Add visual data exploration tools for tabular data
- Implement export functionality for query results
- Add customizable table views and saved views 