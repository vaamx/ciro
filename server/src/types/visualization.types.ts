export enum VisualizationType {
  TABLE = 'table',
  BAR_CHART = 'bar_chart',
  LINE_CHART = 'line_chart',
  PIE_CHART = 'pie_chart',
  SCATTER_PLOT = 'scatter_plot',
  // Add other types as needed
}

export interface VisualizationConfig {
  visualizationType: VisualizationType;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  // Add other configuration options specific to different chart types
} 