import React, { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { 
  UniversalDataProcessor, 
  DataSourceType, 
  ProcessingStage, 
  ProgressCallback 
} from '../services/processors/UniversalDataProcessor';
import { StructuredAnalysisResponse, AnalysisStep } from '../types/ExcelTypes';
import DataProcessingProgress from './DataProcessingProgress';
import ResponsiveAnalysisLayout from './ResponsiveAnalysisLayout';
import { EnhancedStepByStepVisualization } from './Chat/components/EnhancedStepByStepVisualization';
import { ResponsiveContainer } from './shared/ResponsiveContainer';
import { StepIndicator } from './StepIndicator';

interface UniversalStructuredResponseViewProps {
  query: string;
  data: any;
  dataSourceType: DataSourceType;
  theme?: 'light' | 'dark';
  showProgress?: boolean;
  className?: string;
  onComplete?: (response: StructuredAnalysisResponse) => void;
  onError?: (error: string) => void;
}

/**
 * A universal view component for structured responses across all data types
 */
export const UniversalStructuredResponseView: React.FC<UniversalStructuredResponseViewProps> = ({
  query,
  data,
  dataSourceType,
  theme = 'light',
  showProgress = true,
  className = '',
  onComplete,
  onError
}) => {
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>(ProcessingStage.INITIALIZING);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [response, setResponse] = useState<StructuredAnalysisResponse | null>(null);
  const [selectedStep, setSelectedStep] = useState<AnalysisStep | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(-1);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [showResponsiveLayout, setShowResponsiveLayout] = useState(false);
  
  // Toggle between StepIndicator and ResponsiveLayout views
  const toggleViewMode = () => {
    setShowResponsiveLayout(prev => !prev);
  };
  
  // Initialize the data processor
  const dataProcessor = React.useMemo(() => {
    const processor = new UniversalDataProcessor();
    
    // Set up progress tracking
    const progressCallback: ProgressCallback = (stage, progress, message) => {
      setProcessingStage(stage);
      setProcessingProgress(progress);
      if (message) {
        setProcessingMessage(message);
      }
    };
    processor.setProgressCallback(progressCallback);
    
    return processor;
  }, []);
  
  // Process the data when query or data changes
  useEffect(() => {
    const processData = async () => {
      if (!query || !data) return;
      
      setIsProcessing(true);
      setProcessingStage(ProcessingStage.INITIALIZING);
      setProcessingProgress(0);
      setProcessingMessage('Starting analysis...');
      setResponse(null);
      setSelectedStep(null);
      setSelectedStepIndex(-1);
      setShowDetailedView(false);
      
      try {
        const result = await dataProcessor.processDataQuery(query, data, dataSourceType);
        
        if (result.structuredResponse) {
          setResponse(result.structuredResponse);
          
          if (onComplete) {
            onComplete(result.structuredResponse);
          }
          
          showToast('Analysis completed successfully!', 'success');
        } else {
          throw new Error('No structured response received');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error processing data:', errorMessage);
        
        if (onError) {
          onError(errorMessage);
        }
        
        showToast(`Error: ${errorMessage}`, 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    
    processData();
  }, [query, data, dataSourceType, dataProcessor, onComplete, onError, showToast]);
  
  // Handle step click - Now we're using this in both layouts
  const handleStepClick = (step: AnalysisStep) => {
    // Find the index of the selected step
    const stepIndex = response?.steps.findIndex(s => s.id === step.id) || -1;
    
    // Update state
    setSelectedStep(step);
    setSelectedStepIndex(stepIndex);
    
    // Show detailed view
    setShowDetailedView(true);
    
    // Log for analytics
    console.log(`Selected step: ${step.description} (${step.id})`);
  };
  
  // Add specific handlers for EnhancedStepByStepVisualization
  // This function is now used in a useEffect to track step changes
  const handleStepChange = (stepIndex: number) => {
    if (response?.steps && stepIndex >= 0 && stepIndex < response.steps.length) {
      // Update the selected step index
      setSelectedStepIndex(stepIndex);
      
      // Also update the selected step for consistency
      setSelectedStep(response.steps[stepIndex]);
      
      // Log for analytics
      console.log(`Step changed to index ${stepIndex}: ${response.steps[stepIndex]?.description}`);
    }
  };
  
  // Handle back button click
  const handleBackClick = () => {
    setShowDetailedView(false);
    setSelectedStep(null);
    setSelectedStepIndex(-1);
  };
  
  // Create function to handle step completion
  // This function is passed as onComplete to EnhancedStepByStepVisualization components
  const handleStepCompletion = () => {
    // After visualization is completed, provide a visual cue that steps are interactive
    showToast('Analysis complete. Click on any step to view details.', 'info');
    
    // Log for analytics
    console.log('Step visualization sequence completed');
  };
  
  // Add a way to view steps in detail after visualization
  useEffect(() => {
    if (response?.steps && response.steps.length > 0 && selectedStepIndex >= 0) {
      // If we've selected the last step, consider showing a completion message
      if (selectedStepIndex === response.steps.length - 1) {
        // Slight delay to avoid too many toasts at once
        const timer = setTimeout(() => {
          handleStepCompletion();
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [response?.steps, selectedStepIndex, showToast]);

  // Add explanation of the responsive layout toggle feature
  useEffect(() => {
    if (showResponsiveLayout) {
      showToast('Switched to grid layout. Click on a card to view details.', 'info');
    }
  }, [showResponsiveLayout, showToast]);
  
  // This effect calls handleStepChange when selectedStepIndex changes
  useEffect(() => {
    if (response?.steps && selectedStepIndex >= 0 && selectedStepIndex < response.steps.length) {
      // Only call handleStepChange if we have a valid step
      handleStepChange(selectedStepIndex);
    }
  }, [selectedStepIndex, response?.steps]);  // Deliberately not including handleStepChange in deps to avoid infinite loop
  
  // Render while processing data
  if (isProcessing || !response) {
    return (
      <ResponsiveContainer className={`universal-response-processing ${className}`}>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-xl font-medium mb-4 text-gray-900 dark:text-gray-100">
            Analyzing Your {dataSourceType.toUpperCase()} Data
          </h2>
          {showProgress && (
            <DataProcessingProgress
              currentStage={processingStage}
              progress={processingProgress}
              message={processingMessage}
              showMultiStep={true}
              theme={theme}
              className="mt-4"
            />
          )}
        </div>
      </ResponsiveContainer>
    );
  }
  
  // Render the detailed step view
  if (showDetailedView && selectedStep) {
    return (
      <ResponsiveContainer className={`universal-response-detail ${className}`}>
        <div className="mb-4">
          <button
            onClick={handleBackClick}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Overview
          </button>
        </div>
        
        <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-xl font-medium mb-4 text-gray-900 dark:text-gray-100">
            {selectedStep.type.charAt(0).toUpperCase() + selectedStep.type.slice(1)} Step
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {selectedStep.description}
          </p>
          
          {selectedStep.content && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <h3 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Details</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {selectedStep.content}
              </p>
            </div>
          )}
          
          {selectedStep.data && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md overflow-x-auto">
              <h3 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Data</h3>
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(selectedStep.data, null, 2)}
              </pre>
            </div>
          )}
          
          {selectedStep.visualization && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Visualization</h3>
              <div className="visualization-container" style={{ height: '400px' }}>
                <EnhancedStepByStepVisualization
                  steps={[selectedStep]}
                  autoPlay={false}
                  initialStep={0}
                  dataSourceType={dataSourceType}
                  onComplete={handleStepCompletion}
                />
              </div>
            </div>
          )}
        </div>
      </ResponsiveContainer>
    );
  }
  
  // Render the main overview
  return (
    <div className={`universal-structured-response ${className}`}>
      {showProgress && isProcessing && (
        <DataProcessingProgress 
          currentStage={processingStage} 
          progress={processingProgress} 
          message={processingMessage}
          theme={theme}
        />
      )}
      
      {response && !isProcessing && (
        <div className="analysis-content">
          {/* View toggle button */}
          <div className="flex justify-end mb-4">
            <button 
              className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
              onClick={toggleViewMode}
            >
              {showResponsiveLayout ? 'Step Indicator View' : 'Responsive Grid View'}
            </button>
          </div>

          {/* Responsive Grid Layout View */}
          {showResponsiveLayout ? (
            <ResponsiveAnalysisLayout
              steps={response.steps || []}
              summary={response.summary || 'No summary available'}
              insights={response.insights || []}
              onStepClick={handleStepClick}
              className="mb-6"
            />
          ) : (
            /* Step Indicator View */
            <div>
              {/* Summary Section - Always visible */}
              <div className="mb-6">
                <h2 className="text-xl font-medium mb-2 text-gray-800 dark:text-gray-200">
                  Summary
                </h2>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300">
                    {response.summary || 'No summary available'}
                  </p>
                </div>
              </div>

              {/* Analysis Steps - Step-by-step visualization with StepIndicator */}
              {response.steps && response.steps.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">
                      Analysis Steps
                    </h2>
                    
                    {/* Use StepIndicator */}
                    <StepIndicator 
                      currentStep={selectedStepIndex !== -1 ? selectedStepIndex : 0} 
                      totalSteps={response.steps.length} 
                    />
                  </div>
                  
                  {/* Progressive Step Visualization */}
                  <EnhancedStepByStepVisualization
                    steps={response.steps}
                    insights={response.insights || []}
                    summary={response.summary || ''}
                    dataSourceType={dataSourceType}
                    initialStep={selectedStepIndex}
                    onComplete={handleStepCompletion}
                  />
                </div>
              )}

              {/* Insights Section */}
              {response.insights && response.insights.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-medium mb-2 text-gray-800 dark:text-gray-200">
                    Insights
                  </h2>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <ul className="list-disc pl-5 space-y-2">
                      {response.insights.map((insight, index) => (
                        <li key={index} className="text-gray-700 dark:text-gray-300">
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed View for Selected Step */}
          {showDetailedView && selectedStep && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">
                      {selectedStep.description || 'Step Details'}
                    </h2>
                    <button 
                      onClick={handleBackClick}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <span className="sr-only">Close</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    {selectedStep.visualization && (
                      <div className="mb-6 h-96">
                        <EnhancedStepByStepVisualization
                          steps={[selectedStep]}
                          autoPlay={false}
                          dataSourceType={dataSourceType}
                          onComplete={handleStepCompletion}
                        />
                      </div>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {selectedStep.content && (
                        <div dangerouslySetInnerHTML={{ __html: selectedStep.content }} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UniversalStructuredResponseView; 