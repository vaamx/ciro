import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService } from '../ai/openai.service';
import { CodeGenerationService, CodeGenerationType, GeneratedCode } from './code-generator.service';
import { PythonExecutorService, ExecutionResult } from './python-executor.service';
import { QdrantSearchService } from '../vector/search.service';
import { db } from '../../config/database';

/**
 * Result of a code execution pipeline
 */
export interface CodeExecutionPipelineResult {
  query: string;
  generatedCode: GeneratedCode;
  executionResult: ExecutionResult;
  visualization?: {
    type: string;
    data: string;
    mimeType: string;
  };
  explanation: string;
  success: boolean;
  executionTime: number;
  dataSourceIds: string[];
}

/**
 * Options for code execution pipeline
 */
export interface CodeExecutionOptions {
  includeGeneratedCode?: boolean;
  maxCodeLength?: number;
  memoryLimitMb?: number;
  timeoutMs?: number;
  preferredVisualizationType?: string;
  codeType?: CodeGenerationType;
  returnRawOutput?: boolean;
  dataSourceDetails?: any[];
}

/**
 * Integration service that combines query analysis, code generation, and execution
 */
@Injectable()
export class CodeExecutionService {
  private readonly logger = createServiceLogger('CodeExecutionService');
  // Remove manual instance variables for services managed by DI
  // private codeGenerator?: CodeGenerationService; 
  // private pythonExecutor?: PythonExecutorService;
  // private openAiService?: OpenAIService;
  // private qdrantSearchService?: QdrantSearchService;

  // Inject services via constructor
  constructor(
    // Make services optional (?) if they might not always be available/fully implemented
    // Or ensure they are always provided by their respective modules.
    // For now, let's assume they should be available and remove optionality.
    private readonly codeGenerator: CodeGenerationService,
    private readonly pythonExecutor: PythonExecutorService,
    private readonly openAiService: OpenAIService,
    private readonly qdrantSearchService: QdrantSearchService 
  ) {
    this.logger.info('CodeExecutionService initialized via Dependency Injection.');
  }

  /**
   * Get information about the data sources for code generation,
   * including original file paths from the files table
   * @param dataSourceIds Array of data source IDs
   * @returns Array of data source information objects
   */
  private async getDataSourcesInfo(dataSourceIds: string[]): Promise<any[]> {
    try {
      // Query the database to get both collection names AND original file paths
      const result = await db.raw(`
        SELECT 
          ds.id, 
          ds.name, 
          ds.data_type, 
          ds.collection_name,
          ds.metadata,
          f.file_path,             -- Get the actual file path 
          f.file_type,
          f.original_filename      -- Get original filename
        FROM 
          data_sources ds
        LEFT JOIN
          files f ON ds.file_id = f.id   -- Join with files table to get original file
        WHERE 
          ds.id = ANY(?)`,
        [dataSourceIds]
      );

      // Log what we found for debugging
      this.logger.info(`Found ${result.rows?.length || 0} data sources with file information`);
      if (result.rows?.length > 0) {
        result.rows.forEach((ds: any) => {
          this.logger.info(`Data source ${ds.id} (${ds.name}): collection=${ds.collection_name}, file=${ds.file_path || 'N/A'}`);
        });
      }

      return result.rows || [];
    } catch (error) {
      this.logger.error(`Error fetching data sources: ${error}`);
      return [];
    }
  }

