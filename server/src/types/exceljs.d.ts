declare module 'exceljs' {
  export class Workbook {
    worksheets: Worksheet[];
    xlsx: {
      readFile(path: string): Promise<Workbook>;
    };
  }

  export class Worksheet {
    name: string;
    getRow(rowNumber: number): Row;
    eachRow(callback: (row: Row, rowNumber: number) => void): void;
  }

  export class Row {
    eachCell(callback: (cell: Cell, colNumber: number) => void): void;
  }

  export class Cell {
    value: CellValue;
  }

  export type CellValue = string | number | boolean | Date | CellRichTextValue | CellHyperlinkValue | CellFormulaValue | CellErrorValue | null | undefined;
  
  export interface CellRichTextValue {
    text: string;
    richText: any[];
  }
  
  export interface CellHyperlinkValue {
    text: string;
    hyperlink: string;
  }
  
  export interface CellFormulaValue {
    formula: string;
    result: any;
  }
  
  export interface CellSharedFormulaValue {
    sharedFormula: string;
    result: any;
  }
  
  export interface CellErrorValue {
    error: any;
  }
} 