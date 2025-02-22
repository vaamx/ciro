import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex items-center space-x-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <div className={`h-px w-4 ${index <= currentStep ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          )}
          <div
            className={`w-2 h-2 rounded-full ${
              index <= currentStep
                ? 'bg-purple-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
}; 