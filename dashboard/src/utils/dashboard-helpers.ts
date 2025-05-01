/**
 * Dashboard Helper Utilities
 * Useful for debugging and managing the dashboard - Static Charts Edition
 */

/**
 * Initialize the dashboard with static charts
 * @returns boolean indicating success
 */
export function initializeDashboard(): boolean {
  if (typeof window === 'undefined') {
    console.error('Window not available');
    return false;
  }
  
  // Find the static charts toggle button
  const staticChartsToggle = document.querySelector('[data-static-charts-toggle]');
  if (!staticChartsToggle || !(staticChartsToggle instanceof HTMLButtonElement)) {
    console.error('Static charts toggle button not found');
    return false;
  }

  // Check if static charts are already showing 
  if (!staticChartsToggle.classList.contains('bg-indigo-100')) {
    console.log('Enabling static charts display');
    staticChartsToggle.click();
    return true;
  } else {
    console.log('Static charts already showing');
    return true;
  }
}

/**
 * Get debug information about the current dashboard state
 */
export function getDashboardDebugInfo(): object {
  if (typeof window === 'undefined' || !window.dashboardContext) {
    return { error: 'Dashboard context not available' };
  }
  
  const { currentDashboard, dashboards } = window.dashboardContext;
  
  return {
    hasDashboardContext: !!window.dashboardContext,
    totalDashboards: dashboards?.length || 0,
    currentDashboard: currentDashboard ? {
      id: currentDashboard.id,
      name: currentDashboard.name,
      widgetsCount: currentDashboard.widgets?.length || 0,
      metricsCount: currentDashboard.metrics?.length || 0,
      createdAt: currentDashboard.createdAt,
      updatedAt: currentDashboard.updatedAt
    } : null,
    useStaticCharts: !!document.querySelector('[data-static-charts-toggle].bg-indigo-100')
  };
}

/**
 * Reset the current dashboard to a clean state (removes all widgets and metrics)
 */
export function resetDashboard(): boolean {
  if (typeof window === 'undefined' || !window.dashboardContext) {
    console.error('Dashboard context not available');
    return false;
  }
  
  const { currentDashboard, updateWidgets, updateMetrics } = window.dashboardContext;
  
  if (!currentDashboard) {
    console.error('No active dashboard found');
    return false;
  }
  
  try {
    console.log('Resetting dashboard to clean state');
    updateWidgets([]);
    updateMetrics([]);
    
    // Show static charts after reset
    initializeDashboard();
    return true;
  } catch (error) {
    console.error('Error resetting dashboard:', error);
    return false;
  }
}

/**
 * Toggle the visibility of static chart mockups
 * @returns boolean indicating success
 */
export function toggleStaticCharts(): boolean {
  if (typeof window === 'undefined') {
    console.error('Window not available');
    return false;
  }
  
  // Find the static charts toggle button
  const staticChartsToggle = document.querySelector('[data-static-charts-toggle]');
  if (!staticChartsToggle || !(staticChartsToggle instanceof HTMLButtonElement)) {
    console.error('Static charts toggle button not found');
    return false;
  }

  console.log('Toggling static charts visibility');
  staticChartsToggle.click();
  return true;
}

// Expose functions to the window object for debugging purposes
if (typeof window !== 'undefined') {
  window.dashboardHelpers = {
    initializeDashboard,
    getDashboardDebugInfo,
    resetDashboard,
    toggleStaticCharts
  };
}

// Add to window type
declare global {
  interface Window {
    dashboardContext?: any;
    dashboardHelpers?: {
      initializeDashboard: typeof initializeDashboard;
      getDashboardDebugInfo: typeof getDashboardDebugInfo;
      resetDashboard: typeof resetDashboard;
      toggleStaticCharts: typeof toggleStaticCharts;
    };
  }
} 