  /**
   * Execute a full code analysis pipeline from query to visualization
   */
  async executePipeline(
    query: string,
    dataSourceIds: string[],
    options: CodeExecutionOptions = {}
  ): Promise<CodeExecutionPipelineResult> {
    const startTime = Date.now();
    this.logger.info(`Starting code execution pipeline for query: "${query}"`);
    
    const {
      includeGeneratedCode = false,
      maxCodeLength = 5000,
      memoryLimitMb = 2048,
      timeoutMs = 60000, // 1 minute
      preferredVisualizationType,
      codeType = this.determineCodeType(query),
      returnRawOutput = false,
      dataSourceDetails = []
    } = options;
    
    try {
      // Check if required services are available
      if (!this.codeGenerator) {
        throw new Error("CodeGenerationService not available");
      }
      
      // 1. Fetch data source information if not provided in options
      const dataSources = dataSourceDetails.length > 0 
        ? dataSourceDetails
        : await this.getDataSourcesInfo(dataSourceIds);
      
      // Extract file paths for the Python executor
      const filePaths = dataSources
        .filter(ds => ds.file_path)
        .map(ds => ({
          id: ds.id,
          name: ds.name,
          path: ds.file_path,
          type: ds.file_type || this.getFileTypeFromPath(ds.file_path),
          collection: ds.collection_name,
          originalFilename: ds.original_filename
        }));
      
      // Log what files we're working with
      this.logger.info(`Working with ${filePaths.length} data files for code execution`);
      filePaths.forEach(file => {
        this.logger.info(`File: ${file.name} (${file.type}) at ${file.path}`);
      });
      
      // 2. Generate Python code with context about data sources
      const generatedCode = await this.codeGenerator.generateCode(query, {
        dataSourceIds,
        type: codeType,
        maxCodeLength,
        includeVisualization: preferredVisualizationType !== undefined,
        context: this.buildCodeContext(query, dataSources, filePaths, preferredVisualizationType)
      });
      
      // 3. Execute the generated code (if executor is available)
      let executionResult: ExecutionResult = {
        stdout: 'Code execution service not available',
        stderr: '',
        executionTime: 0,
        visualizations: [],
        success: false
      };

      if (this.pythonExecutor) {
        // Create environment variables with file paths for the Python code
        const environmentVars = this.createEnvironmentVarsForDataSources(filePaths);
        
        executionResult = await this.pythonExecutor.executeCode(
          generatedCode.code,
          {
            memoryLimitMb,
            timeoutMs,
            saveVisualization: true,
            environmentVars
          }
        );
      } else {
        this.logger.warn('PythonExecutorService not available, skipping code execution');
      }
      
      // 4. Process the results and format the response
      let explanation = generatedCode.explanation || 'Analysis completed successfully.';
      
      // If execution failed, enhance the explanation with error details
      if (!executionResult.success) {
        explanation = `Error executing code: ${executionResult.error || executionResult.stderr}\n\nOriginal explanation: ${explanation}`;
      }
      
      // Pick the best visualization if multiple were generated
      let bestVisualization = undefined;
      if (executionResult.visualizations && executionResult.visualizations.length > 0) {
        bestVisualization = this.selectBestVisualization(
          executionResult.visualizations,
          preferredVisualizationType
        );
      }
      
      // 5. Create the final result
      const finalResult: CodeExecutionPipelineResult = {
        query,
        generatedCode: includeGeneratedCode ? generatedCode : {
          ...generatedCode,
          code: '// Code excluded from response'
        },
        executionResult: returnRawOutput ? executionResult : {
          ...executionResult,
          stdout: executionResult.stdout.substring(0, 1000) + (executionResult.stdout.length > 1000 ? '...' : ''),
          stderr: executionResult.stderr.substring(0, 1000) + (executionResult.stderr.length > 1000 ? '...' : '')
        },
        visualization: bestVisualization,
        explanation,
        success: executionResult.success,
        executionTime: Date.now() - startTime,
        dataSourceIds
      };
      
      this.logger.info(`Code execution pipeline completed in ${finalResult.executionTime}ms`);
      return finalResult;
    } catch (error) {
      this.logger.error(`Error in code execution pipeline: ${error}`);
      
      // Return a structured error response
      return {
        query,
        generatedCode: {
          code: '',
          type: codeType,
          explanation: 'Error generating code',
          language: 'python'
        },
        executionResult: {
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          executionTime: 0,
          visualizations: [],
          error: error instanceof Error ? error.message : String(error),
          success: false
        },
        explanation: `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
        executionTime: Date.now() - startTime,
        dataSourceIds
      };
    }
  }

  /**
   * Determine the most appropriate code type based on the query
   */
  private determineCodeType(query: string): CodeGenerationType {
    const normalizedQuery = query.toLowerCase();
    
    // Check for visualization keywords
    if (
      normalizedQuery.includes('visualize') ||
      normalizedQuery.includes('plot') ||
      normalizedQuery.includes('chart') ||
      normalizedQuery.includes('graph') ||
      normalizedQuery.includes('show me') ||
      normalizedQuery.includes('display')
    ) {
      return CodeGenerationType.VISUALIZATION;
    }
    
    // Check for data preparation keywords
    if (
      normalizedQuery.includes('clean') ||
      normalizedQuery.includes('prepare') ||
      normalizedQuery.includes('transform') ||
      normalizedQuery.includes('normalize') ||
      normalizedQuery.includes('format')
    ) {
      return CodeGenerationType.DATA_PREPARATION;
    }
    
    // Check for statistical test keywords
    if (
      normalizedQuery.includes('test') ||
      normalizedQuery.includes('hypothesis') ||
      normalizedQuery.includes('significant') ||
      normalizedQuery.includes('p-value') ||
      normalizedQuery.includes('confidence')
    ) {
      return CodeGenerationType.STATISTICAL_TEST;
    }
    
    // Check for machine learning keywords
    if (
      normalizedQuery.includes('predict') ||
      normalizedQuery.includes('classify') ||
      normalizedQuery.includes('cluster') ||
      normalizedQuery.includes('regression') ||
      normalizedQuery.includes('train')
    ) {
      return CodeGenerationType.MACHINE_LEARNING;
    }
    
    // Default to analysis
    return CodeGenerationType.ANALYSIS;
  }

  /**
   * Extract structure information from a document payload
   */
  private extractStructure(payload: any): any {
    if (!payload) return {};
    
    const structure: Record<string, string> = {};
    
    // For each key in the payload, determine its type
    for (const [key, value] of Object.entries(payload)) {
      if (value === null) {
        structure[key] = 'null';
      } else if (Array.isArray(value)) {
        structure[key] = 'array';
      } else {
        structure[key] = typeof value;
      }
    }
    
    return structure;
  }

  /**
   * Select the best visualization from multiple options
   */
  private selectBestVisualization(
    visualizations: Array<{
      id: string;
      type: string;
      data: string;
      mimeType: string;
    }>,
    preferredType?: string
  ): {
    type: string;
    data: string;
    mimeType: string;
  } | undefined {
    if (visualizations.length === 0) {
      return undefined;
    }
    
    // If there's only one visualization, return it
    if (visualizations.length === 1) {
      const viz = visualizations[0];
      return {
        type: viz.type,
        data: viz.data,
        mimeType: viz.mimeType
      };
    }
    
    // If there's a preferred type, look for it
    if (preferredType) {
      const preferred = visualizations.find(v => 
        v.type.toLowerCase() === preferredType.toLowerCase() ||
        v.mimeType.includes(preferredType.toLowerCase())
      );
      
      if (preferred) {
        return {
          type: preferred.type,
          data: preferred.data,
          mimeType: preferred.mimeType
        };
      }
    }
    
    // Otherwise, use a priority system
    // 1. Interactive formats (HTML)
    // 2. Vector formats (SVG)
    // 3. High-quality raster (PNG)
    // 4. Others (JPEG, etc.)
    
    // Try to find HTML
    const html = visualizations.find(v => v.mimeType === 'text/html');
    if (html) {
      return {
        type: html.type,
        data: html.data,
        mimeType: html.mimeType
      };
    }
    
    // Try to find SVG
    const svg = visualizations.find(v => v.mimeType === 'image/svg+xml');
    if (svg) {
      return {
        type: svg.type,
        data: svg.data,
        mimeType: svg.mimeType
      };
    }
    
    // Try to find PNG
    const png = visualizations.find(v => v.mimeType === 'image/png');
    if (png) {
      return {
        type: png.type,
        data: png.data,
        mimeType: png.mimeType
      };
    }
    
    // Fall back to the first visualization
    const fallback = visualizations[0];
    return {
      type: fallback.type,
      data: fallback.data,
      mimeType: fallback.mimeType
    };
  }

  private async getSampleDataFromQdrant(): Promise<string> {
    try {
      if (!this.qdrantSearchService) {
        this.logger.warn('QdrantSearchService not available, using default sample data');
        return JSON.stringify([
          { id: 1, name: 'Sample Item 1', value: 100 },
          { id: 2, name: 'Sample Item 2', value: 200 },
          { id: 3, name: 'Sample Item 3', value: 300 },
        ]);
      }

      const sampleData = await this.qdrantSearchService.getSampleData();
      return JSON.stringify(sampleData);
    } catch (error) {
      this.logger.error(`Error retrieving sample data: ${error}`);
      return JSON.stringify([{ error: 'Failed to retrieve sample data' }]);
    }
  }

  /**
   * Extract file type from file path
   */
  private getFileTypeFromPath(filePath: string): string {
    if (!filePath) return 'unknown';
    
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'csv':
        return 'csv';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'json':
        return 'json';
      case 'txt':
        return 'text';
      case 'pdf':
        return 'pdf';
      default:
        return extension || 'unknown';
    }
  }

  /**
   * Build context for code generation
   */
  private buildCodeContext(
    query: string,
    dataSources: any[],
    filePaths: { id: string; name: string; path: string; type: string; collection: string; originalFilename: string }[],
    preferredVisualizationType?: string
  ): string {
    let context = '';
    
    // Add information about preferred visualization if specified
    if (preferredVisualizationType) {
      context += `Use ${preferredVisualizationType} visualization if appropriate. `;
    }
    
    // Add information about data sources
    if (filePaths.length > 0) {
      context += `You have access to the following data files:\n`;
      
      filePaths.forEach(file => {
        context += `- ${file.name} (${file.type}): Located at ${file.path}\n`;
      });
      
      context += `\nYou should load these files directly using pandas or appropriate libraries. `;
      context += `For example: df = pd.read_csv("${filePaths[0].path}").\n`;
      context += `Environment variables with these paths are also available using os.environ["DATA_FILE_<id>"].\n`;
    } else if (dataSources.length > 0) {
      // If we don't have file paths but have data sources, mention their collections
      context += `Data is available in the following collections:\n`;
      
      dataSources.forEach(ds => {
        if (ds.collection_name) {
          context += `- ${ds.name}: Collection "${ds.collection_name}"\n`;
        }
      });
    }
    
    return context;
  }

  /**
   * Create environment variables with data source file paths
   */
  private createEnvironmentVarsForDataSources(
    filePaths: { id: string; name: string; path: string; type: string; collection: string; originalFilename: string }[]
  ): Record<string, string> {
    const env: Record<string, string> = {
      'DATA_FILES_COUNT': filePaths.length.toString()
    };
    
    // Add each file path as an environment variable
    filePaths.forEach((file, index) => {
      env[`DATA_FILE_${file.id}`] = file.path;
      env[`DATA_FILE_NAME_${file.id}`] = file.name;
      env[`DATA_FILE_TYPE_${file.id}`] = file.type;
      env[`DATA_FILE_INDEX_${index}`] = file.id;
    });
    
    return env;
  }
} 