import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';

const logger = createServiceLogger('ExcelDiagnostic');

/**
 * Diagnostic tool for Excel file processing
 * Helps identify issues with Excel data retrieval
 */
export class ExcelDiagnostic {
  /**
   * Run diagnostics on an Excel file
   * @param filePath Path to the Excel file
   */
  static async runDiagnostics(filePath: string): Promise<any> {
    logger.info(`Running diagnostics on Excel file: ${path.basename(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      return { error: 'File not found' };
    }
    
    try {
      // Load the file with various options to test different approaches
      logger.info('Testing different Excel parsing approaches');
      
      const results: any = {
        fileInfo: {
          fileName: path.basename(filePath),
          fileSize: fs.statSync(filePath).size,
          extension: path.extname(filePath)
        },
        parsingResults: {},
      };
      
      // Approach 1: Default settings
      try {
        const workbook1 = XLSX.readFile(filePath);
        results.parsingResults.default = {
          success: true,
          sheets: workbook1.SheetNames,
          sheetCount: workbook1.SheetNames.length,
          firstSheetSample: this.getSampleData(workbook1, workbook1.SheetNames[0])
        };
      } catch (error) {
        results.parsingResults.default = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
      
      // Approach 2: Raw values only
      try {
        const workbook2 = XLSX.readFile(filePath, {
          cellFormula: false,
          cellHTML: false,
          cellText: true,
          cellDates: true,
          cellStyles: false,
          raw: true
        });
        results.parsingResults.rawOnly = {
          success: true,
          sheets: workbook2.SheetNames,
          sheetCount: workbook2.SheetNames.length,
          firstSheetSample: this.getSampleData(workbook2, workbook2.SheetNames[0])
        };
      } catch (error) {
        results.parsingResults.rawOnly = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
      
      // Approach 3: With SheetJS options
      try {
        const workbook3 = XLSX.readFile(filePath, {
          WTF: true, // If true, throw errors on unexpected file features
          cellDates: true,
          cellNF: true,
          cellStyles: true,
          dateNF: 'yyyy-mm-dd'
        });
        results.parsingResults.fullOptions = {
          success: true,
          sheets: workbook3.SheetNames,
          sheetCount: workbook3.SheetNames.length,
          firstSheetSample: this.getSampleData(workbook3, workbook3.SheetNames[0])
        };
      } catch (error) {
        results.parsingResults.fullOptions = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
      
      // Identify potential issues
      results.issues = this.identifyIssues(results);
      
      logger.info('Diagnostics completed');
      return results;
    } catch (error) {
      logger.error('Error during diagnostics:', error);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get sample data from a worksheet
   */
  private static getSampleData(workbook: XLSX.WorkBook, sheetName: string) {
    try {
      const worksheet = workbook.Sheets[sheetName];
      
      // Get sheet dimensions
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const rowCount = range.e.r - range.s.r + 1;
      const colCount = range.e.c - range.s.c + 1;
      
      // Extract headers (first row)
      const headers = XLSX.utils.sheet_to_json<string[]>(worksheet, { 
        header: 1,
        range: { s: { r: range.s.r, c: range.s.c }, e: { r: range.s.r, c: range.e.c } }
      })[0] || [];
      
      // Extract a sample of rows (up to 5)
      const maxRows = Math.min(5, rowCount - 1);
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        range: { s: { r: range.s.r + 1, c: range.s.c }, e: { r: range.s.r + maxRows, c: range.e.c } }
      });
      
      return {
        dimensions: { rows: rowCount, columns: colCount },
        headers,
        rowSample: rows
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Identify potential issues based on diagnostic results
   */
  private static identifyIssues(results: any) {
    const issues = [];
    
    // Check for file format issues
    if (results.fileInfo.extension !== '.xlsx' && results.fileInfo.extension !== '.xls') {
      issues.push('File extension is not standard for Excel files');
    }
    
    // Check for parsing failures
    const allFailed = Object.values(results.parsingResults).every(
      (result: any) => !result.success
    );
    if (allFailed) {
      issues.push('All parsing methods failed - file may be corrupt or not a valid Excel format');
    }
    
    // Check for empty results
    for (const [method, result] of Object.entries(results.parsingResults)) {
      if ((result as any).success && (result as any).sheetCount === 0) {
        issues.push(`Method ${method} found no sheets in the file`);
      }
    }
    
    // Check for inconsistent results
    const sheetCounts = Object.values(results.parsingResults)
      .filter((result: any) => result.success)
      .map((result: any) => result.sheetCount);
    
    if (new Set(sheetCounts).size > 1) {
      issues.push('Inconsistent sheet counts between parsing methods');
    }
    
    return issues;
  }
}

// Function to run as a script
export async function runExcelDiagnosticScript(filePath: string) {
  if (!filePath) {
    logger.error('No file path provided');
    return;
  }
  
  try {
    logger.info(`Starting Excel diagnostic for file: ${filePath}`);
    const result = await ExcelDiagnostic.runDiagnostics(filePath);
    
    // Print results
    logger.info('Diagnostic results:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.issues && result.issues.length > 0) {
      logger.warn('Issues identified:');
      for (const issue of result.issues) {
        logger.warn(`- ${issue}`);
      }
    } else if (!result.error) {
      logger.info('No issues identified with Excel parsing');
    }
    
    return result;
  } catch (error) {
    logger.error('Error running diagnostic script:', error);
  }
}

// Run if called directly
if (require.main === module) {
  const filePath = process.argv[2];
  runExcelDiagnosticScript(filePath);
} 