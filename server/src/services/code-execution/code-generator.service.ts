import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { LLMService, ChatMessage } from '../llm';
import { DataSourceType } from '../rag/integration.service';

/**
 * Types of code that can be generated
 */
export enum CodeGenerationType {
  ANALYSIS = 'analysis',
  VISUALIZATION = 'visualization',
  DASHBOARD = 'dashboard',
  DATA_PREPARATION = 'data_preparation',
  STATISTICAL_TEST = 'statistical_test',
  MACHINE_LEARNING = 'machine_learning'
}

/**
 * Result of code generation
 */
export interface CodeGenerationResult {
  code: string;
  language: string;
  explanation?: string;
}

/**
 * Generated code with metadata
 */
export interface GeneratedCode {
  code: string;
  type: CodeGenerationType;
  explanation?: string;
  language: string;
  estimatedExecutionTime?: number;
  requiredLibraries?: string[];
  visualizationType?: string;
}

/**
 * Parameters for code generation
 */
export interface CodeGenerationParams {
  dataSourceIds?: string[];
  type?: CodeGenerationType;
  maxCodeLength?: number;
  includeVisualization?: boolean;
  context?: string;
}

/**
 * Options for code generation
 */
export interface CodeGenerationOptions {
  dataSourceIds: string[];
  type: CodeGenerationType;
  maxCodeLength?: number;
  includeVisualization?: boolean;
  context?: string;
}

/**
 * Service for generating code based on natural language queries
 */
@Injectable()
export class CodeGenerationService {
  private readonly logger = createServiceLogger('CodeGenerationService');

  constructor(private readonly llmService: LLMService) {
    this.logger.info('CodeGenerationService initialized with LLM abstraction layer');
  }

