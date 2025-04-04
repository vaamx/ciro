/**
 * Visualization Service
 * 
 * This service provides debugging tools for static UI chart components
 * that don't require actual data or API calls.
 * 
 * For visualizations, use these components directly:
 * - StaticChartWidget
 * - StaticLineChartWidget 
 * - StaticPieChartWidget
 */

/**
 * Add debug/troubleshooting functions to the window object
 * to help diagnose visualization rendering issues
 */
export function initializeVisualizationDebugTools() {
  if (typeof window === 'undefined') return;
  
  // Create a namespace for visualization debug tools
  (window as any).visualizationDebug = {
    // Toggle static chart visibility
    toggleStaticCharts: () => {
      try {
        // Find the EnhancedOverview component's state
        const staticChartsToggle = document.querySelector('[data-static-charts-toggle]');
        if (staticChartsToggle && staticChartsToggle instanceof HTMLButtonElement) {
          staticChartsToggle.click();
          return true;
        } else {
          console.warn('Static charts toggle button not found');
          return false;
        }
      } catch (error) {
        console.error('Failed to toggle static charts:', error);
        return false;
      }
    },
    
    // Print dashboard state info
    dashboardInfo: () => {
      if (!window.dashboardContext) {
        console.error('Dashboard context not available');
        return { available: false };
      }
      
      try {
        const { currentDashboard } = window.dashboardContext;
        
        console.group('Dashboard Information');
        console.log('Dashboard:', currentDashboard);
        console.log('Widgets Count:', currentDashboard?.widgets?.length || 0);
        console.log('Metrics Count:', currentDashboard?.metrics?.length || 0);
        console.groupEnd();
        
        return {
          available: true,
          dashboardId: currentDashboard?.id,
          widgetsCount: currentDashboard?.widgets?.length || 0,
          metricsCount: currentDashboard?.metrics?.length || 0
        };
      } catch (error) {
        console.error('Error retrieving dashboard info:', error);
        return { available: false, error: String(error) };
      }
    }
  };
  
  console.log('Visualization debug tools initialized. Use window.visualizationDebug to access them.');
}

// Initialize the debug tools
if (typeof window !== 'undefined') {
  // Small delay to ensure dashboard context is loaded
  setTimeout(() => {
    initializeVisualizationDebugTools();
  }, 1000);
} 