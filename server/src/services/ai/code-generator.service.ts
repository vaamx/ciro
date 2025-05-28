import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { LLMService, ChatMessage } from '../llm';
import { ServiceRegistry } from '../core/service-registry';

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
 * Service for generating code based on natural language queries
 */
@Injectable()
export class CodeGenerationService {
  private readonly logger = createServiceLogger('CodeGenerationService');
  private llmService?: LLMService;

  constructor() {
    try {
      this.llmService = ServiceRegistry.resolve(LLMService);
      this.logger.info('CodeGenerationService initialized');
    } catch (error) {
      this.logger.error(`Error initializing CodeGenerationService: ${error}`);
    }
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
          dataSources = await this.fetchDataSourceDetails(dataSourceIds);
        } catch (error) {
          this.logger.error(`Error fetching data sources: ${error}`);
          // Continue with empty data sources
        }
      }
      
      // If LLM service is not available, fall back to template
      if (!this.llmService) {
        this.logger.warn('LLM service not available, using template');
        const code = this.getBasicCodeTemplate(
          query,
          type,
          includeVisualization ? 'bar' : undefined
        );
        
        return {
          code,
          type,
          explanation: 'Basic code generated based on your query.',
          language: 'python',
          estimatedExecutionTime: 5,
          requiredLibraries: ['pandas', 'numpy', 'matplotlib'],
          visualizationType: includeVisualization ? 'bar' : undefined
        };
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
          role: 'system', 
          content: 'You are a data analysis and visualization code generator.'
        },
        { 
          role: 'user', 
          content: prompt
        }
      ];
      
      const response = await this.llmService.generateChatCompletion(messages, {
        temperature: 0.2
      });
      
      const responseData = {
        content: response.content
      };

      if (!responseData || !responseData.content) {
        throw new Error('Failed to get a valid response');
      }

      // Parse the response to extract the code, explanation, and metadata
      const result = this.parseCodeResponse(responseData.content, type);
      
      // Trim the code if it's too long
      if (result.code.length > maxCodeLength) {
        result.code = result.code.substring(0, maxCodeLength);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error generating code: ${error}`);
      
      // Return a basic template on error
      return {
        code: this.getBasicCodeTemplate(
          query,
          options.type || CodeGenerationType.ANALYSIS,
          options.includeVisualization ? 'bar' : undefined
        ),
        type: options.type || CodeGenerationType.ANALYSIS,
        explanation: `Error generating code: ${error}. Using fallback template.`,
        language: 'python',
        estimatedExecutionTime: 5,
        requiredLibraries: ['pandas', 'numpy', 'matplotlib']
      };
    }
  }

  /**
   * Fetch details about specified data sources
   * @private
   */
  private async fetchDataSourceDetails(dataSourceIds: string[]): Promise<Array<{
    id: string;
    name: string;
    type: string;
    structure?: any;
    sampleData?: any[];
  }>> {
    // Mock implementation - in a real app, this would fetch from a database
    return dataSourceIds.map(id => ({
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
  }
  
  /**
   * Build a prompt for code generation
   * @private
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
   * @private
   */
  private parseCodeResponse(response: string, codeType: CodeGenerationType): GeneratedCode {
    try {
      // Extract the code from markdown code blocks
      const codeMatch = response.match(/```(?:python)?\s*([\s\S]*?)\s*```/);
      const code = codeMatch ? codeMatch[1].trim() : '';
      
      // Extract the explanation
      const explanationMatch = response.match(/Explanation:\s*([\s\S]*?)(?=Required Libraries:|$)/);
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';
      
      // Extract required libraries
      const librariesMatch = response.match(/Required Libraries:\s*([\s\S]*?)(?=Estimated Execution Time:|$)/);
      const librariesString = librariesMatch ? librariesMatch[1].trim() : '';
      const requiredLibraries = librariesString
        .split(/,\s*/)
        .filter(lib => lib.length > 0);
      
      // Extract estimated execution time
      const timeMatch = response.match(/Estimated Execution Time:\s*([\s\S]*?)(?=Visualization Type:|$)/);
      const timeString = timeMatch ? timeMatch[1].trim() : '';
      const estimatedExecutionTime = this.parseExecutionTime(timeString);
      
      // Extract visualization type if applicable
      const vizMatch = response.match(/Visualization Type:\s*([\s\S]*?)(?=$)/);
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
   * @private
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
   * @private
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
}

// Register with service registry
ServiceRegistry.register(CodeGenerationService, new CodeGenerationService()); 