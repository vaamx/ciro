
Let me explore your codebase to understand the current architecture and suggest an approach for overhauling your system to better handle large datasets and provide more intelligent features.

Ran tool

Ran tool

Ran tool

Ran tool
Let me examine some of the key files to understand your system better.

Read file: server/src/services/code-generator.service.ts

Read file: server/src/services/code-execution/query-router.service.ts

Read file: dashboard/src/components/Chat/components/DualPathResponse.tsx

Read file: server/src/services/rag/retrieval.service.ts

Read file: issues.md
Based on my analysis of your codebase and requirements, I'll propose a comprehensive approach to overhaul your system to better handle large datasets and provide more intelligent features similar to Julius AI.

## Current Architecture Issues

1. Your RAG system is limited when dealing with large datasets (500K+ entries), returning only 10-15 results
2. The Dual RAG implementation has database schema issues and error handling problems
3. The system currently falls back to mock services when it encounters issues
4. You want a more intelligent system that can process raw data directly, similar to Julius AI

## Proposed Architecture Overhaul

Here's a comprehensive approach to rebuild your system:

### 1. Multi-Modal Data Processing Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
│ Data Source  │ -> │ Data Reader  │ -> │ Processing   │ -> │ Output        │
│ Connector    │    │ Service      │    │ Engine       │    │ Generator     │
└──────────────┘    └──────────────┘    └──────────────┘    └───────────────┘
                                              │
                          ┌──────────┬───────┴───────┬───────────┐
                          ▼          ▼               ▼           ▼
                    ┌──────────┐ ┌────────┐  ┌─────────────┐ ┌────────────┐
                    │ RAG Mode │ │ Python │  │ SQL Mode    │ │ Hybrid     │
                    │          │ │ Mode   │  │             │ │ Mode       │
                    └──────────┘ └────────┘  └─────────────┘ └────────────┘
```

### 2. New Components to Implement

1. **Query Analysis & Router**
   - Smart classifier to determine the best processing method
   - Supports chunked processing for large datasets
   - Automatic format detection

2. **Code Generation Engine**
   - Generate Python/R code for data processing
   - Multiple code template libraries
   - Visualization code generators

3. **Progressive Results Service**
   - Stream results as they are generated
   - Support for intermediate steps
   - Execution progress tracking

4. **Visualization Framework**
   - Interactive chart library
   - Table visualizations
   - Custom plot themes

5. **Tool Selection System**
   - Let users choose processing tools
   - Library of data analysis methods
   - Templates for common operations

### 3. Implementation Plan

Here's a step-by-step implementation approach:

```bash
ls -la ~/ciro-1
```
Based on my thorough analysis of your codebase and requirements, here's my proposed architecture overhaul to make your system more powerful and Julius AI-like:

## 1. Core Architecture Redesign

I recommend implementing a multi-stage data processing pipeline that combines the best of RAG, code generation, and direct data analysis:

```
┌────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌────────────────┐
│  Data      │──▶│ Query Router │──▶│ Processing Mode │──▶│ Result         │
│  Sources   │   │ & Analyzer   │   │ Selector        │   │ Formatter      │
└────────────┘   └──────────────┘   └─────────────────┘   └────────────────┘
                                             │
                         ┌─────────┬─────────┴─────────┬─────────┐
                         ▼         ▼                   ▼         ▼
                    ┌─────────┐┌─────────┐       ┌─────────┐┌─────────┐
                    │ RAG     ││ Python  │       │ SQL     ││ Hybrid  │
                    │ Engine  ││ Engine  │       │ Engine  ││ Engine  │
                    └─────────┘└─────────┘       └─────────┘└─────────┘
```

## 2. Key Components to Implement

### A. Intelligent Query Router

Create a service that determines the best processing path for each query:

```typescript
// server/src/services/query/intelligent-router.service.ts
export class IntelligentQueryRouterService {
  async analyzeQuery(query: string, dataContext: DataContext): Promise<QueryProcessingStrategy> {
    // 1. Analyze query complexity and data size
    // 2. Determine if visualization is needed
    // 3. Choose between RAG, code generation, SQL, or hybrid approaches
    // 4. Set processing parameters (batch size, timeout, etc.)
  }
}
```

### B. Data Processing Engines

1. **Enhanced RAG Engine**
   - Implement progressive chunking to handle large datasets
   - Add metadata filtering capabilities
   - Support for fuzzy matching and semantic proximity search

2. **Python Code Generation Engine**
   - Generate Python code to analyze raw data files
   - Support for various analysis libraries (pandas, numpy, scikit-learn)
   - Stream results during execution

3. **SQL Query Engine**
   - Generate and execute SQL queries directly against data sources
   - Support for complex aggregations and joins
   - Handle large result sets efficiently

### C. Procedural Step Visualization

Implement a system for displaying the analysis process step-by-step:

```tsx
// dashboard/src/components/Chat/components/ProceduralAnalysis.tsx
export const ProceduralAnalysis: React.FC<ProceduralAnalysisProps> = ({ 
  steps, currentStep, results, isComplete 
}) => {
  // Display step-by-step analysis process with progress indicators
  // Show intermediate results and visualizations
  // Allow users to interact with the analysis process
}
```

### D. Advanced Visualization Framework

Create a flexible visualization system:

```tsx
// dashboard/src/components/Visualization/VisualizationEngine.tsx
export const VisualizationEngine: React.FC<VisualizationProps> = ({
  data, 
  type,
  options,
  theme,
  interactive = true
}) => {
  // Generate appropriate visualization based on data and type
  // Support various visualization libraries
  // Handle both static and interactive visualizations
}
```

## 3. Implementation Strategy

Here's my recommended implementation approach:

### Phase 1: Core Architecture Refactoring

1. Start by enhancing your RAG engine to handle large datasets
   - Implement chunked retrieval in batches
   - Add progress tracking for long-running queries
   - Improve vector search to return more relevant results

2. Build a better query routing system
   - Create a more intelligent classifier for query types
   - Support for query optimization based on data source

### Phase 2: Code Generation and Execution

1. Build a Python code generation service
   - Generate code to analyze raw data files
   - Support for various data formats (CSV, Excel, JSON, etc.)
   - Stream results during code execution

2. Implement procedural step visualization in the UI
   - Show analysis steps as they happen
   - Display intermediate results
   - Allow users to interact with the analysis process

### Phase 3: Advanced Visualization

1. Create a flexible visualization system
   - Support for various chart types
   - Interactive data exploration
   - Custom themes and styling

2. Add tool selection for users
   - Let users choose analysis methods
   - Provide templates for common operations
   - Save user preferences

## 4. Specific Improvements

1. **RAG Enhancement**:
   ```typescript
   // Enhance retrieval.service.ts
   async retrieveDocumentsProgressively(query, dataSourceIds, options) {
     // Implement progressive chunking with callback
     // Use streaming to return initial results faster
     // Support for larger result sets
   }
   ```

2. **Python Code Generation**:
   ```typescript
   // Enhance code-generation.service.ts
   generatePythonAnalysis(query, dataSource, options) {
     // Generate Python code to analyze data directly
     // Include visualization code
     // Support for user-selected analysis methods
   }
   ```

3. **UI for Procedural Rendering**:
   ```tsx
   // New component: ProceduralAnalysisView.tsx
   <ProceduralAnalysisView
     steps={analysisSteps}
     currentStep={currentStepIndex}
     onStepComplete={(step, result) => {
       // Update UI with intermediate results
     }}
   />
   ```

This architecture will allow you to process much larger datasets, generate more intelligent responses, and create a system that's similar to Julius AI while leveraging your existing RAG capabilities.

Would you like me to dive deeper into any specific component of this proposed architecture?





Let me provide more specific implementation details for each phase based on your existing codebase:

## Phase 1: Enhanced RAG & Query Routing Implementation

### 1. Implement Chunked Retrieval for Large Datasets

```typescript
// server/src/services/rag/enhanced-retrieval.service.ts
export class EnhancedRetrievalService extends RetrievalService {
  async retrieveWithPagination(query: string, dataSourceIds: string[], options: {
    batchSize?: number;        // Default: 1000
    maxTotalDocuments?: number; // Default: 50000
    similarityThreshold?: number; // Default: 0.3
    onBatchRetrieved?: (batch: { documents: Document[], progress: number }) => void;
  }): Promise<Document[]> {
    const allDocuments = [];
    const { batchSize = 1000, maxTotalDocuments = 50000 } = options;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore && allDocuments.length < maxTotalDocuments) {
      // Get query embedding only once
      const queryEmbedding = offset === 0 
        ? await this.openaiService.createEmbeddings(query)
        : null;
      
      const batch = await this.retrieveBatch(
        query, 
        dataSourceIds, 
        offset, 
        batchSize, 
        queryEmbedding?.[0]
      );
      
      if (batch.length === 0) {
        hasMore = false;
      } else {
        allDocuments.push(...batch);
        offset += batchSize;
        
        // Notify about progress
        if (options.onBatchRetrieved) {
          options.onBatchRetrieved({
            documents: batch,
            progress: Math.min(1, allDocuments.length / maxTotalDocuments)
          });
        }
      }
    }
    