  /**
   * Generate code based on a natural language query
   */
  async generateCode(
    query: string,
    options: CodeGenerationParams = {}
  ): Promise<GeneratedCode> {
    try {
      this.logger.info(`Generating code for: "${query}"`);
      
      const {
        dataSourceIds = [],
        type = CodeGenerationType.ANALYSIS,
        maxCodeLength = 5000,
        includeVisualization = false,
        context = ''
      } = options;
      
      // If we have data sources, fetch their details
      let dataSources: Array<{
        id: string;
        name: string;
        type: string;
        structure?: any;
        sampleData?: any[];
      }> = [];
      
      if (dataSourceIds.length > 0) {
        try {
          // Placeholder - in a real implementation, this would fetch data source details
          dataSources = dataSourceIds.map(id => ({
            id,
            name: `DataSource ${id}`,
            type: 'csv',
            structure: {
              id: 'string',
              name: 'string',
              value: 'number'
            },
            sampleData: [
              { id: '1', name: 'Sample 1', value: 100 },
              { id: '2', name: 'Sample 2', value: 200 }
            ]
          }));
        } catch (error) {
          this.logger.error(`Error fetching data sources: ${error}`);
          // Continue with empty data sources
        }
      }
      
      // Build the prompt
      const prompt = this.buildCodeGenerationPrompt(
        query,
        dataSources,
        type,
        context || (includeVisualization ? 'Include visualization.' : '')
      );
      
      // Call LLM to generate code
      const messages: ChatMessage[] = [
        { 
          id: `system-${Date.now()}`,
          role: 'system', 
          content: 'You are a data analysis and visualization code generator.',
          timestamp: Date.now()
        },
        { 
          id: `user-${Date.now()}`,
          role: 'user', 
          content: prompt,
          timestamp: Date.now()
        }
      ];
      
      const response = await this.llmService.generateChatCompletion(messages, {
        temperature: 0.2,
        taskType: 'code_generation',
        taskComplexity: type === CodeGenerationType.MACHINE_LEARNING ? 'complex' : 'medium'
      });

      if (!response.content) {
        throw new Error('Failed to get a valid response from LLM');
      }

      // Parse the response to extract the code, explanation, and metadata
      const result = this.parseCodeResponse(response.content, type);
      
      // Trim the code if it's too long
      if (result.code.length > maxCodeLength) {
        result.code = result.code.substring(0, maxCodeLength);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error generating code: ${error}`);
      
      // Return a basic template on error
      const fallbackType = options.type || CodeGenerationType.ANALYSIS;
      const fallbackCode = this.getBasicCodeTemplate(
        query,
        fallbackType,
        options.includeVisualization ? 'bar' : undefined
      );
      
      return {
        code: fallbackCode,
        type: fallbackType,
        explanation: 'Basic code generated due to error in LLM generation.',
        language: 'python',
        estimatedExecutionTime: 5,
        requiredLibraries: ['pandas', 'numpy', 'matplotlib'],
        visualizationType: options.includeVisualization ? 'bar' : undefined
      };
    }
  }

  /**
   * Build a prompt for code generation
   */
  private buildCodeGenerationPrompt(
    query: string,
    dataSources: Array<{
      id: string;
      name: string;
      type: string;
      structure?: any;
      sampleData?: any[];
    }>,
    codeType: CodeGenerationType,
    additionalContext: string
  ): string {
    // Create a detailed description of the data sources
    const dataSourcesDescription = dataSources
      .map(ds => {
        let description = `Data Source: ${ds.name} (ID: ${ds.id}, Type: ${ds.type})`;
        
        if (ds.structure) {
          description += `\nStructure: ${JSON.stringify(ds.structure, null, 2)}`;
        }
        
        if (ds.sampleData && ds.sampleData.length > 0) {
          const sampleDataStr = JSON.stringify(ds.sampleData.slice(0, 3), null, 2);
          description += `\nSample Data: ${sampleDataStr}\n...`;
        }
        
        return description;
      })
      .join('\n\n');

    // Customize instructions based on code type
    let typeSpecificInstructions = '';
    
    switch (codeType) {
      case CodeGenerationType.ANALYSIS:
        typeSpecificInstructions = `
        - Focus on performing statistical analysis, aggregation, and identifying patterns in the data
        - Calculate relevant metrics (mean, median, mode, etc.) as appropriate
        - Include descriptive comments to explain your analysis approach
        `;
        break;
      
      case CodeGenerationType.VISUALIZATION:
        typeSpecificInstructions = `
        - Create high-quality, readable visualizations using matplotlib, seaborn, or plotly
        - Choose appropriate visualization types for the data and query
        - Include proper labels, titles, and legends
        - Consider color-blindness in color choices
        - Use plt.tight_layout() to ensure the visualization displays properly
        `;
        break;
      
      case CodeGenerationType.DASHBOARD:
        typeSpecificInstructions = `
        - Create a dashboard that integrates multiple visualizations and data insights
        - Use libraries like Dash, Streamlit, or Plotly Dash for interactive web applications
        - Include widgets for filtering, selecting, and exploring data
        - Use appropriate data visualization techniques for each dashboard component
        `;
        break;
    }

    // Combine everything into a final prompt
    return `
    Generate Python code to ${query} based on the following data sources:
    
    ${dataSourcesDescription || "Use placeholder data if necessary"}
    
    Additional Context:
    ${additionalContext}
    
    Code Type: ${codeType}
    
    Instructions:
    - Generate standalone Python code that accomplishes the task
    - Use pandas for data manipulation and analysis
    - Write efficient code that can handle larger datasets
    - Include error handling for robustness
    - Add descriptive comments to explain your approach
    ${typeSpecificInstructions}
    
    Important:
    - Start the code with importing necessary libraries
    - Assume the data is available in a file or DataFrame called "data"
    - Include a sample function call to show how to use your code
    - Add a brief explanation of what the code does
    - Format your response with markdown code blocks for the Python code
    - After the code, include a list of required libraries, estimated execution time, and the type of visualization (if applicable)
    
    Example format:
    \`\`\`python
    # Your code here
    \`\`\`
    
    Explanation: Brief explanation of the code.
    
    Required Libraries: pandas, numpy, matplotlib
    Estimated Execution Time: 2 seconds
    Visualization Type: Line Chart
    `;
  }

  /**
   * Parse the response from the language model
   */
  private parseCodeResponse(response: string, codeType: CodeGenerationType): GeneratedCode {
    try {
      // Extract the code from markdown code blocks
      const codeMatch = response.match(/```(?:python)?\s*([\s\S]*?)\s*```/);
      const code = codeMatch ? codeMatch[1].trim() : '';
      
      // Extract the explanation
      const explanationMatch = response.match(/Explanation:\s*(.*?)(?=Required Libraries:|$)/s);
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';
      
      // Extract required libraries
      const librariesMatch = response.match(/Required Libraries:\s*(.*?)(?=Estimated Execution Time:|$)/s);
      const librariesString = librariesMatch ? librariesMatch[1].trim() : '';
      const requiredLibraries = librariesString
        .split(/,\s*/)
        .filter(lib => lib.length > 0);
      
      // Extract estimated execution time
      const timeMatch = response.match(/Estimated Execution Time:\s*(.*?)(?=Visualization Type:|$)/s);
      const timeString = timeMatch ? timeMatch[1].trim() : '';
      const estimatedExecutionTime = this.parseExecutionTime(timeString);
      
      // Extract visualization type if applicable
      const vizMatch = response.match(/Visualization Type:\s*(.*?)(?=$)/s);
      const visualizationType = vizMatch ? vizMatch[1].trim() : undefined;
      
      return {
        code,
        explanation,
        type: codeType,
        language: 'python',
        estimatedExecutionTime,
        requiredLibraries,
        visualizationType
      };
    } catch (error) {
      this.logger.error(`Error parsing code response: ${error}`);
      
      // Return a default response if parsing fails
      return {
        code: response,
        explanation: 'Could not parse explanation.',
        type: codeType,
        language: 'python',
        estimatedExecutionTime: 10,
        requiredLibraries: ['pandas', 'numpy']
      };
    }
  }

  /**
   * Parse execution time from string to seconds
   */
  private parseExecutionTime(timeString: string): number {
    if (!timeString) return 10; // Default to 10 seconds
    
    try {
      // Check for simple numbers
      const simpleMatch = timeString.match(/^(\d+(\.\d+)?)/);
      if (simpleMatch) {
        return parseFloat(simpleMatch[1]);
      }
      
      // Look for time units
      if (timeString.includes('millisecond')) {
        const msMatch = timeString.match(/(\d+(\.\d+)?)\s*millisecond/);
        return msMatch ? parseFloat(msMatch[1]) / 1000 : 10;
      }
      
      if (timeString.includes('second')) {
        const secMatch = timeString.match(/(\d+(\.\d+)?)\s*second/);
        return secMatch ? parseFloat(secMatch[1]) : 10;
      }
      
      if (timeString.includes('minute')) {
        const minMatch = timeString.match(/(\d+(\.\d+)?)\s*minute/);
        return minMatch ? parseFloat(minMatch[1]) * 60 : 10;
      }
      
      // Default if no pattern matched
      return 10;
    } catch (error) {
      return 10; // Default to 10 seconds on error
    }
  }

  /**
   * Get a basic code template for fallback
   */
  private getBasicCodeTemplate(
    query: string,
    codeType: CodeGenerationType,
    preferredVisualizationType?: string
  ): string {
    // Simple template for when AI generation fails
    const basicTemplate = `
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64

# Load data from file
# In a real application, this would use the actual data source path
df = pd.read_csv('data.csv')

# Process query: "${query}"
# Basic analysis code
print(f"Total records: {len(df)}")
if 'value' in df.columns:
    total_value = df['value'].sum()
    print(f"Total value: {total_value}")
    
    # Calculate values by name if available
    if 'name' in df.columns:
        values_by_name = df.groupby('name')['value'].sum().reset_index()
        print("\\nValues by name:")
        print(values_by_name)
`;

    if (codeType === CodeGenerationType.VISUALIZATION) {
      const visType = preferredVisualizationType || 'bar';
      
      return basicTemplate + `
# Create visualization
plt.figure(figsize=(10, 6))
if 'name' in df.columns and 'value' in df.columns:
    # Create ${visType} chart
    ${visType === 'bar' || !preferredVisualizationType 
      ? 'ax = sns.barplot(x="name", y="value", data=df)'
      : visType === 'line' 
        ? 'ax = sns.lineplot(x="id", y="value", hue="name", data=df)'
        : visType === 'pie'
          ? 'plt.pie(df.groupby("name")["value"].sum(), labels=df["name"].unique(), autopct="%1.1f%%")'
          : 'ax = sns.barplot(x="name", y="value", data=df)'
    }
    plt.title('Value Analysis')
    plt.xlabel('Name')
    plt.ylabel('Value')
    plt.xticks(rotation=45)

    # Save visualization to buffer for display
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')

    # Output in format that can be parsed by the server
    print("\\n\\n<VISUALIZATION>")
    print(f"{{\\n  \\"type\\": \\"${visType}_chart\\",")
    print(f"  \\"mimeType\\": \\"image/png\\",")
    print(f"  \\"data\\": \\"data:image/png;base64,{img_base64}\\"")
    print("}}")
    print("</VISUALIZATION>")
`;
    } else {
      return basicTemplate;
    }
  }

  /**
   * Generate a prompt for the AI to generate code
   */
  private generatePrompt(query: string, options: CodeGenerationOptions): string {
    const { type, context, maxCodeLength = 2000 } = options;
    
    // Base prompt with instructions
    let prompt = `
Generate Python code to ${this.getPurposeByType(type)} based on the following query: "${query}"

${context ? `Context: ${context}\n\n` : ''}

${this.getVisualizationInstructions(type, options.includeVisualization)}

The code should be:
- Clear and concise (max ${maxCodeLength} characters)
- Well-documented with comments
- Handle errors gracefully
- Use pandas, numpy, matplotlib, and other common data science libraries
- Follow best practices for data analysis

For loading data files:
1. Use the provided file paths directly in your code (os.environ["DATA_FILE_<id>"])
2. Or use the helper function load_data_file() which automatically loads the appropriate data format
3. Specify column types and handle NaN values appropriately
4. Include data validation steps before analysis

Output the CODE in this format:
\`\`\`python
# Your code here
\`\`\`

Then, provide a brief explanation of what the code does and how it addresses the query.
`;

    return prompt;
  }

  /**
   * Get the purpose description based on code type
   */
  private getPurposeByType(type: CodeGenerationType): string {
    switch (type) {
      case CodeGenerationType.ANALYSIS:
        return 'analyze data';
      case CodeGenerationType.VISUALIZATION:
        return 'create a visualization';
      case CodeGenerationType.DATA_PREPARATION:
        return 'clean and prepare data';
      case CodeGenerationType.STATISTICAL_TEST:
        return 'perform statistical testing';
      case CodeGenerationType.MACHINE_LEARNING:
        return 'build a machine learning model';
      case CodeGenerationType.DASHBOARD:
        return 'create an interactive dashboard';
      default:
        return 'analyze data';
    }
  }

  /**
   * Get specific instructions for visualization
   */
  private getVisualizationInstructions(type: CodeGenerationType, includeVisualization?: boolean): string {
    if (type === CodeGenerationType.VISUALIZATION || includeVisualization) {
      return `
Include visualization(s) that best represent the data and answer the query.
Use matplotlib, seaborn, or plotly to create clear, informative visualizations.
Label axes, include titles, and use appropriate color schemes.
Save visualizations using plt.savefig() if needed.
`;
    }
    return '';
  }
} 