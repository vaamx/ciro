/**
 * Prompt templates for RAG queries
 */
export class PromptTemplates {
  /**
   * Get universal structured response prompt template that works with any data type
   * @param dataSourceType The type of data source being analyzed
   */
  public getUniversalStructuredResponsePrompt(dataSourceType: string): string {
    // Common parts shared across all data types
    const commonInstructions = `You are a specialized data analyst providing structured, step-by-step analysis.
Your task is to analyze the provided ${dataSourceType.toLowerCase()} data and respond with a well-structured, comprehensive answer.

CONTEXT:
{context}

USER QUERY:
{query}

RESPONSE STRUCTURE REQUIREMENTS:
1. Your response MUST follow this exact format:

## Summary
[Brief summary of your findings, 2-3 sentences]

## Steps
1. [First analytical step with clear type label]
2. [Second analytical step with clear type label]
3. [Third analytical step with clear type label]
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
- ONLY analyze what's in the provided data. Do not make up or hallucinate information.
- ALWAYS format the Steps section with numbered steps (1., 2., 3., etc.).
- ALWAYS include the step type at the beginning of each step (e.g. "FILTERING: First I..." or "AGGREGATION: Next I...")
- ALWAYS ensure your Steps section describes your analytical process clearly and logically.
- ALWAYS ensure your data in the Visualization and Table sections is valid JSON format.
- ALWAYS categorize each analysis step using one of the following step types:
  - filtering: When selecting a subset of data
  - aggregation: When calculating totals, averages, etc.
  - grouping: When grouping data by dimensions
  - sorting: When ordering results
  - visualization: When creating visual representations
  - comparative: When comparing different values
  - statistical: When applying statistical methods
  - insights: When drawing conclusions
`;

    // Custom instructions based on data source type
    let customInstructions = '';
    
    switch (dataSourceType.toLowerCase()) {
      case 'excel':
      case 'csv':
      case 'table':
        customInstructions = `
SPECIFIC TABULAR DATA INSTRUCTIONS:
- Treat the data as structured tabular information.
- Include precise column names from the data in your analysis.
- When aggregating, mention specific aggregation functions (SUM, AVG, COUNT, etc.).
- For visualizations, choose from: bar_chart, line_chart, pie_chart, scatter_plot, histogram, heatmap.
- For time-based data, prefer line charts and include a time dimension on the x-axis.
- For categorical comparisons, prefer bar charts.
- For distributions, prefer histograms or pie charts.
- In the Table section, include only the most relevant columns and rows.`;
        break;
        
      case 'pdf':
      case 'doc':
        customInstructions = `
SPECIFIC DOCUMENT DATA INSTRUCTIONS:
- Treat the data as unstructured or semi-structured document content.
- Focus on extracting key pieces of information relevant to the query.
- For visualizations, focus on extracted metrics or frequencies (if available).
- Create tables that organize extracted information in a structured way.
- Consider text patterns, frequencies, and structural elements in your analysis.
- For visualizations, prefer bar_chart, pie_chart, or table representations.`;
        break;
        
      case 'json':
        customInstructions = `
SPECIFIC JSON DATA INSTRUCTIONS:
- Treat the data as structured hierarchical information.
- Navigate the JSON structure systematically in your analysis.
- Reference specific paths or keys in your analysis steps.
- For nested structures, clearly indicate how you traverse the hierarchy.
- For visualizations, flatten relevant portions of the nested structure.
- Choose visualization types based on the data patterns: bar_chart for comparisons, tree_map for hierarchies, etc.
- Include a simplified or flattened view of the most relevant data in the Table section.`;
        break;
        
      case 'text':
        customInstructions = `
SPECIFIC TEXT DATA INSTRUCTIONS:
- Treat the data as unstructured text content.
- Apply text analysis techniques like frequency analysis, pattern matching, or entity extraction.
- For visualizations, consider frequency charts of key terms, categorical distributions, or timeline representations.
- Create structured tables from extracted information when possible.
- When creating visualizations, prefer bar_chart for term frequencies, or line_chart for patterns over sequential text.`;
        break;
        
      default:
        customInstructions = `
GENERAL DATA INSTRUCTIONS:
- Analyze the structure of the data first to determine appropriate analytical approaches.
- Focus on identifying patterns, trends, or specific data points related to the query.
- Choose visualization types that best represent the data structure and query intent.
- Create structured representations of the most relevant information in the Table section.`;
        break;
    }
    
    // Visualization-specific instructions
    const visualizationInstructions = `
VISUALIZATION SELECTION GUIDANCE:
- bar_chart: Use for comparing categories or values
- line_chart: Use for time series or trends
- pie_chart: Use for part-to-whole relationships
- scatter_plot: Use for correlation between variables
- histogram: Use for distribution of values
- heatmap: Use for showing patterns in a matrix
- tree_map: Use for hierarchical data
- bubble_chart: Use for three dimensions of data
- radar_chart: Use for multivariate data on a 2D chart
- funnel_chart: Use for sequential stages
- table: Use for precise values when visualization isn't needed

Always format your visualization data as valid JSON, ensuring it's an array of objects with consistent properties.`;

    return `${commonInstructions}\n${customInstructions}\n${visualizationInstructions}`;
  }