    return allDocuments;
  }
}
```

### 2. Improve Vector Search Relevance

```typescript
// server/src/services/vector/advanced-search.service.ts
export class AdvancedQdrantSearchService extends QdrantSearchService {
  async semanticSearch(
    collectionName: string,
    query: string,
    options: {
      filter?: any;
      limit?: number;
      offset?: number;
      useHybridSearch?: boolean; // Combine semantic and keyword search
      reRankResults?: boolean;   // Apply reranking to improve relevance
    }
  ): Promise<SearchResult[]> {
    // Generate embeddings
    const embeddings = await this.openAIService.createEmbeddings(query);
    
    // Perform vector search
    let results = await this.search(
      collectionName,
      embeddings[0],
      options.filter,
      options.limit || 100, // Get more results initially for reranking
      0.1, // Lower threshold to get more candidates
      options.offset
    );
    
    // Apply hybrid search if enabled
    if (options.useHybridSearch) {
      const keywordResults = await this.keywordSearch(
        collectionName, 
        query,
        options.filter,
        options.limit || 100
      );
      
      // Merge and deduplicate results
      results = this.mergeSearchResults(results, keywordResults);
    }
    
    // Apply reranking if enabled
    if (options.reRankResults) {
      results = await this.reRankResults(query, results);
    }
    
    // Return results limited to requested size
    return results.slice(0, options.limit || 50);
  }
  
  // Helper for keyword-based search
  private async keywordSearch(
    collectionName: string,
    query: string,
    filter?: any,
    limit?: number
  ): Promise<SearchResult[]> {
    // Implement keyword search using payload fields
    // This could use Qdrant's payload filtering with text matching
  }
  
  // Rerank results to improve relevance
  private async reRankResults(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // Generate more accurate relevance scores using cross-encoders or LLM
    // Sort results by the new relevance scores
    return results.sort((a, b) => b.score - a.score);
  }
}
```

### 3. Intelligent Query Router

```typescript
// server/src/services/query/advanced-router.service.ts
export enum ProcessingMode {
  RAG = 'rag',
  SQL = 'sql',
  PYTHON = 'python',
  HYBRID_RAG_SQL = 'hybrid_rag_sql',
  HYBRID_RAG_PYTHON = 'hybrid_rag_python'
}

export class AdvancedQueryRouterService {
  async routeQuery(query: string, context: {
    dataSourceIds: string[];
    dataSourceTypes: Map<string, string>; // Map of ID to type (csv, pdf, database, etc.)
    datasetSizes: Map<string, number>;    // Approximate size of each dataset
    userPreference?: ProcessingMode;      // User's preferred mode if any
  }): Promise<{
    mode: ProcessingMode;
    confidence: number;
    requiresVisualization: boolean;
    batchSize?: number;
    queryOptimization?: any;
  }> {
    // 1. Feature extraction from query
    const features = this.extractQueryFeatures(query);
    
    // 2. Data source analysis
    const dataSourceAnalysis = this.analyzeDataSources(context);
    
    // 3. Determine processing mode
    let mode = ProcessingMode.RAG; // Default
    let confidence = 0.5;
    
    // Check data source types to determine viable modes
    const hasStructuredData = dataSourceAnalysis.hasStructuredData;
    const hasUnstructuredData = dataSourceAnalysis.hasUnstructuredData;
    const hasLargeDatasets = dataSourceAnalysis.hasLargeDatasets;
    
    // Check query features
    const needsVisualization = features.visualizationIntent > 0.6;
    const isAnalytical = features.analyticalIntent > 0.7;
    const isFactual = features.factualIntent > 0.7;
    
    // Decision logic for mode selection
    if (isAnalytical && hasStructuredData) {
      if (dataSourceAnalysis.hasDatabaseConnections) {
        mode = ProcessingMode.SQL;
        confidence = 0.8;
      } else if (hasLargeDatasets) {
        mode = ProcessingMode.PYTHON;
        confidence = 0.75;
      }
    } else if (isFactual && hasUnstructuredData) {
      mode = ProcessingMode.RAG;
      confidence = 0.85;
    } else if (isAnalytical && hasUnstructuredData && hasStructuredData) {
      mode = ProcessingMode.HYBRID_RAG_PYTHON;
      confidence = 0.7;
    }
    
    // Calculate optimal batch size for large datasets
    const batchSize = this.calculateOptimalBatchSize(
      dataSourceAnalysis.totalSize,
      mode
    );
    
    return {
      mode,
      confidence,
      requiresVisualization: needsVisualization,
      batchSize,
      queryOptimization: this.generateQueryOptimization(query, mode)
    };
  }
  
  private extractQueryFeatures(query: string): {
    analyticalIntent: number;
    factualIntent: number;
    visualizationIntent: number;
    specificChartType?: string;
    timeframeSpecified: boolean;
  } {
    // Use regex patterns and language analysis to extract query features
    // This could be enhanced with an LLM call for more accurate classification
  }
  
  private analyzeDataSources(context: any): {
    hasStructuredData: boolean;
    hasUnstructuredData: boolean;
    hasDatabaseConnections: boolean;
    hasLargeDatasets: boolean;
    totalSize: number;
  } {
    // Analyze data sources to determine characteristics
  }
  
  private calculateOptimalBatchSize(totalSize: number, mode: ProcessingMode): number {
    // Calculate optimal batch size based on total dataset size and processing mode
    // Returns a number between 100-10000 depending on dataset size
  }
  
  private generateQueryOptimization(query: string, mode: ProcessingMode): any {
    // Generate query-specific optimizations like filters, time ranges, etc.
  }
}
```

## Phase 2: Code Generation and Mixed-Mode Processing

### 1. Unified Processing Pipeline

```typescript
// server/src/services/processing/unified-pipeline.service.ts
export class UnifiedProcessingPipelineService {
  async processQuery(query: string, context: QueryContext): Promise<{
    processingSteps: ProcessingStep[];
    intermediateResults: any[];
    finalResult: any;
  }> {
    // 1. Route the query to determine processing mode
    const routingResult = await this.queryRouterService.routeQuery(query, {
      dataSourceIds: context.dataSourceIds,
      dataSourceTypes: await this.getDataSourceTypes(context.dataSourceIds),
      datasetSizes: await this.getDatasetSizes(context.dataSourceIds),
      userPreference: context.userPreference
    });
    
    // 2. Initialize processing steps
    const processingSteps: ProcessingStep[] = [{
      id: 'query_analysis',
      name: 'Query Analysis',
      status: 'completed',
      result: routingResult
    }];
    
    const intermediateResults = [];
    
    // 3. Process based on determined mode
    switch (routingResult.mode) {
      case ProcessingMode.RAG:
        return this.processRagQuery(query, context, processingSteps, intermediateResults);
        
      case ProcessingMode.SQL:
        return this.processSqlQuery(query, context, processingSteps, intermediateResults);
        
      case ProcessingMode.PYTHON:
        return this.processPythonQuery(query, context, processingSteps, intermediateResults);
        
      case ProcessingMode.HYBRID_RAG_SQL:
      case ProcessingMode.HYBRID_RAG_PYTHON:
        return this.processHybridQuery(query, context, routingResult.mode, processingSteps, intermediateResults);
        
      default:
        throw new Error(`Unsupported processing mode: ${routingResult.mode}`);
    }
  }
  
