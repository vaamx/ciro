/**
 * Visualization Components and Utilities
 * Exports all visualization-related components and utility functions for easier imports.
 */

// Export the VisualizationRenderer component
export { VisualizationRenderer, VisualizationLoader } from './VisualizationRenderer';

// Export utility functions
export {
  validateVisualizationType,
  mapChartType,
  generateMetricsFromData,
  generateInsightsFromData,
  generateDomainSpecificInsights,
  generateSummaryFromData,
  generateRecommendations
} from './utils';

// Export our modular components
export { EnhancedVisualization } from './EnhancedVisualization';
export { ModernVisualizationAdapter } from './ModernVisualizationAdapter'; 