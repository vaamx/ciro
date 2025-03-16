import React, { Suspense, lazy } from 'react';

// Lazy load visualization components
const LazyVisualization = lazy(() => 
  import('../../Visualization').then(module => ({ default: module.Visualization }))
);

const LazyInteractiveVisualization = lazy(() => 
  import('../../Visualization/InteractiveVisualization').then(module => ({ default: module.InteractiveVisualization }))
);

// Loading fallback component
const VisualizationLoader = () => (
  <div className="animate-pulse rounded-lg overflow-hidden">
    <div className="h-96 bg-gray-200 dark:bg-gray-700"></div>
    <div className="h-4 mt-3 bg-gray-200 dark:bg-gray-700 w-3/4 rounded"></div>
    <div className="h-3 mt-2 bg-gray-200 dark:bg-gray-700 w-1/2 rounded"></div>
  </div>
);

interface LazyVisualizationWrapperProps {
  config: any;
  height?: number;
  width?: string | number;
  interactive?: boolean;
  theme?: 'light' | 'dark';
  onDataPointClick?: (data: any) => void;
  enableDrillDown?: boolean;
}

/**
 * Wrapper component that lazy loads the appropriate visualization component
 */
export const LazyVisualizationWrapper: React.FC<LazyVisualizationWrapperProps> = ({
  config,
  height,
  width,
  interactive = false,
  theme = 'light',
  onDataPointClick,
  enableDrillDown
}) => {
  // Final force approach: Check URL for pie chart request
  const urlParams = new URLSearchParams(window.location.search);
  const queryString = window.location.search.toLowerCase();
  const forcePieChart = urlParams.get('pieChart') === 'true' || 
                       urlParams.get('chartType') === 'pie' || 
                       queryString.includes('pie+chart') ||
                       queryString.includes('piechart');
                       
  // Set final type with URL override, preserve flag, or original type
  let finalType = config?.type;
  
  if (forcePieChart) {
    finalType = 'pie';
  } else if (config?.options?.forceChartType) {
    finalType = config.options.forceChartType;
  } else if (config?.preserveType && config?.type) {
    finalType = config.type;
  }
  
  return (
    <Suspense fallback={<VisualizationLoader />}>
      {interactive ? (
        <LazyInteractiveVisualization
          config={{
            ...config,
            type: finalType
          }}
          height={height}
          width={width}
          theme={theme}
          onDataPointClick={onDataPointClick}
          enableDrillDown={enableDrillDown}
        />
      ) : (
        <LazyVisualization
          type={finalType}
          data={config.data || []}
          xKey={config.xKey}
          yKey={config.yKey}
          series={config.series}
          labels={config.labels}
          options={config.options}
          height={height}
          width={width}
          theme={theme}
        />
      )}
    </Suspense>
  );
}; 