  // Implementation of different processing modes...
}
```

### 2. Smarter Code Generation for Databases and Files

```typescript
// server/src/services/code-generation/smart-code-generator.service.ts
export class SmartCodeGeneratorService {
  async generateCode(query: string, context: {
    dataSourceType: string;
    connectionDetails?: any;
    sampleData?: any[];
    schema?: any;
    previousResults?: any;
    visualizationType?: string;
  }): Promise<{
    code: string;
    language: string;
    estimatedExecutionTime: number;
    expectedResultType: 'data' | 'visualization' | 'text';
  }> {
    // Select template based on data source type
    let codeTemplate: string;
    let language: string;
    
    if (context.dataSourceType === 'database') {
      // Generate SQL if possible
      if (this.canUseSqlDirectly(context.connectionDetails)) {
        return this.generateSqlCode(query, context);
      }
      
      // Otherwise generate code to connect to database
      codeTemplate = this.getDatabaseTemplate(context.connectionDetails);
      language = 'python';
    } else if (['csv', 'excel', 'json'].includes(context.dataSourceType)) {
      codeTemplate = this.getFileProcessingTemplate(context.dataSourceType);
      language = 'python';
    } else {
      throw new Error(`Unsupported data source type: ${context.dataSourceType}`);
    }
    
    // Use LLM to fill in template with specific logic for the query
    const filledTemplate = await this.fillCodeTemplate(
      codeTemplate,
      query,
      context
    );
    
    return {
      code: filledTemplate,
      language,
      estimatedExecutionTime: this.estimateExecutionTime(filledTemplate, context),
      expectedResultType: this.determineResultType(query, context)
    };
  }
  