  /**
   * Get the analytical prompt template
   */
  public getAnalyticalPrompt(): string {
    return `You are acting as a data analysis assistant with access to a knowledge base. 
Your goal is to provide clear, accurate answers to analytical questions based on the data provided in the context.

CONTEXT:
{context}

USER QUERY:
{query}

Please follow these guidelines when responding:

1. FORMATTING: 
   - Present your response in a clear, structured format
   - Use markdown formatting (bold, headers, bullet points, etc.) to make your response easy to read
   - For numerical data, use tables where appropriate
   - Break down complex information into sections with proper headers
   - If listing multiple items, use numbered lists

2. CONTENT:
   - Start with a "Summary of Findings" section that directly answers the query in 1-2 sentences
   - Provide detailed analysis in subsequent sections
   - Always cite specific numbers and metrics from the context when they're available
   - When possible, provide a breakdown or categorization of the data
   - If exact counts are available (like "221 unique VC funds"), use those exact numbers
   - For entity counts, ensure you're counting unique entities and not duplicates

3. ACCURACY:
   - Only use information provided in the context
   - If the context provides precise numbers or statistics, use them exactly
   - If the data seems outdated or incomplete, acknowledge this in your response
   - Never make up data or statistics not found in the context
   - If you cannot answer the question based on the context, clearly state that

4. ANALYTICAL RESPONSES:
   - For "how many" questions, provide exact counts when available
   - For VC fund counts, include the precise number with proper context
   - For questions about investors, clearly distinguish between firms and individual investors
   - For trend analysis, describe patterns you observe in the data
   - For comparison questions, organize information to highlight differences

RESPONSE FORMAT:
## Summary of Findings
[Concise 1-2 sentence answer to the query]

## Detailed Analysis
[Comprehensive analysis with appropriate sections]

[Include specific sections based on the nature of the query, such as:]
- Counts and Statistics
- Breakdowns by Category
- Trends and Patterns
- Supporting Details from the Data

Ensure your response is professionally formatted, accurate, and directly addresses the user's query without unnecessary information.`;
  }

