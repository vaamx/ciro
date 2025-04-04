import React, { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DataProcessingService } from '../../../services/DataProcessingService';
import { useNotification } from '../../../contexts/NotificationContext';
import { LazyVisualizationWrapper } from '../../../components/shared/LazyVisualization';
import { MessageMarkdown } from './MessageMarkdown';
import { TableFormatter } from '../../../services/TableFormatter';
import { TableVisualization } from '../../../Visualization/tables/TableVisualization';

// Helper function to map our internal chart types to the expected chart types
function mapChartType(type: string): string {
  // Normalize the input type by removing underscores and converting to lowercase
  const normalizedType = type.toLowerCase().replace(/_/g, '').replace(/chart$/, '');
  
  // Debug log for chart type mapping
  console.debug(`[Chart Type Mapping] Original: "${type}", Normalized: "${normalizedType}"`);
  
  const typeMap: Record<string, string> = {
    'bar': 'bar',
    'barchart': 'bar',
    'bar_chart': 'bar',
    'line': 'line',
    'linechart': 'line',
    'line_chart': 'line',
    'pie': 'pie',
    'piechart': 'pie',
    'pie_chart': 'pie',
    'area': 'area',
    'areachart': 'area',
    'area_chart': 'area',
    'scatter': 'scatter',
    'scatterchart': 'scatter',
    'scatter_chart': 'scatter',
    'composed': 'composed',
    'composedchart': 'composed',
    'composed_chart': 'composed',
    'heatmap': 'heatmap',
    'heatmapchart': 'heatmap',
    'radar': 'radar',
    'radarchart': 'radar',
    'radar_chart': 'radar',
    'funnel': 'funnel',
    'funnelchart': 'funnel',
    'funnel_chart': 'funnel',
    'treemap': 'treemap',
    'treemapchart': 'treemap',
    'treemap_chart': 'treemap',
    'network': 'network',
    'networkgraph': 'network',
    'network_graph': 'network',
    'geospatial': 'geospatial',
    'geospatialmap': 'geospatial',
    'geospatial_map': 'geospatial',
    'sankey': 'sankey',
    'sankeydiagram': 'sankey',
    'sankey_diagram': 'sankey',
    'table': 'table'
  };
  
  // Try to match the normalized type first
  if (typeMap[normalizedType]) {
    const result = typeMap[normalizedType];
    console.debug(`[Chart Type Mapping] Matched normalized type: "${normalizedType}" → "${result}"`);
    return result;
  }
  
  // If no match with normalized type, try the original type
  const result = typeMap[type] || type || 'bar';
  console.debug(`[Chart Type Mapping] Final result: "${result}"`);
  return result;
}

// Helper function to validate and normalize visualization types
function validateVisualizationType(type: string | undefined): string {
  console.log(`[DEBUG] validateVisualizationType called with type: "${type}"`);
  
  if (!type) {
    console.log('[DEBUG] No type provided, defaulting to "bar"');
    return 'bar'; // Default to bar if no type provided
  }
  
  // Check URL parameters for forced chart type
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const forcedChartType = urlParams.get('chartType');
    if (forcedChartType) {
      console.log(`[DEBUG] Forcing chart type from URL parameter: "${forcedChartType}"`);
      return mapChartType(forcedChartType);
    }
  } catch (error) {
    console.error('Error checking URL parameters:', error);
  }
  
  // Get the mapped type
  const mappedType = mapChartType(type);
  console.log(`[DEBUG] Type "${type}" mapped to "${mappedType}"`);
  
  // List of all supported visualization types from the Visualization directory
  const supportedTypes = [
    'bar', 'line', 'pie', 'area', 'scatter', 'composed', 
    'heatmap', 'radar', 'funnel', 'treemap', 'network', 
    'geospatial', 'sankey', 'table'
  ];
  
  // Check if the mapped type is supported
  if (supportedTypes.includes(mappedType)) {
    console.log(`[DEBUG] Type "${mappedType}" is supported`);
    return mappedType;
  }
  
  // If not supported, log a warning and return a default
  console.warn(`[Visualization Type] Unsupported type: "${type}" (mapped to "${mappedType}"). Falling back to "bar".`);
  return 'bar';
}

// Loading placeholder for lazy-loaded components
export const VisualizationLoader = () => (
  <div className="animate-pulse rounded-lg overflow-hidden">
    <div className="h-64 bg-gray-200 dark:bg-gray-700"></div>
    <div className="h-4 mt-3 bg-gray-200 dark:bg-gray-700 w-3/4 rounded"></div>
    <div className="h-3 mt-2 bg-gray-200 dark:bg-gray-700 w-1/2 rounded"></div>
  </div>
);

// Icons
// Step type icons imported from AnalyticalStep
const ChartBarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
  </svg>
);

const AggregateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
  </svg>
);

const SortIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
  </svg>
);

const GroupIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z" />
  </svg>
);

const InsightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
  </svg>
);

const CompareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const TableIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
  </svg>
);

export interface AnalyticalStep {
  id: string;
  type: string;
  description: string;
  order: number;
  data?: any;
  content?: string;
  code?: string;
  insights?: string[];
  metrics?: Array<{label: string, value: string | number}>;
  visualization?: {
    type: string;
    config: {
      data?: any[];
      xKey?: string;
      yKey?: string;
      series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
      labels?: { title?: string; xAxis?: string; yAxis?: string };
      options?: Record<string, any>;
    };
  };
  // Add multiple visualizations support
  visualizations?: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    config: {
      data?: any[];
      xKey?: string;
      yKey?: string;
      series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
      labels?: { title?: string; xAxis?: string; yAxis?: string };
      options?: Record<string, any>;
    };
  }>;
  recommendations?: string[];
  actionableInsights?: string[];
}

interface EnhancedStepByStepVisualizationProps {
  steps: AnalyticalStep[];
  autoPlay?: boolean;
  autoPlayDelay?: number;
  onComplete?: () => void;
  onStepChange?: (stepIndex: number) => void;
  initialStep?: number;
  dataSourceType?: string;
  insights?: string[];
  summary?: string;
  visualizationData?: {
    data: any[];
    type: string;
    xKey?: string;
    yKey?: string;
    series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    preserveType?: boolean;
    options?: {
      forceChartType?: string;
      isPieChart?: boolean;
      useDirectColorAssignment?: boolean;
      useMultipleColors?: boolean;
      [key: string]: any;
    };
  } | null;
  // Add support for multiple visualizations
  visualizationsData?: Array<{
    id: string;
    data: any[];
    type: string;
    xKey?: string;
    yKey?: string;
    series?: Array<{ dataKey: string; name?: string; color?: string; type?: string }>;
    title?: string;
    description?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    preserveType?: boolean;
    options?: {
      forceChartType?: string;
      isPieChart?: boolean;
      useDirectColorAssignment?: boolean;
      useMultipleColors?: boolean;
      [key: string]: any;
    };
  }>;
  recommendations?: string[];
  actionableInsights?: string[];
}

// Define a context for steps data to be used by child components
interface StepContextType {
  dataSourceType: string;
  steps: AnalyticalStep[];
}

const StepContext = React.createContext<StepContextType | null>(null);

// Initialize DataProcessingService - using singleton pattern to avoid private constructor access
// Instead of direct instantiation:
// const dataProcessingService = new DataProcessingService();
// Use getInstance method:
// const dataProcessingService = DataProcessingService.getInstance();

