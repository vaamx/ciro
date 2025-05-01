import React, { useState, useMemo } from 'react';
import { MessageMarkdown } from './MessageMarkdown';
import { EnhancedVisualization } from './visualization/EnhancedVisualization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Button } from '../../ui/button';
import { ChevronDown, ChevronUp, Code, BarChart, Database, Cpu, Info } from 'lucide-react';
import { cn } from '../../../utils/cn';

// Processing path enum that matches the server-side enum
export enum QueryProcessingPath {
  RAG = 'rag',
  CODE_EXECUTION = 'code_execution',
  HYBRID = 'hybrid'
}

// Props interface
interface DualPathResponseProps {
  response: {
    result: any;
    routing: {
      path: QueryProcessingPath;
      confidence: number;
      explanation: string;
      processingTime: number;
    };
  };
  className?: string;
}

/**
 * Component for displaying dual-path query results
 * Handles RAG, code execution, and hybrid results
 */
export const DualPathResponse: React.FC<DualPathResponseProps> = ({ 
  response,
  className = ''
}) => {
  const [showRouting, setShowRouting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('main');
  
  const { result, routing } = response;
  
  // Process the result based on the routing path
  const formattedResult = useMemo(() => {
    // If result is undefined or null, return a default
    if (!result) {
      return {
        content: 'Unable to process response. Please try again.',
        sources: [],
        pathIcon: <Info className="w-5 h-5 text-gray-500" />
      };
    }

    switch (routing.path) {
      case QueryProcessingPath.RAG:
        return {
          content: result.content || 'No content available',
          sources: result.sources || [],
          visualization: result.metadata?.visualizationData,
          insights: result.metadata?.insights || [],
          pathIcon: <Database className="w-5 h-5 text-blue-500" />
        };
      
      case QueryProcessingPath.CODE_EXECUTION:
        return {
          content: result.content || result.explanation || 'No explanation available',
          code: result.generatedCode?.code,
          visualization: result.visualization ? {
            type: result.visualization.type || 'bar',
            data: [{
              id: '1',
              data: result.visualization.data || {},
              type: result.visualization.type || 'bar',
              mimeType: result.visualization.mimeType || 'application/json'
            }]
          } : undefined,
          executionResult: result.executionResult,
          pathIcon: <Cpu className="w-5 h-5 text-purple-500" />
        };
      
      case QueryProcessingPath.HYBRID:
        return {
          content: result.ragResult?.content || result.content || 'No content available',
          sources: result.ragResult?.sources || [],
          code: result.codeExecutionResult?.generatedCode?.code,
          visualization: result.codeExecutionResult?.visualization ? {
            type: result.codeExecutionResult.visualization.type,
            data: [{
              id: '1',
              data: result.codeExecutionResult.visualization.data,
              type: result.codeExecutionResult.visualization.type,
              mimeType: result.codeExecutionResult.visualization.mimeType
            }]
          } : result.ragResult?.metadata?.visualizationData,
          insights: result.ragResult?.metadata?.insights || [],
          executionResult: result.codeExecutionResult?.executionResult,
          pathIcon: (
            <div className="flex space-x-1">
              <Database className="w-5 h-5 text-blue-500" />
              <span className="text-gray-400">+</span>
              <Cpu className="w-5 h-5 text-purple-500" />
            </div>
          )
        };
      
      default:
        return { 
          content: 'Unsupported response type',
          pathIcon: <Info className="w-5 h-5 text-gray-500" />
        };
    }
  }, [result, routing.path]);
  
  // Determine if we should show visualization
  const hasVisualization = Boolean(formattedResult.visualization);
  
  // Determine if we should show code
  const hasCode = Boolean(formattedResult.code);
  
  return (
    <div className={cn("rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden", className)}>
      {/* Header with processing path information */}
      <div className="bg-gray-50 dark:bg-gray-800 p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {formattedResult.pathIcon}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {routing.path === QueryProcessingPath.RAG && "RAG Results"}
            {routing.path === QueryProcessingPath.CODE_EXECUTION && "Code Execution Results"}
            {routing.path === QueryProcessingPath.HYBRID && "Hybrid Analysis"}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {Math.round(routing.processingTime / 10) / 100}s
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRouting(!showRouting)}
          className="flex items-center space-x-1"
        >
          <span className="text-xs">Query Routing</span>
          {showRouting ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>
      
      {/* Routing information (collapsible) */}
      {showRouting && (
        <div className="bg-gray-100 dark:bg-gray-800/50 p-3 text-sm border-b border-gray-200 dark:border-gray-700 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400">Processing Path:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{routing.path}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{Math.round(routing.confidence * 100)}%</span>
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            <span>Explanation: </span>
            <span className="text-gray-700 dark:text-gray-300">{routing.explanation}</span>
          </div>
        </div>
      )}
      
      {/* Content area with tabs if multiple content types */}
      <div className="p-4">
        {(hasVisualization || hasCode) ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="main">Main Response</TabsTrigger>
              {hasVisualization && <TabsTrigger value="visualization"><BarChart className="w-4 h-4 mr-1" /> Visualization</TabsTrigger>}
              {hasCode && <TabsTrigger value="code"><Code className="w-4 h-4 mr-1" /> Code</TabsTrigger>}
            </TabsList>
            
            <TabsContent value="main" className="space-y-4">
              {/* Main content */}
              <div className="prose dark:prose-invert max-w-none">
                <MessageMarkdown content={formattedResult.content} />
              </div>
              
              {/* Sources section if available */}
              {formattedResult.sources && formattedResult.sources.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Sources</h4>
                  <div className="space-y-2">
                    {formattedResult.sources.slice(0, 3).map((source: any, index: number) => (
                      <div key={index} className="text-xs border border-gray-200 dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-800">
                        <div className="font-medium text-gray-700 dark:text-gray-300">{source.sourceName || 'Source ' + (index + 1)}</div>
                        <div className="text-gray-600 dark:text-gray-400 truncate">{source.content}</div>
                      </div>
                    ))}
                    {formattedResult.sources.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{formattedResult.sources.length - 3} more sources
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Visualization tab */}
            {hasVisualization && (
              <TabsContent value="visualization">
                <EnhancedVisualization
                  visualizationsData={Array.isArray(formattedResult.visualization?.data) 
                    ? formattedResult.visualization?.data 
                    : undefined
                  }
                  visualizationData={!Array.isArray(formattedResult.visualization?.data) 
                    ? { 
                        data: formattedResult.visualization?.data || [], 
                        type: formattedResult.visualization?.type || 'bar'
                      } 
                    : undefined
                  }
                  insights={formattedResult.insights}
                />
              </TabsContent>
            )}
            
            {/* Code tab */}
            {hasCode && (
              <TabsContent value="code">
                <div className="space-y-4">
                  <div className="rounded-md bg-gray-900 p-4 overflow-auto max-h-[500px]">
                    <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">
                      {formattedResult.code}
                    </pre>
                  </div>
                  
                  {formattedResult.executionResult && (
                    <div className="space-y-2">
                      {formattedResult.executionResult.stdout && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded p-2">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Output:</div>
                          <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {formattedResult.executionResult.stdout}
                          </pre>
                        </div>
                      )}
                      
                      {formattedResult.executionResult.stderr && (
                        <div className="border border-red-200 dark:border-red-800 rounded p-2 bg-red-50 dark:bg-red-900/20">
                          <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Errors:</div>
                          <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                            {formattedResult.executionResult.stderr}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          /* Simple view when only content is available */
          <div className="prose dark:prose-invert max-w-none">
            <MessageMarkdown content={formattedResult.content} />
          </div>
        )}
      </div>
    </div>
  );
}; 