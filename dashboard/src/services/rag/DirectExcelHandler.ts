import { ExcelDataParser } from './ExcelDataParser';
import { OpenAIService } from '../openai/OpenAIService';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * DirectExcelHandler - A specialized handler for Excel data queries
 * that bypasses the problematic RAG system and directly provides
 * structured data to the LLM.
 */
export class DirectExcelHandler {
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = new OpenAIService();
  }

  /**
   * Process an Excel data query with reliable results
   * @param query The user's query
   * @returns A formatted response with accurate Excel data
   */
  public async processExcelQuery(query: string): Promise<string> {
    console.log(`Processing Excel query directly: "${query}"`);
    
    // Get the demo data (this would be replaced with actual data in production)
    const tableData = ExcelDataParser.getDemoData();
    
    // Create a specialized prompt that forces the LLM to use only the provided data
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a data analysis assistant that ONLY answers questions based on the EXACT Excel data provided. 
DO NOT generate or hallucinate any data. ONLY use the information that is explicitly present in the provided table.
Respond with accurate figures from the table. If asked for info not in the table, state that it's not available.
Format your response using markdown headings and proper formatting.`
      },
      {
        role: 'user',
        content: `Here is the exact Excel data from the spreadsheet:

${tableData}

Please answer the following question ONLY using this data. Do not make up or invent any information:

${query}`
      }
    ];
    
    try {
      const response = await this.openaiService.createChatCompletion(
        messages,
        {
          model: 'gpt-4o',
          temperature: 0.0,
          max_tokens: 1500
        }
      );
      
      return response || 'Failed to get a response from the Excel data query';
    } catch (error: any) {
      console.error('Error in processExcelQuery:', error);
      return `I encountered an error while processing your Excel query: ${error.message || 'Unknown error'}`;
    }
  }

  /**
   * Determines if a query is about Excel data
   * @param query The user's query
   * @returns True if the query is about Excel data
   */
  public isExcelDataQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Check for Excel/table-related terms
    const excelTerms = [
      'excel', 'spreadsheet', 'table', 'column', 'row',
      'sales', 'revenue', 'profit', 'figures', 'segment', 'zone',
      'total', 'segment', 'nestlé', 'nespresso'
    ];
    
    // Check if the query contains any Excel-related terms
    return excelTerms.some(term => lowerQuery.includes(term));
  }
} 