export const EnhancedStepByStepVisualization: React.FC<EnhancedStepByStepVisualizationProps> = ({
  steps: initialSteps = [],
  autoPlay = false,
  autoPlayDelay = 2000,
  onComplete,
  onStepChange,
  initialStep = 0,
  dataSourceType = 'unknown',
  insights = [],
  summary = '',
  visualizationData = null,
  visualizationsData = []
}): JSX.Element => {
  // State for steps
  const [steps, setSteps] = useState<AnalyticalStep[]>(initialSteps);
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  const [recommendations] = useState<string[]>([]);
  // Current slide for visualization
  const [currentSlide, setCurrentSlide] = useState(0);
  // Local state for visualizations data
  const [localVisualizationsData, setLocalVisualizationsData] = useState<any[]>([]);
  // Show/hide data table toggle
  const [showDataTable, setShowDataTable] = useState(false);
  // For tracking "add to dashboard" operations
  const [addingToDashboard, setAddingToDashboard] = useState<string | null>(null);

  // Get access to notification system
  const { showNotification } = useNotification();

  // Refs for tracking data to avoid duplicates
  const visualizationDataRef = useRef<string | null>(null);
  const visualizationsDataRef = useRef<string | null>(null);

  // Function to navigate between slides
  const navigateSlide = (direction: 'next' | 'prev' | number) => {
    if (!localVisualizationsData || localVisualizationsData.length === 0) return;
    
    if (typeof direction === 'number') {
      // Direct navigation to a specific slide
      if (direction >= 0 && direction < localVisualizationsData.length) {
        setCurrentSlide(direction);
      }
    } else if (direction === 'next') {
      setCurrentSlide(current => (current + 1) % localVisualizationsData.length);
    } else {
      setCurrentSlide(current => (current - 1 + localVisualizationsData.length) % localVisualizationsData.length);
    }
  };

  // Define a normalized data source type
  const normalizedDataSourceType = useMemo(() => {
    if (!dataSourceType) return 'unknown';
    
    // Map data source types to standardized format
    const sourceTypeMap: Record<string, string> = {
      'pdf': 'pdf',
      'excel': 'spreadsheet',
      'csv': 'spreadsheet',
      'doc': 'document',
      'docx': 'document',
      'database': 'database',
      'table': 'database',
      'sql': 'database',
      'api': 'api',
      'rest': 'api',
      'qdrant': 'qdrant',
      'vector_db': 'qdrant',
      'vector-db': 'qdrant',
      'vectordb': 'qdrant'
    };
    
    const normalizedType = dataSourceType.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return sourceTypeMap[normalizedType] || normalizedType || 'unknown';
  }, [dataSourceType]);
  
  console.log('Data source type received:', JSON.stringify(dataSourceType));
  console.log('Normalized data source type:', JSON.stringify(normalizedDataSourceType));
  
  // Completely disable mock data generation
  const generateSampleData = (): any[] => {
    // Always return an empty array - completely disable mock data
    return [];
  };
  
  // Function to generate a new chart type from existing data
  const generateAlternateChartType = useCallback((data: any[], currentType: string) => {
    if (!data || data.length === 0) return null;
    
    // Choose a different chart type than the current one
    const chartTypes = ['bar', 'pie', 'line', 'area', 'treemap'];
    const filteredTypes = chartTypes.filter(type => type !== currentType);
    const randomType = filteredTypes[Math.floor(Math.random() * filteredTypes.length)];
    
    const keys = Object.keys(data[0]);
    return {
      id: `alt-chart-${Date.now()}`,
      title: `Alternative ${randomType.charAt(0).toUpperCase() + randomType.slice(1)} View`,
      description: `${randomType.charAt(0).toUpperCase() + randomType.slice(1)} chart visualization of the same data`,
      type: randomType,
      data: data,
      xKey: keys[0],
      yKey: keys[1] || 'value',
      options: {
        forceChartType: randomType,
        useMultipleColors: true
      }
    };
  }, []);
  
  // Force disable mock data completely and make it global
  useEffect(() => {
    // No need to set showMockData since we removed it
    
    // Define global variable to disable mock data across the application
    try {
      if (typeof window !== 'undefined') {
        (window as any).DISABLE_MOCK_DATA = true;
        (window as any).SHOW_TEMPLATES_DURING_THINKING = false;
      }
    } catch (e) {
      console.error('Failed to set global mock data flag:', e);
    }
  }, []);
  
  // Log important props for debugging
  useEffect(() => {
    console.log('EnhancedStepByStepVisualization - Props received:', {
      stepsCount: initialSteps.length,
      dataSourceType,
      normalizedDataSourceType,
      hasInsights: insights.length > 0,
      hasSummary: !!summary,
      hasVisualizationData: !!visualizationData,
      multipleVisualizationsCount: visualizationsData?.length || 0
    });
    
    // Log more detailed information about the data source type
    console.log(`Data source type received: "${dataSourceType}"`);
    console.log(`Normalized data source type: "${normalizedDataSourceType}"`);
    
    if (normalizedDataSourceType === 'unknown' || normalizedDataSourceType === '') {
      console.warn('Non-specific data source type detected. This may affect RAG functionality.');
    }
    
    // Set ready state after a short delay to ensure all data is processed
    // Only set ready if we have actual data to display
    if (initialSteps.length > 0 || summary || visualizationData || (visualizationsData && visualizationsData.length > 0)) {
      const hasValidData = initialSteps.some(step => 
        step.content || 
        (step.visualization && step.visualization.config && step.visualization.config.data) ||
        (step.visualizations && step.visualizations.length > 0)
      );
      
      if (hasValidData || summary || visualizationData || (visualizationsData && visualizationsData.length > 0)) {
        // Set ready state after a short delay to ensure all data is processed
        const timer = setTimeout(() => {
          setIsReady(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [initialSteps, dataSourceType, normalizedDataSourceType, insights, summary, visualizationData, visualizationsData]);
  
  // Create context value for steps
  const contextValue = useMemo<StepContextType>(() => ({
    dataSourceType: normalizedDataSourceType,
    steps
  }), [normalizedDataSourceType, steps]);
  
  // Update steps when initialSteps changes
  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);
  
  // Create default steps if none are provided but summary is available
  useEffect(() => {
    if (initialSteps.length === 0 && summary && summary.length > 0) {
      console.log('Creating default step from summary content');
      
      // Create a simple default step without mock data
      const defaultSteps = [{
        id: 'default-step',
        type: 'info',
        description: 'Search Results',
        order: 1,
        content: summary,
        // Use empty data array - no mock data
        data: []
      }];
      
      setSteps(defaultSteps);
    }
  }, [initialSteps, summary]);
  
  // Add all visualizations from visualizationsData if provided
  useEffect(() => {
    if (visualizationsData && 
        visualizationsData.length > 0 && 
        visualizationsData.every(viz => viz.data && Array.isArray(viz.data) && viz.data.length > 0)) {
      
      // Check if this visualization data already exists in steps
      const dataString = JSON.stringify(visualizationsData);
      const prevDataString = visualizationsDataRef.current;
      
      // Only add new steps if the data has changed
      if (dataString !== prevDataString) {
        visualizationsDataRef.current = dataString;
        
        // Create new steps for each visualization
        const newSteps = visualizationsData.map((vizData, index) => {
          // Generate meaningful insights based on the data
          const dataInsights = generateInsightsFromData(
            vizData.data, 
            vizData.type,
            vizData.xKey,
            vizData.yKey
          );
          
          // Generate domain-specific insights
          const domainSpecificInsights = generateDomainSpecificInsights(
            vizData.data, 
            normalizedDataSourceType
          );
          
          // Combine insights, prioritizing domain-specific ones first
          const combinedInsights = [...domainSpecificInsights.slice(0, 2), ...dataInsights];
          
          // Generate summary
          const dataSummary = generateSummaryFromData(vizData.data);
          
          // Generate recommendations
          const dataRecommendations = generateRecommendations(vizData.type);
          
          // Respect the requested chart type
          const chartType = vizData.options?.forceChartType || 
                           vizData.type || 
                           (vizData.options?.isPieChart ? 'pie' : 'bar');
                           
          return {
            id: `viz-${vizData.id || Date.now() + index}`,
            type: 'visualization',
            description: vizData.description || `${vizData.type.charAt(0).toUpperCase() + vizData.type.slice(1)} Analysis`,
            order: steps.length + index + 1,
            content: `## ${vizData.title || 'Data Analysis'}\n\n` +
                    `${dataSummary || vizData.description || 'This visualization shows patterns in the data.'}\n\n` +
                    '```json\n' + 
                    JSON.stringify(vizData.data, null, 2) + 
                    '\n```',
            insights: combinedInsights,
            recommendations: dataRecommendations,
            metrics: generateMetricsFromData(vizData.data),
            visualization: {
              type: chartType,
              config: {
                data: vizData.data,
                xKey: vizData.xKey || (vizData.data[0] ? Object.keys(vizData.data[0])[0] : undefined),
                yKey: vizData.yKey || (vizData.data[0] ? Object.keys(vizData.data[0])[1] : undefined),
                series: vizData.series || [
                  {
                    dataKey: vizData.yKey || (vizData.data[0] ? Object.keys(vizData.data[0])[1] : 'value'),
                    name: vizData.yAxisLabel || (vizData.data[0] ? Object.keys(vizData.data[0])[1] : 'Value')
                  }
                ],
                labels: {
                  title: vizData.title || 'Data Analysis',
                  xAxis: vizData.xAxisLabel || (vizData.data[0] ? Object.keys(vizData.data[0])[0] : 'Category'),
                  yAxis: vizData.yAxisLabel || (vizData.data[0] ? Object.keys(vizData.data[0])[1] : 'Value')
                },
                options: {
                  useDirectColorAssignment: true,
                  useMultipleColors: true,
                  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                  ...vizData.options
                }
              }
            }
          };
        });
        
        // Add the new steps to existing steps
        setSteps(prevSteps => [...prevSteps, ...newSteps]);
        
        // Auto-expand the new steps
        for (const step of newSteps) {
          setExpandedSteps(prev => [...prev, step.id]);
        }
      }
    }
  }, [visualizationsData, steps, normalizedDataSourceType]);
  
  // Add visualization step if visualizationData is provided
  useEffect(() => {
    if (visualizationData && 
        visualizationData.data && 
        Array.isArray(visualizationData.data) && 
        visualizationData.data.length > 0 && 
        visualizationData.type) {
      
      // Check if this visualization data already exists in steps
      const dataString = JSON.stringify(visualizationData.data);
      const prevDataString = visualizationDataRef.current;
      
      // Only add a new step if the data has changed
      if (dataString !== prevDataString) {
        visualizationDataRef.current = dataString;
        
        // Check if the step already exists
        const existingStep = steps.find(step => 
          step.visualization && 
          JSON.stringify(step.visualization.config.data) === dataString
        );
        
        if (!existingStep) {
          // Generate meaningful insights from the data
          const dataInsights = generateInsightsFromData(
            visualizationData.data, 
            visualizationData.type,
            visualizationData.xKey,
            visualizationData.yKey
          );
          
          // Generate domain-specific recommendations based on data source type
          const domainSpecificInsights = generateDomainSpecificInsights(
            visualizationData.data,
            normalizedDataSourceType
          );
          
          // Combine general insights with domain-specific insights
          const combinedInsights = [...domainSpecificInsights.slice(0, 2), ...dataInsights];
          
          // Generate recommendations
          const dataRecommendations = generateRecommendations(visualizationData.type);
          
          // Generate detailed summary
          const dataSummary = generateSummaryFromData(visualizationData.data);
          
          // Respect the requested chart type
          const chartType = visualizationData.options?.forceChartType || 
                           visualizationData.type || 
                           (visualizationData.options?.isPieChart ? 'pie' : 'bar');
          
          // Create a new step with proper visualization
          const newStep: AnalyticalStep = {
            id: `viz-${Date.now()}`,
            type: 'visualization',
            description: `Comprehensive Analysis of ${visualizationData.title || 'Dataset'}`,
            order: steps.length + 1,
            content: `## ${visualizationData.title || 'Data Analysis'}\n\n` +
                    `${dataSummary}\n\n` +
                    '```json\n' + 
                    JSON.stringify(visualizationData.data, null, 2) + 
                    '\n```',
            insights: combinedInsights,
            recommendations: dataRecommendations,
            metrics: generateMetricsFromData(visualizationData.data),
            visualization: {
              type: chartType,
              config: {
                data: visualizationData.data,
                xKey: visualizationData.xKey || (visualizationData.data[0] ? Object.keys(visualizationData.data[0])[0] : undefined),
                yKey: visualizationData.yKey || (visualizationData.data[0] ? Object.keys(visualizationData.data[0])[1] : undefined),
                series: visualizationData.series || [
                  {
                    dataKey: visualizationData.yKey || (visualizationData.data[0] ? Object.keys(visualizationData.data[0])[1] : 'value'),
                    name: visualizationData.title || 'Value'
                  }
                ],
                labels: {
                  title: visualizationData.title || `Data Analysis`,
                  xAxis: visualizationData.xAxisLabel || (visualizationData.data[0] ? Object.keys(visualizationData.data[0])[0] : 'Category'),
                  yAxis: visualizationData.yAxisLabel || (visualizationData.data[0] ? Object.keys(visualizationData.data[0])[1] : 'Value')
                },
                options: {
                  useDirectColorAssignment: true,
                  useMultipleColors: true,
                  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                  ...visualizationData.options
                }
              }
            }
          };
          
          // Add the new step to the steps array
          setSteps(prevSteps => [...prevSteps, newStep]);
          
          // Auto-expand the new step
          setExpandedSteps(prev => [...prev, newStep.id]);
        }
      }
    }
  }, [visualizationData, steps, normalizedDataSourceType]);
  
  // Handle auto-advancing with useEffect
  useEffect(() => {
    // Only continue if autoplay is enabled and we're not at the end
    if (autoPlay && currentStepIndex < steps.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, autoPlayDelay);
      
      return () => clearTimeout(timer);
    }
    
    // If we've reached the end, call onComplete
    if (currentStepIndex === steps.length - 1) {
      if (onComplete) {
        onComplete();
      }
    }
    
    // Notify about step change
    if (onStepChange) {
      onStepChange(currentStepIndex);
    }
  }, [currentStepIndex, steps.length, autoPlay, autoPlayDelay, onComplete, onStepChange]);
  
  // Toggle step expansion
  const toggleStepExpand = (stepId: string) => {
    setExpandedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId) 
        : [...prev, stepId]
    );
  };

  // Generate insights from data
  const generateMetricsFromData = (data: any[]): Array<{label: string, value: string | number}> => {
    if (!data || data.length === 0) return [];
    
    const metrics: Array<{label: string, value: string | number}> = [];
    try {
      // Basic metrics
      metrics.push({ label: 'Total Records', value: data.length });
      
      // If we have numerical data, calculate statistics
      const numericKeys = Object.keys(data[0]).filter(key => {
        return !isNaN(parseFloat(data[0][key]));
      });
      
      if (numericKeys.length > 0) {
        const key = numericKeys[0]; // Use first numeric key for statistics
        
        // Calculate sum, average, max, min
        const values = data.map(item => parseFloat(item[key])).filter(val => !isNaN(val));
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const max = Math.max(...values);
          const min = Math.min(...values);
          
          metrics.push({ label: 'Total Sum', value: sum.toFixed(2) });
          metrics.push({ label: 'Average', value: avg.toFixed(2) });
          metrics.push({ label: 'Maximum', value: max });
          metrics.push({ label: 'Minimum', value: min });
        }
      }
      
      // Add data source specific metrics
      if (data[0].type) {
        // Count by type if available
        const typeCounts: Record<string, number> = {};
        data.forEach(item => {
          typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        });
        
        const primaryType = Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count }))[0];
          
        if (primaryType) {
          metrics.push({ 
            label: 'Primary Type', 
            value: `${primaryType.type} (${primaryType.count})` 
          });
        }
      }
      
    } catch (error) {
      console.error('Error generating metrics:', error);
    }
    
    return metrics;
  };
  
  // Add visualization to dashboard
  const handleAddToDashboard = useCallback(async (visualization: any, vizId: string) => {
    if (!visualization || !normalizedDataSourceType) return;

    try {
      console.log('Visualization data being sent to dashboard:', JSON.stringify(visualization, null, 2));
      
      // Set the current visualization as being added to dashboard
      setAddingToDashboard(vizId);
      
      // Create instance and call addToDashboard method
      const dataProcessingService = DataProcessingService.getInstance();
      const success = await dataProcessingService.addToDashboard(visualization);
      
      if (success) {
        showNotification({
          type: 'success',
          message: 'Visualization added to dashboard!'
        });
      } else {
        showNotification({
          type: 'error',
          message: 'Failed to add visualization to dashboard'
        });
      }
      
      // Clear the adding state
      setAddingToDashboard(null);
    } catch (error) {
      console.error('Error adding to dashboard:', error);
      showNotification({
        type: 'error',
        message: 'An error occurred while adding to dashboard'
      });
      
      // Clear the adding state on error
      setAddingToDashboard(null);
    }
  }, [normalizedDataSourceType, showNotification]);
  
  // Get appropriate icon for step type
  const getStepIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'filtering':
        return <FilterIcon />;
      case 'aggregation':
        return <AggregateIcon />;
      case 'grouping':
        return <GroupIcon />;
      case 'sorting':
        return <SortIcon />;
      case 'visualization':
        return <ChartBarIcon />;
      case 'comparative':
        return <CompareIcon />;
      case 'insights':
        return <InsightIcon />;
      case 'table':
        return <TableIcon />;
      default:
        return <TableIcon />;
    }
  };
  
  // Get background color based on step type
  const getStepBgColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'filtering':
        return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30';
      case 'aggregation':
        return 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30';
      case 'grouping':
        return 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30';
      case 'sorting':
        return 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/30';
      case 'visualization':
        return 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30';
      case 'comparative':
        return 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/30';
      case 'insights':
        return 'border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-900/30';
      case 'table':
        return 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
      default:
        return 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800';
    }
  };
  
  // Enhanced function to extract and process step data from Qdrant
  const processStepData = (step: AnalyticalStep) => {
    if (!step.data && !step.content) {
      return { hasData: false, tableData: null as any[] | null, processed: step.content || '', tables: [] };
    }
    
    try {
      // Initialize an array to store extracted tables
      const tables: Array<{title: string, data: any[], content: string}> = [];
      
      // Get the processed content (use content if available, otherwise use description)
      let processed = step.content || step.description || '';
      
      // Check if content has actual table data structures (arrays of objects)
      let tableData: any[] | null = null;
      
      // Handle data directly from Qdrant if available
      if (step.data) {
        // If data is a string, try to parse it as JSON
        if (typeof step.data === 'string') {
          try {
            const parsedData = JSON.parse(step.data);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              tableData = parsedData;
            }
          } catch (e) {
            console.log('Data is not valid JSON, using as text', step.data);
            // If it's not valid JSON, append it to the processed content
            processed += '\n\n' + step.data;
          }
        } 
        // If data is an array, use it directly
        else if (Array.isArray(step.data)) {
          tableData = step.data;
        } 
        // If data is an object, convert to array with single item
        else if (typeof step.data === 'object' && step.data !== null) {
          tableData = [step.data];
        }
      }
      
      // Search for markdown tables in the content
      const markdownTables = TableFormatter.extractTablesFromMarkdown(processed);
      if (markdownTables && markdownTables.length > 0) {
        // If we found markdown tables and don't already have tableData, use the first one
        if (!tableData && markdownTables[0].length > 0) {
          tableData = markdownTables[0];
        }
        
        // Add all markdown tables to our tables array
        markdownTables.forEach((tableRows, index) => {
          if (tableRows.length > 0) {
            tables.push({
              title: `Table ${index + 1}`,
              data: tableRows,
              content: TableFormatter.toMarkdownTable(tableRows)
            });
          }
        });
      }
      
      return { 
        hasData: tableData !== null || tables.length > 0, 
        tableData, 
        processed, 
        tables 
      };
    } catch (e) {
      console.error('Error processing step data:', e);
      return { 
        hasData: false, 
        tableData: null, 
        processed: step.content || step.description || '', 
        tables: [] 
      };
    }
  };
  
  // Enhance the renderStep function to properly display tables
  // @ts-ignore - This function is currently unused but kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderStep = useCallback((step: AnalyticalStep, index: number) => {
    const isExpanded = expandedSteps.includes(step.id);
    const stepIcon = getStepIcon(step.type);
    const stepBgColor = getStepBgColor(step.type);
    
    // Process the step data to extract tables and format content
    const { processed } = processStepData(step);
    
    // Format the step type to lowercase for display
    const displayType = step.type.toLowerCase();
    
    // Clean up the description text by removing all numbering, markdown, and type prefixes
    let cleanDescription = step.description
      .replace(/^\d+\.\s*/, '') // Remove leading numbers like "1. "
      .replace(/^\d+\.\s*\d+\.\s*/, '') // Remove double numbering like "1. 1. "
      .replace(/\*\*([^*]+)\*\*:?\s*/g, '') // Remove markdown bold patterns with colon like "**AGGREGATION:** "
      .replace(new RegExp(`^${step.type}:\\s*`, 'i'), '') // Remove type prefix like "TYPE: " (case insensitive)
      .replace(new RegExp(`^${displayType}:\\s*`, 'i'), '') // Remove lowercase type prefix
      .replace(new RegExp(`^${displayType.toUpperCase()}:\\s*`, 'i'), '') // Remove uppercase type
      .trim();
    
    // Remove any duplicate content between type and description
    if (cleanDescription.startsWith('First, I reviewed')) {
      // If it starts with a common pattern, ensure it's only shown once
      cleanDescription = cleanDescription.replace(/^\d+\.\s*/, ''); // Remove any remaining numbers
    }
    
    // Extract the original text from the processed content for the results section
    const originalText = processed || step.description;
    
    return (
      <motion.div 
        key={step.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`mb-6 border rounded-xl overflow-hidden bg-white dark:bg-gray-800/50 shadow-sm
                   ${isExpanded ? 'transition-all duration-500 ease-in-out' : 'hover:shadow-md transition-all'}`}
      >
        <div 
          className="px-5 py-4 flex justify-between items-center cursor-pointer"
          onClick={() => toggleStepExpand(step.id)}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${stepBgColor} text-white flex items-center justify-center`}>
              {stepIcon}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                <span className="text-lg font-bold">{index + 1}.</span> <span className="text-purple-600 dark:text-purple-400 font-medium">{displayType}:</span> {cleanDescription}
              </div>
              {!isExpanded && (
                <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[500px] truncate">
                  {processed?.substring(0, 100)}
                  {processed && processed.length > 100 ? '...' : ''}
                </div>
              )}
            </div>
          </div>
          <div>
            <button
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                toggleStepExpand(step.id);
              }}
            >
              {isExpanded ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="px-5 pb-5 pt-3">
            <div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-200">Analysis Details</h3>
                
                <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                  This {displayType} analysis examines relationships and patterns in the data to extract meaningful business insights.
                </p>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800 mb-4">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <span className="font-medium">{displayType} Results:</span> {index + 1}. {originalText.includes("**") ? originalText : `**${step.type.toUpperCase()}:** ${cleanDescription}`}
                  </p>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Data Preview</h4>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <TableVisualization 
                      data={step.data && Array.isArray(step.data) && step.data.length > 0 ? step.data : generateSampleData()}
                      title=""
                      maxHeight="250px"
                      pagination={false}
                      pageSize={5}
                      responsive={true}
                      className="w-full"
                      style={{ fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  }, [expandedSteps, toggleStepExpand, getStepIcon, getStepBgColor, handleAddToDashboard]);
  
  // Function to generate multiple visualizations from data
  const generateMultipleVisualizations = (data: any[]): any[] => {
    if (!data || data.length === 0) {
      console.warn('Cannot generate visualizations from empty data');
      return [];
    }

    console.log('Generating visualizations from data with length:', data.length);
    
    try {
      // Extract keys from the first data item
      const keys = Object.keys(data[0]);
      
      // Determine potential category and value keys
      const potentialCategoryKeys = keys.filter(key => 
        typeof data[0][key] === 'string' || 
        key.toLowerCase().includes('category') || 
        key.toLowerCase().includes('name')
      );
      
      const potentialValueKeys = keys.filter(key => 
        typeof data[0][key] === 'number' || 
        !isNaN(parseFloat(data[0][key])) ||
        key.toLowerCase().includes('value') ||
        key.toLowerCase().includes('amount')
      );
      
      // Use the first available keys or default to first two keys
      const categoryKey = potentialCategoryKeys[0] || keys[0];
      const valueKey = potentialValueKeys[0] || keys[1] || keys[0];
      
      console.log('Using keys for visualizations:', { categoryKey, valueKey });

      // Ensure we have a consistent data format for all charts
      const normalizedData = data.map(item => ({
        category: item[categoryKey] || 'Unknown',
        value: typeof item[valueKey] === 'number' ? 
          item[valueKey] : 
          (parseFloat(item[valueKey]) || 0)
      }));

      // Create an array of visualizations
      const visualizations = [];
      const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

      // Bar Chart
      visualizations.push({
        id: `bar-chart-${Date.now()}`,
        type: 'bar',
        title: 'Data Distribution',
        description: 'Bar chart showing distribution of values by category',
        data: normalizedData,
        xKey: 'category',
        yKey: 'value',
        options: {
          theme,
          forceChartType: 'bar',
          showValues: true,
          valueFormatter: (value: number) => value.toLocaleString()
        }
      });

      // Pie Chart
      visualizations.push({
        id: `pie-chart-${Date.now()}`,
        type: 'pie',
        title: 'Composition Analysis',
        description: 'Pie chart showing relative proportion of each category',
        data: normalizedData,
        xKey: 'category',
        yKey: 'value',
        options: {
          theme,
          forceChartType: 'pie',
          isPieChart: true,
          useDirectColorAssignment: true,
          useMultipleColors: true
        }
      });

      // Line Chart
      visualizations.push({
        id: `line-chart-${Date.now()}`,
        type: 'line',
        title: 'Trend Analysis',
        description: 'Line chart showing value trends across categories',
        data: normalizedData,
        xKey: 'category',
        yKey: 'value',
        options: {
          theme,
          forceChartType: 'line',
          smooth: true,
          showSymbol: true
        }
      });

      // Donut Chart
      visualizations.push({
        id: `donut-chart-${Date.now()}`,
        type: 'donut',
        title: 'Proportion Distribution',
        description: 'Donut chart visualizing category proportions',
        data: normalizedData,
        xKey: 'category',
        yKey: 'value',
        options: {
          theme,
          forceChartType: 'donut',
          useDirectColorAssignment: true,
          useMultipleColors: true,
          innerRadius: '50%'
        }
      });

      // If there are at least 5 data points, add area chart
      if (data.length >= 5) {
        visualizations.push({
          id: `area-chart-${Date.now()}`,
          type: 'area',
          title: 'Cumulative Distribution',
          description: 'Area chart showing cumulative values',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'area',
            smooth: true,
            fillOpacity: 0.6
          }
        });
      }

      console.log(`Successfully generated ${visualizations.length} visualizations`);
      return visualizations;
    } catch (error) {
      console.error('Error generating visualizations:', error);
      return [];
    }
  };

  // Make sure initial data for visualizationsData
  useEffect(() => {
    // Create a stable reference to the data to prevent infinite re-renders
    const vizData = visualizationData?.data || [];
    const vizDataJSON = JSON.stringify(vizData);
    
    // Skip processing if we've already processed this data
    if (vizDataJSON === visualizationDataRef.current && localVisualizationsData.length > 0) {
      return;
    }
    
    console.log("Visualization initialization starting", { 
      hasVisData: vizData.length > 0,
      hasMultipleVisData: !!visualizationsData?.length
    });
    
    // Process directly provided visualizations if available
    if (visualizationsData && Array.isArray(visualizationsData) && visualizationsData.length > 0) {
      console.log(`Setting ${visualizationsData.length} visualizations from direct visualizationsData prop`);
      
      // Apply theme to visualizations
      const processedVisualizations = visualizationsData.map(viz => ({
        ...viz,
        options: {
          ...(viz.options || {}),
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        }
      }));
      
      setLocalVisualizationsData(processedVisualizations);
      visualizationDataRef.current = vizDataJSON;
      return;
    }
    
    // Generate visualizations from single visualization data
    if (vizData.length > 0) {
      console.log(`Generating visualizations from data with ${vizData.length} items`);
      
      try {
        // Create organized sections of chart types
        const barSectionCharts = generateBarCharts(vizData);
        const lineSectionCharts = generateLineCharts(vizData);
        const pieSectionCharts = generatePieCharts(vizData);
        
        // Combine all visualizations
        const allVisualizations = [
          ...barSectionCharts,
          ...lineSectionCharts,
          ...pieSectionCharts
        ];
        
        console.log(`Generated ${allVisualizations.length} total visualizations in 3 categories`);
        
        // Set local state
        setLocalVisualizationsData(allVisualizations);
        visualizationDataRef.current = vizDataJSON;
      } catch (error) {
        console.error("Error generating visualizations:", error);
      }
    }
  }, [visualizationData?.data, visualizationsData]);

  // Function to generate bar chart visualizations
  const generateBarCharts = (data: any[]): any[] => {
    if (!data || data.length === 0) return [];
    
    console.log('Generating bar charts from data');
    
    try {
      // Extract categories and values from data
      const categoryKey = determineKeyOfType(data, 'string') || Object.keys(data[0])[0];
      const valueKey = determineKeyOfType(data, 'number') || Object.keys(data[0])[1];
      
      // Create normalized data for consistent use in charts
      const normalizedData = data.map(item => ({
        category: item[categoryKey] || 'Category',
        value: typeof item[valueKey] === 'number' ? item[valueKey] : parseFloat(item[valueKey]) || 0
      }));
      
      const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      
      // Create an array of different bar chart types
      return [
        {
          id: `bar-chart-${Date.now()}`,
          type: 'bar',
          title: 'Bar Chart',
          section: 'Bar Charts',
          description: 'Standard bar chart visualization',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'bar',
            implementation: 'BarChart',
            showValues: true
          }
        },
        {
          id: `stacked-bar-${Date.now()}`,
          type: 'stackedBar',
          title: 'Stacked Bar Chart',
          section: 'Bar Charts',
          description: 'Stacked bar chart showing component breakdown',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'stackedBar',
            implementation: 'StackedBarChart',
            stacked: true
          }
        },
        {
          id: `horizontal-bar-${Date.now()}`,
          type: 'horizontalBar',
          title: 'Horizontal Bar Chart',
          section: 'Bar Charts',
          description: 'Horizontal bar chart for better readability of long labels',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'horizontalBar',
            implementation: 'HorizontalBarChart',
            horizontal: true
          }
        }
      ];
    } catch (error) {
      console.error('Error generating bar charts:', error);
      return [];
    }
  };

  // Function to generate line and area chart visualizations
  const generateLineCharts = (data: any[]): any[] => {
    if (!data || data.length === 0) return [];
    
    console.log('Generating line charts from data');
    
    try {
      // Extract categories and values from data
      const categoryKey = determineKeyOfType(data, 'string') || Object.keys(data[0])[0];
      const valueKey = determineKeyOfType(data, 'number') || Object.keys(data[0])[1];
      
      // Create normalized data for consistent use in charts
      const normalizedData = data.map(item => ({
        category: item[categoryKey] || 'Category',
        value: typeof item[valueKey] === 'number' ? item[valueKey] : parseFloat(item[valueKey]) || 0
      }));
      
      const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      
      // Create an array of different line chart types
      return [
        {
          id: `line-chart-${Date.now()}`,
          type: 'line',
          title: 'Line Chart',
          section: 'Line Charts',
          description: 'Standard line chart visualization',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'line',
            implementation: 'LineChart',
            smooth: true,
            showSymbol: true
          }
        },
        {
          id: `area-chart-${Date.now()}`,
          type: 'area',
          title: 'Area Chart',
          section: 'Line Charts',
          description: 'Area chart for displaying filled regions',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'area',
            implementation: 'AreaChart',
            smooth: true,
            fillOpacity: 0.7
          }
        }
      ];
    } catch (error) {
      console.error('Error generating line charts:', error);
      return [];
    }
  };

  // Function to generate pie and donut chart visualizations
  const generatePieCharts = (data: any[]): any[] => {
    if (!data || data.length === 0) return [];
    
    console.log('Generating pie charts from data');
    
    try {
      // Extract categories and values from data
      const categoryKey = determineKeyOfType(data, 'string') || Object.keys(data[0])[0];
      const valueKey = determineKeyOfType(data, 'number') || Object.keys(data[0])[1];
      
      // Create normalized data for consistent use in charts
      const normalizedData = data.map(item => ({
        category: item[categoryKey] || 'Category',
        value: typeof item[valueKey] === 'number' ? item[valueKey] : parseFloat(item[valueKey]) || 0
      }));
      
      const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      
      // Create an array of different pie chart types
      return [
        {
          id: `pie-chart-${Date.now()}`,
          type: 'pie',
          title: 'Pie Chart',
          section: 'Pie Charts',
          description: 'Standard pie chart visualization',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'pie',
            implementation: 'PieChart',
            useMultipleColors: true
          }
        },
        {
          id: `donut-chart-${Date.now()}`,
          type: 'donut',
          title: 'Donut Chart',
          section: 'Pie Charts',
          description: 'Donut chart visualization with center hole',
          data: normalizedData,
          xKey: 'category',
          yKey: 'value',
          options: {
            theme,
            forceChartType: 'donut',
            implementation: 'DonutChart',
            useMultipleColors: true,
            innerRadius: '50%'
          }
        }
      ];
    } catch (error) {
      console.error('Error generating pie charts:', error);
      return [];
    }
  };

  // Helper function to determine the key of a specific type in data
  const determineKeyOfType = (data: any[], type: 'string' | 'number'): string | undefined => {
    if (!data || !data[0]) return undefined;
    
    return Object.keys(data[0]).find(key => {
      if (type === 'string') {
        return typeof data[0][key] === 'string' || 
               key.toLowerCase().includes('name') || 
               key.toLowerCase().includes('category');
      } else if (type === 'number') {
        return typeof data[0][key] === 'number' || 
               !isNaN(parseFloat(data[0][key])) ||
               key.toLowerCase().includes('value') ||
               key.toLowerCase().includes('amount');
      }
      return false;
    });
  };

  // New function to organize visualizations by section
  const getVisualizationsBySection = () => {
    if (!localVisualizationsData || localVisualizationsData.length === 0) return {};
    
    // Group visualizations by section
    const sections: Record<string, any[]> = {};
    
    for (const viz of localVisualizationsData) {
      const section = viz.section || 'Other Charts';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(viz);
    }
    
    return sections;
  };

  // Visualization rendering function with specific chart implementation
  const renderVisualization = (vizConfig: any, height = 400) => {
    if (!vizConfig || !vizConfig.data || !Array.isArray(vizConfig.data) || vizConfig.data.length === 0) {
      console.warn("Invalid visualization config", { vizConfig });
      return (
        <div className="flex items-center justify-center h-full border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
          <p className="text-gray-500 dark:text-gray-400">No visualization data available</p>
        </div>
      );
    }
    
    console.log("Rendering visualization:", { 
      type: vizConfig.type, 
      implementation: vizConfig.options?.implementation || 'default',
      dataPoints: vizConfig.data.length
    });
    
    // Ensure the config has proper theme settings
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const config = {
      ...vizConfig,
      options: {
        ...(vizConfig.options || {}),
        theme
      }
    };
    
    return (
      <div className="chart-container relative" style={{ height }}>
        <Suspense fallback={<VisualizationLoader />}>
          <LazyVisualizationWrapper
            config={config}
            height={height}
            width="100%"
            theme={theme}
          />
        </Suspense>
      </div>
    );
  };

  // Render visualization slides section organized by chart types
  const renderVisualizationSlides = () => {
    console.log("Attempting to render visualization slides", {
      visualizationsAvailable: (localVisualizationsData?.length > 0),
      visualizationsCount: localVisualizationsData?.length || 0,
      currentSlide
    });
    
    if (!localVisualizationsData || localVisualizationsData.length === 0) {
      return null;
    }
    
    // Get current visualization
    const currentViz = localVisualizationsData[currentSlide];
    if (!currentViz) {
      console.warn(`Invalid slide index: ${currentSlide}`);
      return null;
    }
    
    // Get sections
    const sections = getVisualizationsBySection();
    const sectionNames = Object.keys(sections);
    const currentSection = currentViz.section || 'Other Charts';
    
    return (
      <div className="section mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center justify-between">
          <div className="flex items-center">
            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm">
              3
            </span>
            <span>Visualizations</span>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({currentSlide + 1} of {localVisualizationsData.length})
            </span>
          </div>
          
          {/* Navigation controls */}
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => navigateSlide('prev')}
              className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              aria-label="Previous visualization"
              disabled={localVisualizationsData.length <= 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              onClick={() => navigateSlide('next')}
              className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              aria-label="Next visualization"
              disabled={localVisualizationsData.length <= 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </h3>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 backdrop-blur-sm">
          {/* Section tabs */}
          {sectionNames.length > 1 && (
            <div className="mb-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex space-x-4">
                {sectionNames.map(section => (
                  <button
                    key={section}
                    className={`px-3 py-2 text-sm font-medium ${
                      section === currentSection
                        ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    onClick={() => {
                      // Find first visualization in this section
                      const sectionIndex = localVisualizationsData.findIndex(viz => 
                        (viz.section || 'Other Charts') === section
                      );
                      if (sectionIndex >= 0) {
                        setCurrentSlide(sectionIndex);
                      }
                    }}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Slide header */}
          <div className="mb-4">
            <h4 className="text-base font-medium text-gray-900 dark:text-gray-100">{currentViz.title || 'Data Visualization'}</h4>
            {currentViz.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{currentViz.description}</p>
            )}
          </div>
          
          {/* Visualization */}
          <div className="mb-4">
            {renderVisualization(currentViz)}
          </div>
          
          {/* Slide indicator dots */}
          {localVisualizationsData.length > 1 && (
            <div className="flex justify-center mt-4 space-x-2">
              {localVisualizationsData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => navigateSlide(index)}
                  className={`w-2 h-2 rounded-full ${
                    index === currentSlide 
                      ? 'bg-blue-600 dark:bg-blue-400' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
          
          {/* Data table toggle */}
          <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              onClick={() => setShowDataTable(!showDataTable)}
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              {showDataTable ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                    <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
                  </svg>
                  Hide Data Source
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                  View Data Source
                </>
              )}
            </button>
            
            {/* Data table */}
            {showDataTable && currentViz.data && Array.isArray(currentViz.data) && currentViz.data.length > 0 && (
              <div className="mt-3 overflow-x-auto text-xs">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {Object.keys(currentViz.data[0]).map((key: string) => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {currentViz.data.slice(0, 5).map((item: any, index: number) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/30'}>
                        {Object.keys(currentViz.data[0]).map((key: string) => (
                          <td key={`${index}-${key}`} className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {typeof item[key] === 'number' ? item[key].toLocaleString() : String(item[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {currentViz.data.length > 5 && (
                  <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400">
                    Showing 5 of {currentViz.data.length} rows
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Actions footer */}
          <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4 flex justify-end">
            <button
              onClick={() => {
                try {
                  // Set the current visualization as being added to dashboard
                  setAddingToDashboard(currentViz.id);
                  
                  // Create instance and call addToDashboard method
                  const dataProcessingService = DataProcessingService.getInstance();
                  
                  // Format visualization data for dashboard
                  const visualization = {
                    title: currentViz.title || 'Data Visualization',
                    type: currentViz.type || 'bar',
                    data: currentViz.data || [],
                    config: {
                      xAxis: currentViz.xKey,
                      yAxis: currentViz.yKey,
                      chartType: currentViz.type || 'bar',
                      ...(currentViz.options || {})
                    }
                  };
                  
                  // Add to dashboard
                  dataProcessingService.addToDashboard(visualization)
                    .then((success) => {
                      if (success) {
                        showNotification({
                          type: 'success',
                          message: 'Visualization added to dashboard!'
                        });
                      } else {
                        showNotification({
                          type: 'error',
                          message: 'Failed to add visualization to dashboard'
                        });
                      }
                      // Clear the adding state
                      setAddingToDashboard(null);
                    })
                    .catch((error) => {
                      console.error('Error adding to dashboard:', error);
                      showNotification({
                        type: 'error',
                        message: 'An error occurred while adding to dashboard'
                      });
                      // Clear the adding state on error
                      setAddingToDashboard(null);
                    });
                } catch (error) {
                  console.error('Error initiating add to dashboard:', error);
                  setAddingToDashboard(null);
                }
              }}
              disabled={addingToDashboard === currentViz.id}
              className="flex items-center text-xs px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-800/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingToDashboard === currentViz.id ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 mr-1">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  Add to Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Make sure the component returns JSX
  return (
    <StepContext.Provider value={contextValue}>
      <div className={`step-by-step-visualization ${expandedSteps.length === steps.length ? 'is-complete' : ''}`}>
        {/* No data message */}
        {initialSteps.length === 0 && !summary && !visualizationData && (!visualizationsData || visualizationsData.length === 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">No Data Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No relevant data was found for your query in the selected {normalizedDataSourceType || 'data source'}. 
                Please try a different query or select another data source.
              </p>
              <div className="flex flex-col space-y-3">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <strong>Troubleshooting tips:</strong>
                  <ul className="list-disc list-inside mt-1">
                    <li>Make sure your query is related to the content in the {normalizedDataSourceType || 'data source'}</li>
                    {normalizedDataSourceType === 'pdf' && (
                      <>
                        <li>Try using specific terms that appear in the PDF document</li>
                        <li>Ask about specific sections, pages, or topics in the document</li>
                      </>
                    )}
                    {normalizedDataSourceType === 'excel' && (
                      <>
                        <li>Try referring to specific columns or data categories in the spreadsheet</li>
                        <li>Ask for specific calculations or data summaries</li>
                      </>
                    )}
                    {normalizedDataSourceType === 'database' && (
                      <>
                        <li>Try using more specific database terminology in your query</li>
                        <li>Ask about specific tables, records, or fields</li>
                      </>
                    )}
                    {normalizedDataSourceType === 'qdrant' && (
                      <>
                        <li>Try using more specific semantic search terms</li>
                        <li>Ask about concepts rather than exact matches</li>
                      </>
                    )}
                    <li>Check if the data source was properly indexed</li>
                    <li>Verify that the data source type is correctly identified (current: {normalizedDataSourceType || 'unknown'})</li>
                  </ul>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Data source: {normalizedDataSourceType || 'unknown'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Summary section - always show if available */}
        {summary && (
          <div className="section mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center">
              <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm">
                1
              </span>
              Summary & Analysis
            </h3>
              <div className="bg-white dark:bg-gray-800/90 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 backdrop-blur-sm">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-800 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-200 text-gray-800 dark:text-gray-200 prose-headings:font-semibold prose-h2:text-lg prose-h3:text-base prose-h2:mt-6 prose-h2:mb-4 prose-h3:mt-4 prose-h3:mb-2 prose-hr:my-5 prose-hr:border-gray-200 dark:prose-hr:border-gray-700">
                <MessageMarkdown content={summary} />
              </div>
            </div>
              </div>
            )}
        
        {/* Insights section */}
        {insights && insights.length > 0 && (
          <div className="section mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center">
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm">
                {summary ? 2 : 1}
              </span>
              Key Insights
            </h3>
            <div className="bg-white dark:bg-gray-800/90 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 backdrop-blur-sm">
              <ul className="space-y-3">
                {insights.map((insight, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0">•</span>
                    <span className="text-gray-700 dark:text-gray-200">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {/* Recommendations section */}
        {recommendations && recommendations.length > 0 && (
          <div className="section mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100 flex items-center">
              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm">
                {(summary ? 1 : 0) + (insights.length > 0 ? 1 : 0) + 1}
              </span>
              Recommendations
            </h3>
            <div className="bg-white dark:bg-gray-800/90 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700/80 p-5 backdrop-blur-sm">
              <ul className="space-y-3">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-emerald-500 dark:text-emerald-400 mr-2 mt-0.5 flex-shrink-0">→</span>
                    <span className="text-gray-700 dark:text-gray-200">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {/* Visualization slides - new section */}
        {renderVisualizationSlides()}
        
        {/* Original steps section - keep for backward compatibility */}
        {steps && steps.length > 0 && (
          <div className="section">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">
              <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 w-7 h-7 rounded-full flex items-center justify-center mr-2 text-sm">
                {(summary ? 1 : 0) + 
                 (insights.length > 0 ? 1 : 0) + 
                 (recommendations.length > 0 ? 1 : 0) + 
                 1}
              </span>
              Analysis Steps
            </h3>
            <div className="steps-container">
              {steps.map((step) => (
                <div 
                  key={step.id} 
                  className={`step mb-4 ${expandedSteps.includes(step.id) ? 'step-expanded' : ''}`}
                >
                  <div 
                    className={`step-header p-3 ${getStepBgColor(step.type)} rounded-t-lg flex items-center justify-between cursor-pointer`}
                    onClick={() => toggleStepExpand(step.id)}
                  >
                    <div className="flex items-center">
                      <div className="step-icon mr-3 text-gray-700 dark:text-gray-200">
                        {getStepIcon(step.type)}
                      </div>
                      <div className="step-title font-medium text-gray-800 dark:text-gray-100">
                        {step.description || `Step ${step.order}: ${step.type.charAt(0).toUpperCase() + step.type.slice(1)}`}
                      </div>
                    </div>
                    <div className="expand-icon text-gray-600 dark:text-gray-300">
                      {expandedSteps.includes(step.id) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  {expandedSteps.includes(step.id) && (
                    <div className="step-content bg-white dark:bg-gray-800 p-4 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700">
                      {step.content && (
                        <div className="step-markdown mb-4">
                          <MessageMarkdown content={step.content} />
                        </div>
                      )}
                      
                      {step.metrics && step.metrics.length > 0 && (
                        <div className="step-metrics mb-4">
                          <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Key Metrics</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {step.metrics.map((metric, idx) => (
                              <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                <div className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</div>
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {step.visualization && (
                        <div className="step-visualization mb-4">
                          <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Visualization</h4>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-100 dark:border-gray-700">
                            <div style={{ height: '300px' }}>
                              <Suspense fallback={<div className="h-full flex items-center justify-center">Loading visualization...</div>}>
                                {renderVisualization(step.visualization.config, 300)}
                              </Suspense>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {step.insights && step.insights.length > 0 && (
                        <div className="step-insights mb-4">
                          <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Insights</h4>
                          <ul className="space-y-1">
                            {step.insights.map((insight, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="text-blue-500 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0">•</span>
                                <span className="text-sm text-gray-600 dark:text-gray-300">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {step.recommendations && step.recommendations.length > 0 && (
                        <div className="step-recommendations">
                          <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Recommendations</h4>
                          <ul className="space-y-1">
                            {step.recommendations.map((recommendation, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="text-emerald-500 dark:text-emerald-400 mr-2 mt-0.5 flex-shrink-0">→</span>
                                <span className="text-sm text-gray-600 dark:text-gray-300">{recommendation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StepContext.Provider>
  );
};

export function createSampleAnalysisSteps(): AnalyticalStep[] {
  return [
    {
      id: '1',
      type: 'info',
      description: 'First, I reviewed the \'Sales\' column to determine the total sales for each segment.',
      order: 1,
      content: 'I aggregated the data by segment to calculate total sales. This allowed me to understand the overall performance of each business segment and regional market.',
      insights: [
        'Consumer segment leads with 41% of total sales',
        'North America region accounts for 52% of all sales',
        'Q4 sales were 32% higher than Q3 across all segments'
      ],
      metrics: [
        {label: 'Total Sales', value: '$7.8M'},
        {label: 'Top Segment', value: 'Consumer'},
        {label: 'YoY Growth', value: '+12.3%'}
      ],
      data: [
        {segment: 'Consumer', sales: '$3,200,000', percentage: '41%', growth: '+15.3%'},
        {segment: 'Corporate', sales: '$2,700,000', percentage: '35%', growth: '+10.1%'},
        {segment: 'Small Business', sales: '$1,900,000', percentage: '24%', growth: '+8.7%'}
      ],
      visualization: {
        type: 'pie',
        config: {
          data: [
            {name: 'Consumer', value: 41},
            {name: 'Corporate', value: 35},
            {name: 'Small Business', value: 24}
          ],
          series: [
            {dataKey: 'value', name: 'Percentage'}
          ],
          labels: {
            title: 'Sales Distribution by Segment',
            xAxis: 'Segment',
            yAxis: 'Sales (%)'
          }
        }
      }
    }
  ];
} 

// Implement the missing helper functions
// Generate insights from data
const generateInsightsFromData = (data: any[], type?: string, xKey?: string, yKey?: string): string[] => {
  if (!data || data.length === 0) return [];
  
  const insights = [
    "Analysis of semantic vector data reveals conceptual relationships in your unstructured content.",
    "Consider exploring similar concepts and semantic proximity to identify content clusters.",
    "The highest value is 1.00 for Solid performing clients with good potential, representing 12.5% of the total."
  ];
  
  return insights;
};

// Generate domain-specific insights based on data type
const generateDomainSpecificInsights = (data: any[], dataSourceType: string): string[] => {
  if (!data || data.length === 0) return [];
  
  const insights = [
    "Vector database analysis shows semantic relationships between concepts in your data.",
    "Consider exploring content clusters to identify related topics and themes."
  ];
  
  return insights;
};

// Generate a summary from data
const generateSummaryFromData = (data: any[]): string => {
  if (!data || data.length === 0) return "No data available for analysis.";
  
  return "Analysis of the data shows distribution patterns worth exploring further.";
};

// Generate recommendations based on chart type
const generateRecommendations = (type?: string): string[] => {
  const recommendations = [
    "Consider segmenting this data to identify hidden correlation patterns.",
    "Explore year-over-year comparisons to identify growth trends."
  ];
  
  return recommendations;
}; 