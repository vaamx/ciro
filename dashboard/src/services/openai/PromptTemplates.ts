import { DataSourceType } from '../processors/UniversalDataProcessor';
import { ServerAnalyticsService, AnalyticalOperationType, QueryType } from '../ServerAnalyticsService';

/**
 * Centralized prompt management for the OpenAI service
 */
export class PromptTemplates {
  private serverAnalyticsService: ServerAnalyticsService;
  
  constructor() {
    this.serverAnalyticsService = ServerAnalyticsService.getInstance();
  }
  
  /**
   * Get system prompt for RAG
   */
  public getSystemPrompt(): string {
    return `You are a helpful assistant that answers questions based on the provided context. 
If the answer is not in the context, say that you don't know. 
Do not make up information that is not provided in the context.
Always cite your sources by referring to the document numbers.`;
  }
  
  /**
   * Get query prompt with context
   */
  public getQueryPrompt(question: string, context: string): string {
    return `Context information is below.
---------------------
${context}
---------------------
Given the context information and not prior knowledge, answer the question: ${question}`;
  }

  /**
   * Get universal structured response prompt for any data type
   * @param dataSourceType The type of data source being analyzed
   * @param analyticalOperations Optional list of analytical operations to include
   */
  public async getUniversalStructuredPrompt(
    dataSourceType: DataSourceType, 
    query: string,
    analyticalOperations?: AnalyticalOperationType[]
  ): Promise<string> {
    // If analytical operations are not provided, try to determine them
    if (!analyticalOperations) {
      try {
        analyticalOperations = await this.serverAnalyticsService.determineAnalyticalOperations(query);
      } catch (error) {
        console.error('Error determining analytical operations:', error);
        analyticalOperations = [];
      }
    }
    
    // Get query analysis for more targeted instructions
    let queryType = QueryType.GENERAL;
    try {
      const queryAnalysis = await this.serverAnalyticsService.analyzeQuery(query);
      queryType = queryAnalysis.queryType;
    } catch (error) {
      console.error('Error analyzing query:', error);
    }
    
    // Common structured response format
    const commonPrompt = `You are an expert data analyst specializing in ${dataSourceType.toLowerCase()} data analysis.
Analyze the provided data according to the user's question and provide a clear, structured response.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE:

## Summary
[Brief summary of your findings in 2-3 sentences]

## Steps
1. [First analytical step with TYPE label, e.g., "FILTERING: First, I identified..."]
2. [Second analytical step with TYPE label]
3. [Third analytical step with TYPE label]
[Add more steps as needed]

## Insights
- [Key insight 1]
- [Key insight 2]
- [Key insight 3]
[Add more insights as needed]

## Visualization
Chart Type: [appropriate chart type]
X-Axis: [appropriate x-axis field]
Y-Axis: [appropriate y-axis field]
Data:
\`\`\`json
[Include the relevant data for visualization in JSON format]
\`\`\`

## Table
\`\`\`json
[Include the most relevant data in tabular JSON format]
\`\`\`

CRITICAL INSTRUCTIONS:
- ONLY analyze what's actually in the provided data
- NEVER make up data
- ALWAYS categorize each analysis step using one of these types: filtering, aggregation, grouping, sorting, visualization, comparative, statistical, insights
- Structure your JSON for visualizations carefully - it must be valid JSON
- Choose the most appropriate visualization type based on the data and query
`;

    // Data source specific instructions
    let dataSpecificPrompt = '';
    switch (dataSourceType) {
      case DataSourceType.EXCEL:
      case DataSourceType.CSV:
      case DataSourceType.TABLE:
        dataSpecificPrompt = `
TABULAR DATA INSTRUCTIONS:
- Use proper column names from the data in your analysis
- For numeric columns, consider using statistical measures (mean, median, sum, etc.)
- When creating visualizations from tabular data:
  * For temporal data (dates, times), prefer line charts with time on x-axis
  * For categorical comparisons, use bar charts
  * For part-to-whole relationships, use pie charts
  * For correlations between numeric values, use scatter plots
  * For distributions, use histograms`;
        break;
        
      case DataSourceType.JSON:
        dataSpecificPrompt = `
JSON DATA INSTRUCTIONS:
- Navigate and reference the JSON structure clearly in your analysis
- If the JSON is hierarchical, flatten relevant portions for visualization
- Pay attention to nested arrays and objects
- Create structured tables from nested data when appropriate`;
        break;
        
      case DataSourceType.PDF:
      case DataSourceType.DOC:
        dataSpecificPrompt = `
DOCUMENT DATA INSTRUCTIONS:
- Extract key information from the document text
- Look for patterns, frequencies, and structural elements
- If tables are present in the document, structure them properly
- For text analysis, consider using bar charts to visualize frequencies or categories`;
        break;
        
      case DataSourceType.TEXT:
        dataSpecificPrompt = `
TEXT DATA INSTRUCTIONS:
- Apply text analysis techniques like frequency analysis or pattern matching
- Extract structured information when possible
- Consider visualizing key term frequencies or distributions
- Create tables to organize extracted information`;
        break;
        
      default:
        dataSpecificPrompt = `
GENERAL DATA INSTRUCTIONS:
- First understand the structure of the data
- Identify patterns, trends, or outliers relevant to the query
- Transform unstructured data into structured tables when appropriate
- Choose visualizations that best represent the underlying patterns`;
        break;
    }
    
    // Add analytical operations guidance
    let analyticalGuidance = '';
    if (analyticalOperations && analyticalOperations.length > 0) {
      analyticalGuidance = `
ANALYTICAL OPERATIONS:
I've detected that your query involves these analytical operations:
${analyticalOperations.map(op => `- ${op.toUpperCase()}`).join('\n')}

Focus your analysis on these operations to provide the most relevant insights.`;
    }
    
    // Add query type guidance
    let queryTypeGuidance = '';
    if (queryType !== QueryType.GENERAL) {
      queryTypeGuidance = `
QUERY TYPE: ${queryType.toUpperCase()}
Your query appears to be a ${queryType.toLowerCase()} question. I'll focus on providing:`;
      
      switch (queryType) {
        case QueryType.DESCRIPTIVE:
          queryTypeGuidance += `
- Clear description of what the data shows
- Summary statistics and key patterns
- Visual representation of the current state`;
          break;
        case QueryType.DIAGNOSTIC:
          queryTypeGuidance += `
- Analysis of causes and contributing factors
- Evidence-based explanations
- Comparative analysis of different factors`;
          break;
        case QueryType.PREDICTIVE:
          queryTypeGuidance += `
- Future projections based on current data
- Trend analysis and pattern recognition
- Confidence levels in predictions`;
          break;
        case QueryType.COMPARATIVE:
          queryTypeGuidance += `
- Direct comparisons between different entities/categories
- Highlighting differences and similarities
- Quantifying the degree of difference`;
          break;
        default:
          queryTypeGuidance = '';
      }
    }
    
    return `${commonPrompt}\n${dataSpecificPrompt}\n${analyticalGuidance}\n${queryTypeGuidance}`;
  }

