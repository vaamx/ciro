/**
 * Dashboard and metrics type definitions
 */

/**
 * MetricCard represents a single metric displayed on the dashboard
 */
export interface MetricCard {
  id: string;
  title: string;
  value: number | string;
  // Common fields
  prefix?: string;
  suffix?: string;
  // Trend and change information
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  trend?: number;
  // Styling and formatting
  icon?: string;
  color?: string;
  timeframe?: string;
  // Additional metadata
  type?: string;
  unit?: string;
  formatter?: string;
  // Additional properties used in AddMetricModal
  period?: string;
  status?: 'positive' | 'negative' | 'neutral';
  // Chart data for visualizations
  chartData?: number[];
  // Query used to generate the metric data
  metricQuery?: string;
  // Data source information
  dataSourceId?: string;
}

/**
 * Dashboard represents the overall dashboard configuration
 */
export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: any[]; // We could define a more specific Widget type if needed
  metrics: MetricCard[];
  createdAt: string;
  updatedAt: string;
  // API specific fields
  organization_id: number;
  created_by?: number;
  createdBy?: number;
  team?: string;
  category?: string;
  isDefault?: boolean;
} 