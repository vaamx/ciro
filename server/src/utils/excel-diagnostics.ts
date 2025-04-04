import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createServiceLogger } from './logger-factory';

const logger = createServiceLogger('ExcelDiagnostics');

/**
 * Utility to diagnose Excel file issues
 */
export class ExcelDiagnostics {
  /**
   * Run diagnostics on an Excel file to determine why it might not be processing correctly
   * @param filePath Path to the Excel file
   * @returns Diagnostic results
   */
  static async diagnoseExcelFile(filePath: string): Promise<any> {
    logger.info(`Running Excel diagnostics on file: ${path.basename(filePath)}`);
    
    if (!fs.existsSync(filePath)) {
      logger.error(`File does not exist: ${filePath}`);
      return { success: false, error: 'File not found' };
    }
    
    try {
      // Check file stats
      const stats = fs.statSync(filePath);
      const results = {
        success: false,
        fileInfo: {
          name: path.basename(filePath),
          size: stats.size,
          extension: path.extname(filePath),
          lastModified: stats.mtime
        },
        parseAttempts: [],
        recommendations: []
      };
      
      // Try various parsing methods
      
      // Method 1: Standard parsing
      try {
        logger.info('Attempting standard parsing...');
        const workbook1 = XLSX.readFile(filePath);
        results.parseAttempts.push({
          method: 'standard',
          success: true,
          sheetCount: workbook1.SheetNames.length,
          sheets: workbook1.SheetNames
        });
      } catch (error) {
        results.parseAttempts.push({
          method: 'standard',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Method 2: Binary mode
      try {
        logger.info('Attempting binary parsing...');
        const data = fs.readFileSync(filePath, 'binary');
        const workbook2 = XLSX.read(data, { type: 'binary' });
        results.parseAttempts.push({
          method: 'binary',
          success: true,
          sheetCount: workbook2.SheetNames.length,
          sheets: workbook2.SheetNames
        });
      } catch (error) {
        results.parseAttempts.push({
          method: 'binary',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Method 3: Buffer mode
      try {
        logger.info('Attempting buffer parsing...');
        const buffer = fs.readFileSync(filePath);
        const workbook3 = XLSX.read(buffer, { type: 'buffer' });
        results.parseAttempts.push({
          method: 'buffer',
          success: true,
          sheetCount: workbook3.SheetNames.length,
          sheets: workbook3.SheetNames
        });
      } catch (error) {
        results.parseAttempts.push({
          method: 'buffer',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Method 4: Array mode
      try {
        logger.info('Attempting array parsing...');
        const workbook4 = XLSX.readFile(filePath, { type: 'array' });
        results.parseAttempts.push({
          method: 'array',
          success: true,
          sheetCount: workbook4.SheetNames.length,
          sheets: workbook4.SheetNames
        });
      } catch (error) {
        results.parseAttempts.push({
          method: 'array',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Analyze results and make recommendations
      const successfulMethods = results.parseAttempts.filter(a => a.success);
      
      if (successfulMethods.length > 0) {
        results.success = true;
        results.recommendations.push(`Use the '${successfulMethods[0].method}' parsing method which successfully read ${successfulMethods[0].sheetCount} sheets.`);
      } else {
        results.recommendations.push('The file appears to be corrupted or not a valid Excel file.');
        
        // Check if it's an empty file
        if (stats.size === 0) {
          results.recommendations.push('The file is empty. Please check the file and try again.');
        }
        
        // Check if it's actually a different format (CSV, etc.)
        const fileContent = fs.readFileSync(filePath, 'utf8').slice(0, 1000);
        if (fileContent.includes(',') && fileContent.split('\n').length > 1) {
          results.recommendations.push('The file appears to be a CSV file, not an Excel file. Try uploading as CSV instead.');
        }
        
        // Check if file is very large
        if (stats.size > 10 * 1024 * 1024) { // 10MB
          results.recommendations.push('The file is very large. Try splitting it into smaller files.');
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Error running Excel diagnostics:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Example usage:
// ExcelDiagnostics.diagnoseExcelFile('/path/to/problematic-file.xlsx')
//   .then(results => console.log(JSON.stringify(results, null, 2)))
//   .catch(err => console.error('Diagnostic error:', err)); 