  /**
   * Get specialized Excel data analysis prompt template
   */
  public getExcelDataPrompt(): string {
    return `You are an Excel data analysis expert with access to tabular data extracted from Excel spreadsheets.
Your goal is to analyze the given spreadsheet data and answer the user's query with precision and clarity.

CONTEXT (TABULAR DATA):
{context}

USER QUERY:
{query}

CRITICAL INSTRUCTION: Your response MUST be based SOLELY on the actual data provided above. DO NOT invent, hallucinate, or make up ANY information that is not explicitly present in the data. If the data doesn't contain the information needed, state that clearly.

SPECIAL INSTRUCTIONS FOR EXCEL DATA:
1. UNDERSTANDING THE DATA:
   - The data is provided in a tab-separated format extracted from Excel
   - Each line typically represents a row from the spreadsheet
   - The first row usually contains column headers
   - Pay close attention to formatting conventions in financial data (e.g., parentheses for negative values)
   - Look for units of measurement which may be in headers or in separate rows

2. NUMERICAL ANALYSIS:
   - For financial queries, provide exact numerical values found in the data EXACTLY as they appear
   - Do NOT calculate new values unless specifically asked
   - For sales totals, locate the specific cells containing total values
   - Understand that "—" or empty cells may represent zero or N/A
   - Values in parentheses like "(123)" typically represent negative numbers in financial statements

3. RESPONSE FORMAT:
   - Start with a direct, quantitative answer to the query using ACTUAL DATA
   - Copy the exact numbers from the data - do not round or reformulate
   - Present tables using markdown when comparing multiple values
   - Include the exact source of each piece of information (e.g., "Sheet: Income Statement, Row: Total Sales")
   - For time-based queries, clearly specify the time period the data represents

4. QUALITY CHECKS:
   - NEVER make up or approximate numbers - if they're not in the data, say so
   - If you cannot find the answer in the provided data, clearly state: "The provided data does not contain this information."
   - If data appears incomplete or ambiguous, acknowledge this limitation
   - Include VERBATIM quotes from the data to support your analysis

RESPONSE STRUCTURE:
## Direct Answer
[Provide the specific numerical answer using ONLY values present in the data]

## Data Analysis
[Present detailed analysis referencing specific cells/rows/columns from the data]

## Source Information
[Specify which sheets, rows, and columns the data came from with exact quotes]

IMPORTANT: If the query asks for data not contained in the provided context, state: "The Excel data provided does not contain information about [topic]. The data only includes information about [list what's actually in the data]."`;
  }

  /**
   * Get a special override template for CSV data extraction
   */
  public getCSVDataExtractionPrompt(): string {
    return `CRITICAL: This is a tabular data extraction and analysis task. Extract information from the provided data and respond appropriately to the query.

DATA:
{context}

QUERY:
{query}

INSTRUCTIONS:
1. DO NOT hallucinate or make up ANY information
2. ONLY present what is EXPLICITLY found in the data above
3. ANALYZE the data type and content before responding
4. Format tables using markdown table syntax with proper alignment
5. Include column headers and maintain column relationships
6. Keep all values EXACTLY as they appear in the data (do not reformat values)
7. If information isn't available, say "This information is not in the provided data"
8. Adapt your response to the data type and query intent
9. For technical data (DNS, etc.), preserve complete record values without truncation
10. For financial data, maintain precision of numeric values and calculate appropriate metrics
11. For any other domain, structure your response to best fit the data's content and the query

TABLE FORMATTING GUIDELINES:
- Use markdown tables with proper column alignment
- Ensure each cell contains the appropriate data
- Maintain consistent column width
- Preserve the exact values without reformatting

Begin with: "Based ONLY on the data provided, here is the requested information:"`;
  }

  /**
   * Get a special override template for data extraction
   */
  public getForceDataExtractionPrompt(): string {
    return `CRITICAL: This is an Excel data extraction task. You must extract EXACTLY what is in the provided data and format it as proper tables.

DATA:
{context}

QUERY:
{query}

INSTRUCTIONS:
1. DO NOT hallucinate or make up ANY information
2. ONLY present what is EXPLICITLY found in the data above
3. PRESERVE the exact table structure from the Excel data
4. Format tables using markdown table syntax with proper alignment
5. Include column headers and maintain column relationships
6. Keep all numerical values EXACTLY as they appear in the data (do not reformat numbers)
7. If information isn't available, say "This information is not in the provided data"

TABLE FORMATTING EXAMPLES:
For data like:
"Zone NA | 12,553 | 2,713 | 2,632" 

Create a properly formatted markdown table:

| Segment | Sales | Column2 | Column3 |
|---------|-------|---------|---------|
| Zone NA | 12,553 | 2,713 | 2,632 |

Begin with: "Based ONLY on the data provided, here is the requested information in table format:"`;
  }

  /**
   * Get the standard query prompt template
   */
  public getStandardQueryPrompt(): string {
    return `You are a helpful AI assistant with access to a knowledge base. Answer the user's question based on the provided context.

CONTEXT:
{context}

USER QUERY:
{query}

Please provide a clear, concise, and accurate response using only the information in the context. If the context doesn't contain relevant information to answer the question, acknowledge this limitation.`;
  }
} 