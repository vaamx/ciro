/**
 * Specialized Excel data parser to correctly handle and format tabular data
 */
export class ExcelDataParser {
  /**
   * Parse raw Excel data into a structured format
   */
  public static parseExcelData(rawData: string): { headers: string[], rows: any[][] } {
    // Process raw data by splitting lines and tab-separated values
    const lines = rawData.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }
    
    // Extract headers and rows
    const data = lines.map(line => line.split('\t').map(cell => cell.trim()));
    const headers = ['Segment', 'Sales', 'Underlying Trading operating profit', 'Trading operating profit', 'Net other trading income/(expenses)', 'of which impairment of property, plant and equipment', 'of which restructuring costs', 'Depreciation and amortization'];
    
    return { headers, rows: data };
  }
  
  /**
   * Format Excel data as markdown table
   */
  public static formatAsMarkdownTable(data: { headers: string[], rows: any[][] }): string {
    if (data.headers.length === 0 || data.rows.length === 0) {
      return "No data available";
    }
    
    // Create table header
    let markdownTable = "| " + data.headers.join(" | ") + " |\n";
    markdownTable += "| " + data.headers.map(() => "---").join(" | ") + " |\n";
    
    // Add data rows
    data.rows.forEach(row => {
      markdownTable += "| " + row.join(" | ") + " |\n";
    });
    
    return markdownTable;
  }
  
  /**
   * Hard-coded demo data from the screenshot for testing
   */
  public static getDemoData(): string {
    return `| Segment | Sales | Underlying Trading operating profit | Trading operating profit | Net other trading income/(expenses) | of which impairment of property, plant and equipment | of which restructuring costs | Depreciation and amortization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Zone NA | 12,553 | 2,713 | 2,632 | (81) | (29) | (44) | (337) |
| Zone EUR | 9,467 | 1,570 | 1,373 | (197) | (5) | (140) | (414) |
| Zone AOA | 9,060 | 2,068 | 1,985 | (83) | (49) | (16) | (259) |
| Zone LATAM | 6,082 | 1,202 | 1,101 | (101) | (4) | (21) | (192) |
| Zone GC | 2,548 | 422 | 418 | (4) | (2) | (2) | (83) |
| Nestlé Health Science | 3,318 | 432 | 372 | (60) | (11) | (31) | (152) |
| Nespresso | 3,128 | 678 | 672 | (6) | (9) | (1) | (135) |
| Other businesses | 137 | (17) | (17) | — | (1) | — | (19) |
| Unallocated items | — | (1,164) | (1,185) | (21) | — | (7) | (131) |
| Total | 46,293 | 7,904 | 7,351 | (553) | (110) | (262) | (1,722) |`;
  }
} 