  /**
   * Get analytical prompt for complex queries with data source type support
   * @param dataSourceType The type of data source being analyzed
   */
  public async getEnhancedAnalyticalPrompt(dataSourceType: DataSourceType, query: string): Promise<string> {
    // Try to get query analysis from ServerAnalyticsService
    let queryAnalysis = null;
    try {
      queryAnalysis = await this.serverAnalyticsService.analyzeQuery(query);
    } catch (error) {
      console.error('Error analyzing query:', error);
    }
    
    // Base analytical prompt
    const basePrompt = `You are a comprehensive analytical assistant specializing in ${dataSourceType.toLowerCase()} data.
When analyzing the provided information:

1. Always count and summarize relevant items that match the query criteria
2. Begin your response with a clear summary of the quantitative findings
3. Consider multiple perspectives and provide a comprehensive view of the data
4. Explicitly report statistics, counts, and patterns you identify
5. Organize information in a structured way with clear sections
6. If appropriate, categorize or group similar items in your analysis
7. Use the provided context to support your analysis, and cite specific data points
8. If the information is not sufficient, acknowledge the limitations of your analysis`;

    // Data source specific instructions
    let dataSpecificPrompt = '';
    switch (dataSourceType) {
      case DataSourceType.EXCEL:
      case DataSourceType.CSV:
      case DataSourceType.TABLE:
        dataSpecificPrompt = `
TABULAR DATA ANALYSIS GUIDELINES:
- Reference specific column names in your analysis
- Mention exact counts, sums, averages, etc. when analyzing numeric data
- When comparing categories, specify the exact values being compared
- For time-based data, describe trends and patterns chronologically
- If appropriate, suggest correlations between different columns`;
        break;
        
      case DataSourceType.PDF:
      case DataSourceType.DOC:
        dataSpecificPrompt = `
DOCUMENT ANALYSIS GUIDELINES:
- Extract and cite key pieces of information with document page references
- Identify main themes, topics, and entities mentioned in the document
- If tables or figures are present, describe their content specifically
- Organize your analysis by sections, themes, or chronology as appropriate`;
        break;
        
      case DataSourceType.JSON:
        dataSpecificPrompt = `
JSON DATA ANALYSIS GUIDELINES:
- Navigate and reference the JSON structure in your analysis (e.g., "In the 'users' array...")
- For nested structures, clearly indicate the path to the relevant data
- Summarize counts, patterns, and statistics across arrays of objects
- Identify key-value pairs that are most relevant to the query`;
        break;
        
      case DataSourceType.TEXT:
        dataSpecificPrompt = `
TEXT ANALYSIS GUIDELINES:
- Identify key phrases, terms, or patterns that appear in the text
- Count occurrences of important terms or concepts
- Extract structured information and present it in an organized format
- Cite specific sections or passages to support your analysis`;
        break;
        
      default:
        dataSpecificPrompt = `
GENERAL ANALYSIS GUIDELINES:
- First understand the structure and format of the provided information
- Identify the most relevant data points for the specific query
- Extract patterns, trends, or anomalies in the data
- Provide concrete examples from the data to support your findings`;
        break;
    }
    
    // Add query analysis insights if available
    let queryTypePrompt = '';
    if (queryAnalysis) {
      queryTypePrompt = `
YOUR QUERY ANALYSIS:
- Query type: ${queryAnalysis.queryType}
- Domain: ${queryAnalysis.domain}
- Relevant entities: ${queryAnalysis.entities.join(', ') || 'None detected'}

Based on this analysis, I'll focus my response on ${queryAnalysis.queryType.toLowerCase()} analysis in the ${queryAnalysis.domain.toLowerCase()} domain.`;
    }
    
    return `${basePrompt}\n${dataSpecificPrompt}\n${queryTypePrompt}`;
  }

