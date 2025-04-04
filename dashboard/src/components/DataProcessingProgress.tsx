import React, { useState, useEffect } from 'react';
import { ProgressIndicator, MultiStepProgress } from './shared/ProgressIndicator';
import { ProcessingStage } from '../services/processors/UniversalDataProcessor';

interface DataProcessingProgressProps {
  currentStage: string;
  progress: number;
  message?: string;
  showMultiStep?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * A component to visualize the progress of data processing
 */
export const DataProcessingProgress: React.FC<DataProcessingProgressProps> = ({
  currentStage,
  progress,
  message,
  showMultiStep = true,
  theme = 'light',
  className = ''
}) => {
  // Define the processing stages and their order
  const stages = [
    { id: ProcessingStage.INITIALIZING, label: 'Initializing', status: 'idle', progress: 0 },
    { id: ProcessingStage.ANALYZING_QUERY, label: 'Analyzing Query', status: 'idle', progress: 0 },
    { id: ProcessingStage.DETERMINING_OPERATIONS, label: 'Planning Analysis', status: 'idle', progress: 0 },
    { id: ProcessingStage.PREPROCESSING_DATA, label: 'Processing Data', status: 'idle', progress: 0 },
    { id: ProcessingStage.ENHANCING_DATA, label: 'Enhancing Data', status: 'idle', progress: 0 },
    { id: ProcessingStage.GENERATING_RESPONSE, label: 'Generating Response', status: 'idle', progress: 0 },
    { id: ProcessingStage.PARSING_RESPONSE, label: 'Organizing Results', status: 'idle', progress: 0 },
    { id: ProcessingStage.PREPARING_VISUALIZATION, label: 'Preparing Visualization', status: 'idle', progress: 0 },
    { id: ProcessingStage.COMPLETED, label: 'Completed', status: 'idle', progress: 0 }
  ];

  // Calculate the current step index and update stage statuses
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [updatedStages, setUpdatedStages] = useState(stages);

  useEffect(() => {
    // Find the index of the current stage
    const currentIndex = stages.findIndex(stage => stage.id === currentStage);
    if (currentIndex !== -1) {
      setCurrentStepIndex(currentIndex);
      
      // Update the statuses and progress of all stages
      const newStages = stages.map((stage, index) => {
        if (index < currentIndex) {
          // Previous stages are complete
          return { ...stage, status: 'success' as const, progress: 100 };
        } else if (index === currentIndex) {
          // Current stage is in progress
          return { 
            ...stage, 
            status: progress === 100 ? 'success' as const : 'loading' as const, 
            progress 
          };
        } else {
          // Future stages are idle
          return { ...stage, status: 'idle' as const, progress: 0 };
        }
      });
      
      setUpdatedStages(newStages);
    }
  }, [currentStage, progress]);

  return (
    <div className={`data-processing-progress ${className}`}>
      {showMultiStep ? (
        <div className="multi-step-progress-container">
          <h3 className="text-lg font-medium mb-4">Analysis Progress</h3>
          <MultiStepProgress 
            steps={updatedStages.map(stage => ({
              ...stage,
              status: stage.status as 'idle' | 'loading' | 'success' | 'error'
            }))} 
            currentStepIndex={currentStepIndex}
            theme={theme}
          />
        </div>
      ) : (
        <div className="single-progress-container">
          <ProgressIndicator 
            progress={progress} 
            status={currentStage === ProcessingStage.COMPLETED ? 'success' : 'loading'}
            showPercentage={true}
            showLabel={true}
            label={message || currentStage}
            height={8}
            theme={theme}
            animated={true}
          />
        </div>
      )}
    </div>
  );
};

export default DataProcessingProgress; 