  // Helper methods for different data sources and languages
}
```

### 3. Procedural UI Component

```tsx
// dashboard/src/components/Chat/components/ProceduralAnalysis.tsx
export interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export const ProceduralAnalysis: React.FC<{
  steps: ProcessingStep[];
  currentStepIndex: number;
  onViewIntermediate?: (stepId: string) => void;
}> = ({ steps, currentStepIndex, onViewIntermediate }) => {
  return (
    <div className="space-y-4 mt-4">
      <h3 className="text-lg font-medium">Analysis Progress</h3>
      
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`
              p-3 rounded-md border 
              ${index === currentStepIndex ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
              ${step.status === 'completed' ? 'text-green-600 dark:text-green-400' : ''}
              ${step.status === 'error' ? 'text-red-600 dark:text-red-400' : ''}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {step.status === 'pending' && <ClockIcon className="w-4 h-4" />}
                {step.status === 'in_progress' && <Loader2 className="w-4 h-4 animate-spin" />}
                {step.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                {step.status === 'error' && <AlertTriangle className="w-4 h-4" />}
                
                <span className="font-medium">{step.name}</span>
              </div>
              
              {step.status === 'completed' && step.result && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onViewIntermediate?.(step.id)}
                >
                  View Results
                </Button>
              )}
            </div>
            
            {step.status === 'in_progress' && step.progress !== undefined && (
              <Progress 
                value={step.progress * 100} 
                className="mt-2 h-1.5" 
              />
            )}
            
            {step.status === 'error' && step.error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {step.error}
              </div>
            )}
            
            {step.endTime && step.startTime && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Completed in {((step.endTime - step.startTime) / 1000).toFixed(2)}s
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Phase 3: Advanced Visualization Integration

### 1. Visualization Intent Detector

```typescript
// server/src/services/visualization/visualization-intent.service.ts
export interface VisualizationIntent {
  requiresVisualization: boolean;
  chartType?: string;
  multipleCharts?: boolean;
  interactiveVisualization?: boolean;
  dataPreparationNeeded?: boolean;
  confidence: number;
}

export class VisualizationIntentService {
  async detectIntent(query: string): Promise<VisualizationIntent> {
    // Use NLP and pattern matching to detect visualization intent
    const visualizationKeywords = [
      'chart', 'graph', 'plot', 'visualize', 'show me', 'display'
    ];
    
    const chartTypeKeywords = {
      'bar': ['bar chart', 'bar graph', 'histogram'],
      'line': ['line chart', 'trend', 'over time', 'time series'],
      'pie': ['pie chart', 'percentage', 'proportion', 'distribution'],
      'scatter': ['scatter plot', 'correlation', 'relationship'],
      'table': ['table', 'tabular', 'rows and columns']
    };
    
    // Detect if visualization is required
    const hasVisualizationKeyword = visualizationKeywords.some(
      keyword => query.toLowerCase().includes(keyword)
    );
    
    // Detect specific chart type requested
    let chartType = undefined;
    let maxMatches = 0;
    
    for (const [type, keywords] of Object.entries(chartTypeKeywords)) {
      const matches = keywords.filter(keyword => 
        query.toLowerCase().includes(keyword)
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        chartType = type;
      }
    }
    
    // Detect if multiple visualizations are requested
    const multipleChartsRegex = /multiple|several|many|different|compare|comparison|both|all/i;
    const multipleCharts = multipleChartsRegex.test(query);
    
    // Detect if interactive visualization is requested
    const interactiveRegex = /interactive|dynamic|filter|drill down|explore/i;
    const interactiveVisualization = interactiveRegex.test(query);
    
    return {
      requiresVisualization: hasVisualizationKeyword || maxMatches > 0,
      chartType,
      multipleCharts,
      interactiveVisualization,
      dataPreparationNeeded: true, // Always prepare data for better visualization
      confidence: hasVisualizationKeyword ? 0.8 : maxMatches > 0 ? 0.7 : 0.3
    };
  }
}
```

### 2. Data Preparation Service for Visualizations

```typescript
// server/src/services/visualization/data-preparation.service.ts
export interface PreparedVisualizationData {
  prepared: boolean;
  originalData: any[];
  preparedData: any[];
  dimensions: string[];
  measures: string[];
  suggestedChartTypes: string[];
  metadata: {
    dataSize: number;
    hasTimeData: boolean;
    hasCategoricalData: boolean;
    hasNumericalData: boolean;
    dataRange?: { min: number; max: number };
    dataDistribution?: 'normal' | 'skewed' | 'uniform' | 'unknown';
  };
}

export class DataPreparationService {
  async prepareDataForVisualization(
    rawData: any[],
    context: {
      query: string;
      visualizationIntent?: VisualizationIntent;
      preferredChartType?: string;
    }
  ): Promise<PreparedVisualizationData> {
    // Skip if no data
    if (!rawData || rawData.length === 0) {
      return {
        prepared: false,
        originalData: rawData,
        preparedData: [],
        dimensions: [],
        measures: [],
        suggestedChartTypes: [],
        metadata: {
          dataSize: 0,
          hasTimeData: false,
          hasCategoricalData: false,
          hasNumericalData: false
        }
      };
    }
    
    // 1. Analyze data structure
    const dataAnalysis = this.analyzeData(rawData);
    
    // 2. Identify dimensions and measures
    const { dimensions, measures } = this.identifyDimensionsAndMeasures(
      dataAnalysis,
      context.query
    );
    
    // 3. Determine suggested chart types based on data structure
    const suggestedChartTypes = this.suggestChartTypes(
      dimensions,
      measures,
      dataAnalysis,
      context.visualizationIntent?.chartType
    );
    
    // 4. Prepare the data for visualization
    const preparedData = this.transformDataForVisualization(
      rawData,
      dimensions,
      measures,
      context.preferredChartType || suggestedChartTypes[0]
    );
    
    return {
      prepared: true,
      originalData: rawData,
      preparedData,
      dimensions,
      measures,
      suggestedChartTypes,
      metadata: {
        dataSize: rawData.length,
        hasTimeData: dataAnalysis.hasTimeData,
        hasCategoricalData: dataAnalysis.hasCategoricalData,
        hasNumericalData: dataAnalysis.hasNumericalData,
        dataRange: dataAnalysis.dataRange,
        dataDistribution: dataAnalysis.dataDistribution
      }
    };
  }
  
  // Implementation details for data analysis and transformation...
}
```

### 3. Enhanced Visualization Selector

```tsx
// dashboard/src/components/Visualization/VisualizationSelector.tsx
export const VisualizationSelector: React.FC<{
  preparedData: PreparedVisualizationData;
  onChartTypeSelect: (chartType: string) => void;
  onOptionsChange: (options: any) => void;
}> = ({ preparedData, onChartTypeSelect, onOptionsChange }) => {
  const [selectedChartType, setSelectedChartType] = useState<string>(
    preparedData.suggestedChartTypes[0] || 'bar'
  );
  
  const [advancedOptions, setAdvancedOptions] = useState<any>({
    dimensions: preparedData.dimensions.slice(0, 1),
    measures: preparedData.measures.slice(0, 1),
    sortBy: null,
    limitTo: 10,
    colorScheme: 'default'
  });
  
  // Handle chart type selection
  const handleChartTypeSelect = (chartType: string) => {
    setSelectedChartType(chartType);
    onChartTypeSelect(chartType);
  };
  
  // Handle options changes
  const handleOptionsChange = (key: string, value: any) => {
    const newOptions = { ...advancedOptions, [key]: value };
    setAdvancedOptions(newOptions);
    onOptionsChange(newOptions);
  };
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Suggested Chart Types</h3>
        <div className="flex flex-wrap gap-2">
          {preparedData.suggestedChartTypes.map(chartType => (
            <Button
              key={chartType}
              variant={selectedChartType === chartType ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleChartTypeSelect(chartType)}
              className="flex items-center space-x-1"
            >
              {getChartIcon(chartType)}
              <span>{chartType}</span>
            </Button>
          ))}
        </div>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-sm font-medium mb-2">Data Selection</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Dimensions</Label>
            <MultiSelect
              options={preparedData.dimensions.map(d => ({ label: d, value: d }))}
              value={advancedOptions.dimensions}
              onChange={value => handleOptionsChange('dimensions', value)}
            />
          </div>
          
          <div>
            <Label>Measures</Label>
            <MultiSelect
              options={preparedData.measures.map(m => ({ label: m, value: m }))}
              value={advancedOptions.measures}
              onChange={value => handleOptionsChange('measures', value)}
            />
          </div>
        </div>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-sm font-medium mb-2">Display Options</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Sort By</Label>
            <Select
              value={advancedOptions.sortBy}
              onValueChange={value => handleOptionsChange('sortBy', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No sorting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No sorting</SelectItem>
                {[...preparedData.dimensions, ...preparedData.measures].map(field => (
                  <SelectItem key={field} value={field}>{field}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Limit Results</Label>
            <Select
              value={advancedOptions.limitTo.toString()}
              onValueChange={value => handleOptionsChange('limitTo', parseInt(value))}
            >
              {[5, 10, 20, 50, 100, 'All'].map(limit => (
                <SelectItem key={limit} value={limit.toString()}>
                  {limit === 'All' ? 'Show all data' : `Top ${limit} results`}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </div>
      
      <Separator />
      
      <div>
        <h3 className="text-sm font-medium mb-2">Theme</h3>
        <div className="flex space-x-2">
          {['default', 'dark', 'light', 'colorful', 'monochrome'].map(theme => (
            <Button
              key={theme}
              variant={advancedOptions.colorScheme === theme ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleOptionsChange('colorScheme', theme)}
            >
              {theme}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
```

Let me know if you'd like me to expand on any specific aspect of these implementations!





EXTENDED PLAN:



# Detailed Implementation Plan for Ciro RAG System Refactoring

## Phase 0: Preparation (1-2 weeks)

### Documentation & Analysis
1. **Map Current Codebase**
   ```bash
   # Create a comprehensive dependency graph of the current system
   npx madge --image dependency-graph.svg --exclude "node_modules" server/src/
   npx madge --image frontend-graph.svg --exclude "node_modules" dashboard/src/
   ```

2. **Database Schema Analysis**
   ```sql
   -- Review and document current schema
   SELECT 
     table_name, 
     column_name, 
     data_type 
   FROM 
     information_schema.columns 
   WHERE 
     table_schema = 'public'
   ORDER BY table_name, ordinal_position;
   ```

3. **Performance Baseline Measurement**
   ```typescript
   // server/src/utils/performance-monitoring.ts
   export async function measureRagPerformance(query: string, dataSourceIds: string[]): Promise<PerformanceMetrics> {
     const start = performance.now();
     const result = await retrievalService.retrieveDocumentsFromAllSources(query, dataSourceIds);
     const end = performance.now();
     
     return {
       totalTime: end - start,
       documentsRetrieved: result.documents.length,
       averageSimilarity: calculateAverageSimilarity(result.documents),
       dataSourcesQueried: dataSourceIds.length,
       queryCost: estimateTokenUsage(query, result)
     };
   }
   ```

## Phase 1: Core Architecture Refactoring (3-4 weeks)

### Step 1: Extend RetrievalService with Progressive Chunking (Week 1)
1. Create new service that extends the current one:
   ```typescript
   // server/src/services/rag/enhanced-retrieval.service.ts
   
   // Extend existing service to maintain backward compatibility
   export class EnhancedRetrievalService extends RetrievalService {
     // Implement chunk-based retrieval with cursor support
     async retrieveChunkedDocuments(
       query: string,
       dataSourceIds: string[],
       options: {
         chunkSize?: number;
         maxChunks?: number;
         minSimilarityScore?: number;
         onChunkRetrieved?: (chunk: RetrievalChunk) => Promise<void>;
       } = {}
     ): Promise<EnhancedRetrievalResult> {
       const {
         chunkSize = 1000,
         maxChunks = 10,
         minSimilarityScore = 0.3,
         onChunkRetrieved
       } = options;
       
       const queryEmbedding = await this.openAIService.createEmbeddings(query);
       if (!queryEmbedding) throw new Error("Failed to create query embedding");
       
       let allDocuments: Document[] = [];
       let continuationToken: string | null = null;
       let chunkCount = 0;
       
       do {
         // Fetch next chunk with pagination
         const chunkResult = await this.fetchDocumentChunk(
           dataSourceIds,
           queryEmbedding[0],
           chunkSize,
           continuationToken,
           minSimilarityScore
         );
         
         if (chunkResult.documents.length > 0) {
           allDocuments = [...allDocuments, ...chunkResult.documents];
           
           // Call progress callback if provided
           if (onChunkRetrieved) {
             await onChunkRetrieved({
               documents: chunkResult.documents,
               chunkIndex: chunkCount,
               continuationToken: chunkResult.continuationToken,
               isLastChunk: !chunkResult.continuationToken,
               progress: Math.min(1, allDocuments.length / (chunkSize * maxChunks))
             });
           }
         }
         
         // Update for next iteration
         continuationToken = chunkResult.continuationToken;
         chunkCount++;
       } while (continuationToken && chunkCount < maxChunks);
       
       return {
         documents: allDocuments,
         totalChunks: chunkCount,
         isComplete: !continuationToken,
         meta: {
           query,
           dataSourceIds,
           totalDocumentsRetrieved: allDocuments.length
         }
       };
     }
     
     private async fetchDocumentChunk(
       dataSourceIds: string[],
       queryEmbedding: number[],
       limit: number,
       continuationToken: string | null,
       minSimilarityScore: number
     ): Promise<{
       documents: Document[];
       continuationToken: string | null;
     }> {
       // Implementation using Qdrant's pagination capabilities
       // The token is a serialized cursor for efficient continuation
     }
   }
   ```

2. Update service registration:
   ```typescript
   // server/src/app.module.ts or appropriate registration file
   import { EnhancedRetrievalService } from './services/rag/enhanced-retrieval.service';
   
   @Module({
     providers: [
       {
         provide: 'RETRIEVAL_SERVICE',
         useClass: EnhancedRetrievalService
       }
     ],
     exports: ['RETRIEVAL_SERVICE']
   })
   ```

### Step 2: Implement Hybrid Search for Qdrant (Week 1)
1. Create advanced search service:
   ```typescript
   // server/src/services/vector/hybrid-search.service.ts
   export class HybridSearchService extends QdrantSearchService {
     constructor(
       private openAIService: OpenAIService,
       @Inject('QDRANT_CLIENT') private qdrantClient: QdrantClient
     ) {
       super(qdrantClient);
     }
     
     async hybridSearch(
       collectionName: string,
       query: string,
       options: {
         filter?: Filter;
         limit?: number;
         offset?: number;
         semanticWeight?: number; // 0-1 weight for semantic vs. keyword
         keywordFields?: string[]; // Fields to search for keywords
       } = {}
     ): Promise<SearchResult[]> {
       const {
         filter,
         limit = 50,
         offset = 0,
         semanticWeight = 0.7,
         keywordFields = ['text', 'content', 'title']
       } = options;
       
       // 1. Get embeddings for semantic search
       const embeddings = await this.openAIService.createEmbeddings(query);
       if (!embeddings || embeddings.length === 0) {
         throw new Error('Failed to create embeddings for query');
       }
       
       // 2. Prepare hybrid search query for Qdrant
       const hybridQuery = {
         vector: embeddings[0],
         filter: filter || {},
         limit: limit * 2, // Get more results for reranking
         offset,
         with_payload: true,
         with_vectors: false,
         params: {
           hnsw_ef: 128, // Increase search accuracy
           exact: false
         }
       };
       
       // Add keyword search to filter if supported by Qdrant version
       if (this.qdrantSupportsKeywordSearch()) {
         const textFilter = this.buildKeywordFilter(query, keywordFields);
         hybridQuery.filter = this.combineFilters(hybridQuery.filter, textFilter);
       }
       
       // 3. Execute hybrid search
       const results = await this.qdrantClient.search(collectionName, hybridQuery);
       
       // 4. Rerank results using combined score
       const rerankedResults = this.rerankedResults(
         results, 
         query,
         semanticWeight,
         keywordFields
       );
       
       // 5. Return top results
       return rerankedResults.slice(0, limit);
     }
     
     private buildKeywordFilter(query: string, fields: string[]): Filter {
       // Create text filter for keyword search
     }
     
     private rerankedResults(
       results: SearchResult[], 
       query: string,
       semanticWeight: number,
       keywordFields: string[]
     ): SearchResult[] {
       // Rerank results based on combined semantic and keyword scores
     }
   }
   ```

2. Register the new service:
   ```typescript
   // server/src/app.module.ts or appropriate service registration
   import { HybridSearchService } from './services/vector/hybrid-search.service';
   
   @Module({
     providers: [
       {
         provide: 'SEARCH_SERVICE',
         useClass: HybridSearchService
       }
     ],
     exports: ['SEARCH_SERVICE']
   })
   ```

### Step 3: Build Intelligent Query Classifier & Router (Week 2)
1. Create the query intent analyzer:
   ```typescript
   // server/src/services/query/query-intent-analyzer.service.ts
   export interface QueryIntentAnalysis {
     intentType: 'factual' | 'analytical' | 'exploratory' | 'visualization';
     intentConfidence: number;
     needsVisualization: boolean;
     suggestedChartType?: string;
     timeRangeExtracted?: { start?: string; end?: string };
     detectedEntities: string[];
     complexity: 'simple' | 'moderate' | 'complex';
     estimatedDataSize: 'small' | 'medium' | 'large';
     suggestedProcessingMode: ProcessingMode;
   }
   
   @Injectable()
   export class QueryIntentAnalyzerService {
     constructor(private openAIService: OpenAIService) {}
     
     async analyzeQueryIntent(query: string): Promise<QueryIntentAnalysis> {
       // Use both rule-based classification and LLM for query understanding
       const ruleBasedAnalysis = this.performRuleBasedAnalysis(query);
       const llmAnalysis = await this.performLlmAnalysis(query);
       
       // Combine both analyses, with LLM having higher weight for complex cases
       return this.combineAnalyses(ruleBasedAnalysis, llmAnalysis);
     }
     
     private performRuleBasedAnalysis(query: string): Partial<QueryIntentAnalysis> {
       // Use regex and keyword matching for efficient initial classification
       const lowerQuery = query.toLowerCase();
       
       // Check for visualization intent
       const visualizationKeywords = ['chart', 'graph', 'plot', 'visualize', 'visualisation'];
       const hasVisualizationIntent = visualizationKeywords.some(kw => lowerQuery.includes(kw));
       
       // Check for analytical intent
       const analyticalKeywords = ['analyze', 'calculate', 'compute', 'correlation', 'trend'];
       const hasAnalyticalIntent = analyticalKeywords.some(kw => lowerQuery.includes(kw));
       
       // Check for time ranges
       const timeRangeRegex = /(?:from|between|since|in)\s+(\w+\s+\d{4}|\d{4}|\w+)/i;
       const timeRangeMatch = query.match(timeRangeRegex);
       
       // Perform more comprehensive analysis...
       
       return {
         intentType: hasVisualizationIntent ? 'visualization' 
                  : hasAnalyticalIntent ? 'analytical' 
                  : 'factual',
         needsVisualization: hasVisualizationIntent,
         // Add other extracted information
       };
     }
     
     private async performLlmAnalysis(query: string): Promise<Partial<QueryIntentAnalysis>> {
       const systemPrompt = `
         Analyze the following query and extract its intent and characteristics.
         Return a JSON object with the following fields:
         - intentType: "factual", "analytical", "exploratory", or "visualization"
         - intentConfidence: number between 0 and 1
         - needsVisualization: boolean
         - suggestedChartType: string (if visualization is needed)
         - timeRangeExtracted: object with start and end dates (if present)
         - detectedEntities: array of strings
         - complexity: "simple", "moderate", or "complex"
         - estimatedDataSize: "small", "medium", or "large"
         - suggestedProcessingMode: "rag", "sql", "python", "hybrid_rag_sql", or "hybrid_rag_python"
       `;
       
       const messages = [
         { role: 'system', content: systemPrompt },
         { role: 'user', content: query }
       ];
       
       const response = await this.openAIService.createChatCompletion(messages);
       
       try {
         const result = JSON.parse(response.content);
         return result;
       } catch (e) {
         console.error('Failed to parse LLM response:', e);
         return {};
       }
     }
     
     private combineAnalyses(
       ruleBasedAnalysis: Partial<QueryIntentAnalysis>,
       llmAnalysis: Partial<QueryIntentAnalysis>
     ): QueryIntentAnalysis {
       // Logic to combine the analyses, preferring LLM for complex decisions
       // but using rule-based for efficiency and reliability
     }
   }
   ```

2. Create the intelligent router service:
   ```typescript
   // server/src/services/query/intelligent-router.service.ts
   export enum ProcessingMode {
     RAG = 'rag',
     SQL = 'sql', 
     PYTHON = 'python',
     HYBRID_RAG_SQL = 'hybrid_rag_sql',
     HYBRID_RAG_PYTHON = 'hybrid_rag_python'
   }
   
   export interface RoutingResult {
     processingMode: ProcessingMode;
     confidence: number;
     explanation: string;
     needsVisualization: boolean;
     suggestedChartType?: string;
     dataPreparationSuggestions?: string[];
     dataSourceRoutingStrategy?: {
       [dataSourceId: string]: {
         mode: ProcessingMode;
         priority: number;
       }
     };
     optimizations?: {
       batchSize?: number;
       similarityThreshold?: number;
       useHybridSearch?: boolean;
       reRankResults?: boolean;
     };
   }
   
   @Injectable()
   export class IntelligentRouterService {
     constructor(
       private queryIntentAnalyzerService: QueryIntentAnalyzerService,
       private dataSourceService: DataSourceService
     ) {}
     
     async routeQuery(
       query: string, 
       dataSourceIds: string[]
     ): Promise<RoutingResult> {
       // 1. Analyze the query intent
       const queryIntent = await this.queryIntentAnalyzerService.analyzeQueryIntent(query);
       
       // 2. Get information about the data sources
       const dataSources = await this.dataSourceService.getDataSourcesWithMetadata(dataSourceIds);
       
       // 3. Analyze data sources to determine processing capabilities
       const dataSourceAnalysis = this.analyzeDataSources(dataSources);
       
       // 4. Determine the most appropriate processing mode
       const processingMode = this.determineProcessingMode(
         queryIntent, 
         dataSourceAnalysis
       );
       
       // 5. Generate optimization parameters
       const optimizations = this.generateOptimizations(
         queryIntent,
         processingMode,
         dataSourceAnalysis
       );
       
       // 6. Create routing explanation
       const explanation = this.generateExplanation(
         processingMode,
         queryIntent,
         dataSourceAnalysis
       );
       
       // 7. Return the routing result
       return {
         processingMode,
         confidence: this.calculateConfidence(queryIntent, processingMode, dataSourceAnalysis),
         explanation,
         needsVisualization: queryIntent.needsVisualization,
         suggestedChartType: queryIntent.suggestedChartType,
         dataPreparationSuggestions: this.generateDataPreparationSuggestions(
           queryIntent,
           dataSourceAnalysis
         ),
         dataSourceRoutingStrategy: this.generateDataSourceRoutingStrategy(
           dataSourceIds,
           processingMode,
           dataSourceAnalysis
         ),
         optimizations
       };
     }
     
     private analyzeDataSources(dataSources: any[]): DataSourceAnalysis {
       // Check data source types, sizes, and capabilities
       const hasStructuredData = dataSources.some(ds => 
         ['csv', 'excel', 'json', 'database'].includes(ds.type)
       );
       
       const hasUnstructuredData = dataSources.some(ds => 
         ['pdf', 'docx', 'txt', 'markdown'].includes(ds.type)
       );
       
       const hasDatabaseConnections = dataSources.some(ds => 
         ds.type === 'database' || ds.connectionType === 'database'
       );
       
       const largeDataSources = dataSources.filter(ds => 
         (ds.estimatedSize && ds.estimatedSize > 100000) || 
         (ds.recordCount && ds.recordCount > 100000)
       );
       
       // Calculate total data size
       const totalSize = dataSources.reduce((total, ds) => 
         total + (ds.estimatedSize || 0), 0
       );
       
       return {
         hasStructuredData,
         hasUnstructuredData,
         hasDatabaseConnections,
         hasLargeDatasets: largeDataSources.length > 0,
         largeDataSources,
         totalSize,
         dataSources
       };
     }
     
     private determineProcessingMode(
       queryIntent: QueryIntentAnalysis,
       dataSourceAnalysis: DataSourceAnalysis
     ): ProcessingMode {
       // Decision logic based on query intent and data sources
       // This implements a decision tree for selecting the most appropriate mode
       
       // Default to RAG for factual queries
       if (queryIntent.intentType === 'factual') {
         return ProcessingMode.RAG;
       }
       
       // For analytical queries with structured data, prefer SQL if possible
       if (queryIntent.intentType === 'analytical' && dataSourceAnalysis.hasStructuredData) {
         if (dataSourceAnalysis.hasDatabaseConnections) {
           return ProcessingMode.SQL;
         } else if (!dataSourceAnalysis.hasUnstructuredData) {
           return ProcessingMode.PYTHON;
         } else {
           return ProcessingMode.HYBRID_RAG_PYTHON;
         }
       }
       
       // For visualization queries
       if (queryIntent.intentType === 'visualization') {
         if (dataSourceAnalysis.hasDatabaseConnections) {
           return ProcessingMode.SQL; // SQL can directly generate data for visualization
         } else {
           return ProcessingMode.PYTHON; // Python for flexible visualization
         }
       }
       
       // For exploratory queries with mixed data
       if (dataSourceAnalysis.hasStructuredData && dataSourceAnalysis.hasUnstructuredData) {
         return ProcessingMode.HYBRID_RAG_PYTHON;
       }
       
       // Default fallback
       return ProcessingMode.RAG;
     }
     
     // Additional helper methods...
   }
   ```

### Step 4: Implement Shared Context for Query Processing (Week 2)
1. Create a context service to maintain state during processing:
   ```typescript
   // server/src/services/query/processing-context.service.ts
   export interface QueryProcessingContext {
     id: string;
     query: string;
     dataSourceIds: string[];
     processingMode: ProcessingMode;
     startTime: number;
     steps: ProcessingStep[];
     currentStepIndex: number;
     intermediateResults: Map<string, any>;
     status: 'pending' | 'processing' | 'completed' | 'error';
     error?: string;
     finalResult?: any;
     metadata: {
       userPreference?: ProcessingMode;
       visualizationPreference?: string;
       responseFormat?: string;
       maxTokens?: number;
     };
   }
   
   export interface ProcessingStep {
     id: string;
     name: string;
     status: 'pending' | 'in_progress' | 'completed' | 'error';
     startTime?: number;
     endTime?: number;
     progress?: number;
     result?: any;
     error?: string;
   }
   
   @Injectable()
   export class ProcessingContextService {
     private contexts: Map<string, QueryProcessingContext> = new Map();
     
     createContext(query: string, dataSourceIds: string[], metadata?: any): string {
       const contextId = uuidv4();
       
       const context: QueryProcessingContext = {
         id: contextId,
         query,
         dataSourceIds,
         processingMode: ProcessingMode.RAG, // Default, will be updated by router
         startTime: Date.now(),
         steps: [
           { id: 'initialization', name: 'Initialization', status: 'completed' }
         ],
         currentStepIndex: 0,
         intermediateResults: new Map(),
         status: 'pending',
         metadata: metadata || {}
       };
       
       this.contexts.set(contextId, context);
       return contextId;
     }
     
     getContext(contextId: string): QueryProcessingContext | undefined {
       return this.contexts.get(contextId);
     }
     
     updateContext(contextId: string, updates: Partial<QueryProcessingContext>): void {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       // Apply updates
       Object.assign(context, updates);
       this.contexts.set(contextId, context);
     }
     
     addStep(
       contextId: string, 
       step: Omit<ProcessingStep, 'status' | 'startTime'>
     ): void {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       const newStep: ProcessingStep = {
         ...step,
         status: 'pending',
         startTime: Date.now()
       };
       
       context.steps.push(newStep);
       context.currentStepIndex = context.steps.length - 1;
       this.contexts.set(contextId, context);
     }
     
     updateStep(
       contextId: string,
       stepId: string,
       updates: Partial<ProcessingStep>
     ): void {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       const stepIndex = context.steps.findIndex(s => s.id === stepId);
       if (stepIndex === -1) throw new Error(`Step not found: ${stepId}`);
       
       // Apply updates
       context.steps[stepIndex] = {
         ...context.steps[stepIndex],
         ...updates
       };
       
       // If step is completed, set endTime if not already set
       if (updates.status === 'completed' && !updates.endTime) {
         context.steps[stepIndex].endTime = Date.now();
       }
       
       this.contexts.set(contextId, context);
     }
     
     addIntermediateResult(contextId: string, key: string, result: any): void {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       context.intermediateResults.set(key, result);
       this.contexts.set(contextId, context);
     }
     
     getIntermediateResult(contextId: string, key: string): any {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       return context.intermediateResults.get(key);
     }
     
     completeContext(contextId: string, finalResult: any): void {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       context.status = 'completed';
       context.finalResult = finalResult;
       
       // Mark all pending steps as completed
       context.steps.forEach(step => {
         if (step.status === 'pending') {
           step.status = 'completed';
           step.endTime = Date.now();
         }
       });
       
       this.contexts.set(contextId, context);
     }
     
     failContext(contextId: string, error: string): void {
       const context = this.contexts.get(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       context.status = 'error';
       context.error = error;
       
       // Mark current step as failed
       if (context.currentStepIndex >= 0) {
         const currentStep = context.steps[context.currentStepIndex];
         if (currentStep.status === 'in_progress') {
           currentStep.status = 'error';
           currentStep.error = error;
           currentStep.endTime = Date.now();
         }
       }
       
       this.contexts.set(contextId, context);
     }
     
     // Method to clean up old contexts
     cleanupOldContexts(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
       const now = Date.now();
       
       for (const [id, context] of this.contexts.entries()) {
         if (now - context.startTime > maxAgeMs) {
           this.contexts.delete(id);
         }
       }
     }
   }
   ```

2. Register the context service:
   ```typescript
   // server/src/app.module.ts or appropriate service registration
   import { ProcessingContextService } from './services/query/processing-context.service';
   
   @Module({
     providers: [
       ProcessingContextService
     ],
     exports: [
       ProcessingContextService
     ]
   })
   ```

### Step 5: Create WebSocket Backend for Progress Streaming (Week 3)
1. Set up WebSocket gateway for real-time progress updates:
   ```typescript
   // server/src/gateways/processing-progress.gateway.ts
   import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
   import { Server, Socket } from 'socket.io';
   import { ProcessingContextService } from '../services/query/processing-context.service';
   
   @WebSocketGateway({
     cors: {
       origin: '*',
     },
   })
   export class ProcessingProgressGateway {
     @WebSocketServer()
     server: Server;
     
     constructor(private processingContextService: ProcessingContextService) {}
     
     // Client subscribes to progress updates for a specific context
     @SubscribeMessage('subscribe_processing')
     handleSubscribe(
       @MessageBody() data: { contextId: string },
       client: Socket
     ): void {
       // Join room for this context
       client.join(`processing:${data.contextId}`);
       
       // Send initial state
       const context = this.processingContextService.getContext(data.contextId);
       if (context) {
         this.server.to(`processing:${data.contextId}`).emit('processing_update', {
           contextId: data.contextId,
           status: context.status,
           steps: context.steps,
           currentStepIndex: context.currentStepIndex,
           progress: this.calculateOverallProgress(context)
         });
       }
     }
     
     // Client unsubscribes from progress updates
     @SubscribeMessage('unsubscribe_processing')
     handleUnsubscribe(
       @MessageBody() data: { contextId: string },
       client: Socket
     ): void {
       client.leave(`processing:${data.contextId}`);
     }
     
     // Broadcast progress update to all subscribed clients
     broadcastProgressUpdate(contextId: string): void {
       const context = this.processingContextService.getContext(contextId);
       if (!context) return;
       
       this.server.to(`processing:${contextId}`).emit('processing_update', {
         contextId,
         status: context.status,
         steps: context.steps,
         currentStepIndex: context.currentStepIndex,
         progress: this.calculateOverallProgress(context)
       });
     }
     
     // Broadcast step update
     broadcastStepUpdate(contextId: string, stepId: string): void {
       const context = this.processingContextService.getContext(contextId);
       if (!context) return;
       
       const step = context.steps.find(s => s.id === stepId);
       if (!step) return;
       
       this.server.to(`processing:${contextId}`).emit('step_update', {
         contextId,
         stepId,
         step,
         currentStepIndex: context.currentStepIndex
       });
     }
     
     // Broadcast intermediate results
     broadcastIntermediateResult(contextId: string, resultKey: string): void {
       const context = this.processingContextService.getContext(contextId);
       if (!context) return;
       
       const result = context.intermediateResults.get(resultKey);
       if (result === undefined) return;
       
       this.server.to(`processing:${contextId}`).emit('intermediate_result', {
         contextId,
         resultKey,
         result
       });
     }
     
     // Broadcast completion
     broadcastCompletion(contextId: string): void {
       const context = this.processingContextService.getContext(contextId);
       if (!context || !context.finalResult) return;
       
       this.server.to(`processing:${contextId}`).emit('processing_complete', {
         contextId,
         result: context.finalResult
       });
     }
     
     // Calculate overall progress
     private calculateOverallProgress(context: any): number {
       if (context.status === 'completed') return 1;
       if (context.status === 'error') return -1;
       
       // Calculate based on steps
       const completedSteps = context.steps.filter(s => 
         s.status === 'completed'
       ).length;
       
       const inProgressStep = context.steps.find(s => 
         s.status === 'in_progress'
       );
       
       const stepProgress = inProgressStep?.progress || 0;
       
       // Weight completed steps fully and in-progress step by its progress
       return (completedSteps + (inProgressStep ? stepProgress : 0)) / 
              Math.max(context.steps.length, 1);
     }
   }
   ```

2. Make retrieval service use the WebSocket gateway for progress updates:
   ```typescript
   // server/src/services/rag/enhanced-retrieval.service.ts
   @Injectable()
   export class EnhancedRetrievalService extends RetrievalService {
     constructor(
       private processingContextService: ProcessingContextService,
       private progressGateway: ProcessingProgressGateway
     ) {
       super();
     }
     
     async retrieveDocumentsWithProgress(
       query: string,
       dataSourceIds: string[],
       contextId: string
     ): Promise<Document[]> {
       // Create or update the retrieval step
       const stepId = 'document_retrieval';
       this.processingContextService.addStep(contextId, {
         id: stepId,
         name: 'Document Retrieval'
       });
       
       this.processingContextService.updateStep(contextId, stepId, {
         status: 'in_progress',
         progress: 0
       });
       
       // Broadcast initial step status
       this.progressGateway.broadcastStepUpdate(contextId, stepId);
       
       try {
         // Use chunked retrieval
         const documents = await this.retrieveChunkedDocuments(
           query,
           dataSourceIds,
           {
             onChunkRetrieved: async (chunk) => {
               // Update progress
               this.processingContextService.updateStep(contextId, stepId, {
                 progress: chunk.progress
               });
               
               // Store intermediate results
               this.processingContextService.addIntermediateResult(
                 contextId,
                 `retrieval_chunk_${chunk.chunkIndex}`,
                 chunk.documents
               );
               
               // Broadcast progress
               this.progressGateway.broadcastStepUpdate(contextId, stepId);
             }
           }
         );
         
         // Update step to completed
         this.processingContextService.updateStep(contextId, stepId, {
           status: 'completed',
           progress: 1,
           result: { 
             documentCount: documents.length 
           }
         });
         
         // Broadcast completion
         this.progressGateway.broadcastStepUpdate(contextId, stepId);
         
         return documents;
       } catch (error) {
         // Update step with error
         this.processingContextService.updateStep(contextId, stepId, {
           status: 'error',
           error: error.message
         });
         
         // Broadcast error
         this.progressGateway.broadcastStepUpdate(contextId, stepId);
         
         throw error;
       }
     }
   }
   ```

## Phase 2: Unified Processing Pipeline & Code Generation (2-3 weeks)

### Step 1: Build the Unified Processing Pipeline (Week 1)
1. Create the main processing orchestrator:
   ```typescript
   // server/src/services/processing/unified-pipeline.service.ts
   @Injectable()
   export class UnifiedProcessingPipelineService {
     constructor(
       private intelligentRouterService: IntelligentRouterService,
       private processingContextService: ProcessingContextService,
       private progressGateway: ProcessingProgressGateway,
       private enhancedRetrievalService: EnhancedRetrievalService,
       private codeGenerationService: CodeGenerationService,
       private pythonExecutorService: PythonExecutorService,
       private ragService: RagService,
       private sqlService: SqlService
     ) {}
     
     async processQuery(
       query: string, 
       dataSourceIds: string[],
       options: {
         preferredMode?: ProcessingMode;
         visualizationPreference?: string;
       } = {}
     ): Promise<string> {
       // 1. Create processing context
       const contextId = this.processingContextService.createContext(
         query, 
         dataSourceIds,
         {
           userPreference: options.preferredMode,
           visualizationPreference: options.visualizationPreference
         }
       );
       
       // 2. Start processing in background
       this.processInBackground(contextId).catch(error => {
         this.processingContextService.failContext(contextId, error.message);
         this.progressGateway.broadcastProgressUpdate(contextId);
       });
       
       // 3. Return the context ID for client to subscribe to progress
       return contextId;
     }
     
     private async processInBackground(contextId: string): Promise<void> {
       const context = this.processingContextService.getContext(contextId);
       if (!context) throw new Error(`Context not found: ${contextId}`);
       
       try {
         // 1. Route the query
         this.processingContextService.addStep(contextId, {
           id: 'query_routing',
           name: 'Query Analysis & Routing'
         });
         
         this.processingContextService.updateStep(contextId, 'query_routing', {
           status: 'in_progress'
         });
         
         this.progressGateway.broadcastStepUpdate(contextId, 'query_routing');
         
         const routingResult = await this.intelligentRouterService.routeQuery(
           context.query,
           context.dataSourceIds
         );
         
         // Update context with routing result
         this.processingContextService.updateContext(contextId, {
           processingMode: routingResult.processingMode
         });
         
         this.processingContextService.updateStep(contextId, 'query_routing', {
           status: 'completed',
           result: routingResult
         });
         
         this.processingContextService.addIntermediateResult(
           contextId,
           'routing_result',
           routingResult
         );
         
         this.progressGateway.broadcastStepUpdate(contextId, 'query_routing');
         this.progressGateway.broadcastProgressUpdate(contextId);
         
         // 2. Process based on determined mode
         switch (routingResult.processingMode) {
           case ProcessingMode.RAG:
             await this.processRagQuery(contextId);
             break;
             
           case ProcessingMode.SQL:
             await this.processSqlQuery(contextId);
             break;
             
           case ProcessingMode.PYTHON:
             await this.processPythonQuery(contextId);
             break;
             
           case ProcessingMode.HYBRID_RAG_SQL:
           case ProcessingMode.HYBRID_RAG_PYTHON:
             await this.processHybridQuery(contextId);
             break;
             
           default:
             throw new Error(`Unsupported processing mode: ${routingResult.processingMode}`);
         }
         
         // 3. Complete processing
         const finalResult = this.assembleFinalResult(contextId);
         this.processingContextService.completeContext(contextId, finalResult);
         this.progressGateway.broadcastCompletion(contextId);
       } catch (error) {
         this.processingContextService.failContext(contextId, error.message);
         this.progressGateway.broadcastProgressUpdate(contextId);
         throw error;
       }
     }
     
     private async processRagQuery(contextId: string): Promise<void> {
       // Implementation of RAG processing path
     }
     
     private async processSqlQuery(contextId: string): Promise<void> {
       // Implementation of SQL processing path
     }
     
     private async processPythonQuery(contextId: string): Promise<void> {
       // Implementation of Python processing path
     }
     
     private async processHybridQuery(contextId: string): Promise<void> {
       // Implementation of hybrid processing path
     }
     
     private assembleFinalResult(contextId: string): any {
       // Combine all intermediate results into final response
     }
   }
   ```

### Step 2: Implement Data-Aware Code Generation (Week 2)
1. Create smarter code generation service that understands data structure:
   ```typescript
   // server/src/services/code-generation/data-aware-code-generator.service.ts
   @Injectable()
   export class DataAwareCodeGeneratorService extends CodeGenerationService {
     constructor(
       private dataSourceService: DataSourceService,
       private schemaInferenceService: SchemaInferenceService,
       private openAIService: OpenAIService
     ) {
       super();
     }
     
     async generateDataAnalysisCode(
       query: string,
       dataSourceIds: string[],
       options: {
         codeType?: 'analysis' | 'visualization' | 'exploration';
         maxLines?: number;
         preferredLibraries?: string[];
         includeComments?: boolean;
         sampleRowCount?: number;
         contextId?: string;
       } = {}
     ): Promise<GeneratedCode> {
       // 1. Fetch data source details and sample data
       const dataSourceDetails = await Promise.all(
         dataSourceIds.map(async (id) => {
           const dataSource = await this.dataSourceService.getDataSourceById(id);
           if (!dataSource) {
             throw new Error(`Data source not found: ${id}`);
           }
           
           // Get sample data
           const sampleData = await this.dataSourceService.getSampleData(
             id,
             options.sampleRowCount || 10
           );
           
           // Infer schema if not explicitly defined
           const schema = dataSource.schema || 
                        await this.schemaInferenceService.inferSchema(sampleData);
           
           return {
             id,
             name: dataSource.name,
             type: dataSource.type,
             schema,
             sampleData,
             connectionDetails: dataSource.connectionDetails,
             totalRows: dataSource.totalRows,
             columnStats: await this.getColumnStatistics(id)
           };
         })
       );
       
       // 2. Generate custom prompt with data understanding
       const prompt = this.buildDataAwarePrompt(
         query,
         dataSourceDetails,
         options
       );
       
       // 3. Call LLM to generate code
       const messages = [
         { role: 'system', content: 'You are an expert data analyst who writes efficient and accurate Python code.' },
         { role: 'user', content: prompt }
       ];
       
       const response = await this.openAIService.createChatCompletion(messages);
       
       // 4. Parse and validate the generated code
       const parsedCode = this.parseCodeResponse(response.content);
       
       // 5. Post-process and optimize the code if needed
       const optimizedCode = this.optimizeCodeForPerformance(parsedCode, dataSourceDetails);
       
       return {
         code: optimizedCode.code,
         language: 'python',
         type: options.codeType || 'analysis',
         explanation: optimizedCode.explanation,
         estimatedExecutionTime: this.estimateExecutionTime(optimizedCode.code, dataSourceDetails),
         requiredLibraries: this.extractRequiredLibraries(optimizedCode.code),
         metadata: {
           dataSourceIds,
           dataSchemas: dataSourceDetails.map(ds => ds.schema),
           visualizationType: this.detectVisualizationType(optimizedCode.code)
         }
       };
     }
     
     private buildDataAwarePrompt(
       query: string,
       dataSourceDetails: any[],
       options: any
     ): string {
       // Construct a prompt that includes data context
       let prompt = `Generate Python code to ${query} based on the following data:\n\n`;
       
       // Add data source details
       dataSourceDetails.forEach((ds, index) => {
         prompt += `Data Source ${index + 1}: ${ds.name} (${ds.type})\n`;
         prompt += `Schema:\n${JSON.stringify(ds.schema, null, 2)}\n\n`;
         prompt += `Sample Data (${ds.sampleData.length} rows):\n`;
         prompt += `${JSON.stringify(ds.sampleData.slice(0, 3), null, 2)}\n...${ds.totalRows - 3} more rows\n\n`;
         
         // Add column statistics if available
         if (ds.columnStats) {
           prompt += `Column Statistics:\n${JSON.stringify(ds.columnStats, null, 2)}\n\n`;
         }
       });
       
       // Add specific instructions
       prompt += `Instructions:\n`;
       prompt += `- Generate Python code that accomplishes the task\n`;
       prompt += `- Use pandas for data manipulation\n`;
       
       if (dataSourceDetails.length > 1) {
         prompt += `- The code should handle multiple data sources and join them if necessary\n`;
       }
       
       if (options.codeType === 'visualization') {
         prompt += `- Create a visualization that best represents the data and answers the query\n`;
         prompt += `- Use matplotlib, seaborn, or plotly for visualization\n`;
         prompt += `- Make sure the visualization is clear and properly labeled\n`;
       }
       
       if (options.preferredLibraries && options.preferredLibraries.length > 0) {
         prompt += `- Preferred libraries: ${options.preferredLibraries.join(', ')}\n`;
       }
       
       // Performance considerations for large datasets
       if (dataSourceDetails.some(ds => ds.totalRows > 100000)) {
         prompt += `- The dataset is large (${Math.max(...dataSourceDetails.map(ds => ds.totalRows))} rows), so ensure the code is optimized for performance\n`;
         prompt += `- Consider using techniques like chunking for processing large data\n`;
       }
       
       prompt += `\nReturn only the Python code wrapped in a code block, followed by a brief explanation.`;
       
       return prompt;
     }
     
     private async getColumnStatistics(dataSourceId: string): Promise<any> {
       try {
         // Fetch basic statistics for each column (min, max, mean, etc.)
         return await this.dataSourceService.getColumnStatistics(dataSourceId);
       } catch (error) {
         console.error(`Error fetching column statistics for ${dataSourceId}:`, error);
         return null;
       }
     }
     
     private optimizeCodeForPerformance(
       parsedCode: { code: string; explanation: string },
       dataSourceDetails: any[]
     ): { code: string; explanation: string } {
       // Implement code optimization logic here
       // This could involve adding chunking for large datasets,
       // optimizing memory usage, etc.
       return parsedCode;
     }
     
     private estimateExecutionTime(code: string, dataSourceDetails: any[]): number {
       // Estimate execution time based on code complexity and data size
       const totalRows = dataSourceDetails.reduce((sum, ds) => sum + (ds.totalRows || 0), 0);
       
       // Simple heuristic
       const baseTime = 1; // base time in seconds
       let multiplier = 1;
       
       if (totalRows > 1000000) multiplier = 30;
       else if (totalRows > 100000) multiplier = 10;
       else if (totalRows > 10000) multiplier = 3;
       
       // Check for complex operations
       if (code.includes('groupby(') || code.includes('pivot_table') || 
           code.includes('merge(') || code.includes('apply(')) {
         multiplier *= 2;
       }
       
       return baseTime * multiplier;
     }
     
     private extractRequiredLibraries(code: string): string[] {
       // Extract import statements
       const importPattern = /import\s+(\w+)|from\s+(\w+)\s+import/g;
       const matches = [...code.matchAll(importPattern)];
       
       const libraries = new Set<string>();
       
       matches.forEach(match => {
         const lib = match