  /**
   * Get analytical prompt for complex queries - legacy method for backward compatibility
   */
  public getAnalyticalPrompt(): string {
    return `You are a comprehensive analytical assistant that provides detailed, data-driven responses.
When analyzing the provided documents:

1. Always count and summarize relevant items that match the query criteria
2. Begin your response with a clear summary of the quantitative findings (e.g., "I found X records...")
3. Consider multiple perspectives and provide a comprehensive view of the data
4. Explicitly report statistics, counts, and patterns you identify
5. Organize information in a structured way with clear sections
6. If appropriate, categorize or group similar items in your analysis
7. Use the provided context to support your analysis, and cite specific data points
8. If the information is not sufficient, acknowledge the limitations of your analysis

Remember: For questions asking about quantities, counts, or general document content,
you should make your best effort to analyze ALL the provided documents thoroughly.`;
  }

  /**
   * Get document overview prompt
   */
  public getDocumentOverviewPrompt(): string {
    return `You are analyzing the contents of a document collection.
Your task is to provide a comprehensive overview of what these documents contain.

1. Begin with a clear summary of what the document collection is about
2. Identify the main entities, topics, and themes present in the documents
3. Report the approximate number of documents and their general structure
4. Organize your analysis by key topics or categories you've identified
5. Highlight any particularly significant information you've found
6. Be specific and cite document numbers when referring to important details

Your goal is to give the user a complete understanding of what information is 
available in this document collection.`;
  }

  /**
   * Get entity-specific prompt
   */
  public getEntityPrompt(entityName: string): string {
    return `You are providing information about ${entityName}.
Focus on key details about ${entityName} from the provided context.
Organize the information in a clear, structured way.
If there are multiple possible interpretations of who/what ${entityName} is, clarify this in your response.`;
  }
  
  /**
   * Get general data analysis prompt for any entities
   */
  public getGeneralEntityAnalysisPrompt(entities: string[]): string {
    const entityText = entities.length > 0 
      ? `with special attention to: ${entities.join(', ')}`
      : 'across all mentioned entities';
      
    return `You are performing a comprehensive analysis of the documents ${entityText}.

1. Begin your response with a clear summary of your findings, including explicit counts
2. For each relevant entity, report the number of occurrences/mentions found
3. When counting entities, avoid duplicates and clearly explain your counting methodology
4. Organize your analysis in a structured way with sections for each entity (if applicable)
5. Provide specific details from the documents to support your analysis
6. If asked about quantities, ensure you provide precise counts based on the documents
7. Cite document numbers when referring to specific information

Remember to thoroughly analyze ALL the provided documents to give the most accurate response.`;
  }
} 