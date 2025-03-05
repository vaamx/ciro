/**
 * Centralized prompt management for the RAG service
 */
export class PromptTemplates {
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
   * Get analytical prompt for complex queries
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