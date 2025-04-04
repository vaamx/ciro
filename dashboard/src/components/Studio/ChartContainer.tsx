import React, { useState } from 'react';
import { Chart, ChartType } from './Chart';

export interface ChartContainerProps {
  id: string;
  title: string;
  type: ChartType;
  data: any[] | null;
  sql?: string;
  dataSourceId?: string;
  dataSourceName?: string;
  isLoading?: boolean;
  error?: string | null;
  onDelete?: () => void;
  onResize?: () => void;
  onSqlChange?: (sql: string) => void;
  onQueryRun?: () => void;
  onChangeType?: (newType: string) => void;
  onMove?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  availableChartTypes?: Array<{id: string, name: string, icon: string}>;
  className?: string;
  theme?: 'light' | 'dark';
}

/**
 * Container component for a Chart that manages state and interactions
 */
export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  type,
  data,
  sql = '',
  dataSourceName,
  isLoading = false,
  error = null,
  onDelete,
  onResize,
  onSqlChange,
  onQueryRun,
  onChangeType,
  onMove,
  availableChartTypes,
  className = '',
  theme = 'light'
}) => {
  // State for chart options
  const [chartOptions, setChartOptions] = useState<Record<string, any>>({
    showLegend: true,
    showTitle: true,
    showTooltip: true,
    showGrid: true,
    colorScheme: 'default'
  });
  
  // Handle options change
  const handleOptionsChange = (newOptions: Record<string, any>) => {
    // Check if type was changed
    if (newOptions.type && newOptions.type !== type) {
      // Call external handlers if needed
    }
    
    setChartOptions(prev => ({
      ...prev,
      ...newOptions
    }));
  };
  
  return (
    <Chart
      title={title}
      type={type}
      data={data}
      sql={sql}
      options={chartOptions}
      isLoading={isLoading}
      error={error}
      onDelete={onDelete}
      onResize={onResize}
      onSqlChange={onSqlChange}
      onQueryRun={onQueryRun}
      dataSourceName={dataSourceName}
      onSettingsChange={handleOptionsChange}
      onChangeType={onChangeType}
      onMove={onMove}
      availableChartTypes={availableChartTypes}
      className={className}
      theme={theme}
    />
  );
};

export default ChartContainer; 