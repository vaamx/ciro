import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer,
  ResponsiveGrid 
} from './shared/ResponsiveContainer';
import { AnalysisStep } from '../types/ExcelTypes';

interface ResponsiveAnalysisLayoutProps {
  steps: AnalysisStep[];
  summary?: string;
  insights?: string[];
  className?: string;
  onStepClick?: (step: AnalysisStep) => void;
}

/**
 * A responsive layout for displaying analytical steps, summary, and insights
 */
export const ResponsiveAnalysisLayout: React.FC<ResponsiveAnalysisLayoutProps> = ({
  steps,
  summary,
  insights,
  className = '',
  onStepClick
}) => {
  // State for managing screen size and layout
  const [screenSize, setScreenSize] = useState<'small' | 'medium' | 'large'>('large');
  
  // Update screen size based on window width
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize('small');
      } else if (width < 1024) {
        setScreenSize('medium');
      } else {
        setScreenSize('large');
      }
    };
    
    // Set initial size
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Determine column count based on screen size
  const getColumnCount = () => {
    switch (screenSize) {
      case 'small': return 1;
      case 'medium': return 2;
      case 'large': return 3;
      default: return 3;
    }
  };
  
  // Get appropriate height based on screen size
  const getContainerHeight = () => {
    switch (screenSize) {
      case 'small': return 'auto';
      case 'medium': return 'auto';
      case 'large': return 'auto';
      default: return 'auto';
    }
  };
  
  // Render step card
  const renderStepCard = (step: AnalysisStep) => {
    return (
      <div 
        key={step.id}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 cursor-pointer"
        onClick={() => onStepClick && onStepClick(step)}
      >
        <div className="flex items-center mb-2">
          <span className="inline-block w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-semibold flex items-center justify-center mr-2">
            {step.order}
          </span>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {step.description}
        </p>
      </div>
    );
  };
  
  // Render summary card
  const renderSummaryCard = () => {
    if (!summary) return null;
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 col-span-full mb-4">
        <h2 className="font-medium text-lg mb-2 text-gray-900 dark:text-gray-100">Summary</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{summary}</p>
      </div>
    );
  };
  
  // Render insights card
  const renderInsightsCard = () => {
    if (!insights || insights.length === 0) return null;
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 col-span-full">
        <h2 className="font-medium text-lg mb-2 text-gray-900 dark:text-gray-100">Key Insights</h2>
        <ul className="list-disc pl-5 space-y-1">
          {insights.map((insight, index) => (
            <li key={index} className="text-sm text-gray-600 dark:text-gray-300">{insight}</li>
          ))}
        </ul>
      </div>
    );
  };
  
  return (
    <ResponsiveContainer
      className={`analysis-layout ${className}`}
      mobileHeight={getContainerHeight()}
      tabletHeight={getContainerHeight()}
      desktopHeight={getContainerHeight()}
    >
      <div className="mb-4">
        {renderSummaryCard()}
      </div>
      
      <ResponsiveGrid
        mobileColumns={1}
        tabletColumns={2}
        desktopColumns={getColumnCount()}
        gap="1rem"
        className="steps-grid mb-4"
      >
        {steps.map(step => renderStepCard(step))}
      </ResponsiveGrid>
      
      <div className="mt-4">
        {renderInsightsCard()}
      </div>
    </ResponsiveContainer>
  );
};

export default ResponsiveAnalysisLayout; 