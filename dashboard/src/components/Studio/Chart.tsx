import React, { useState, useEffect } from 'react';
import { BarChart2, PieChart, TrendingUp, Table, Code, Settings as SettingsIcon, X, Download, Copy, Play } from 'lucide-react';
import { ChartRenderer } from '../Gallery/components/ChartRenderer';
import { allCharts } from '../Gallery/data/chartConfigs';

// Tab data types
type TabType = 'chart' | 'sql' | 'data' | 'settings';

// Chart types supported
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'table' | 'card';

// Chart component props
export interface ChartProps {
  title: string;
  description?: string;
  type: ChartType;
  data: any[] | null;
  sql?: string;
  onSqlChange?: (sql: string) => void;
  onQueryRun?: () => void;
  columns?: { name: string; type: string }[];
  options?: Record<string, any>;
  isLoading?: boolean;
  error?: string | null;
  height?: string | number;
  width?: string | number;
  className?: string;
  onDelete?: () => void;
  onResize?: () => void;
  onChangeType?: (newType: string) => void;
  onMove?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  availableChartTypes?: Array<{id: string, name: string, icon: string}>;
  dataSourceName?: string;
  theme?: 'light' | 'dark';
  onSettingsChange?: (settings: Record<string, any>) => void;
}

/**
 * Rich Chart component that includes visualization, SQL editor, data explorer, and settings
 */
export const Chart: React.FC<ChartProps> = ({
  title,
  type,
  data,
  sql = '',
  onSqlChange,
  onQueryRun,
  options = {},
  isLoading = false,
  error = null,
  height = '100%',
  width = '100%',
  className = '',
  onDelete,
  onResize,
  onChangeType,
  onMove,
  availableChartTypes,
  dataSourceName,
  theme = 'light',
  onSettingsChange
}) => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<TabType>('chart');
  
  // Chart settings state
  const [chartSettings, setChartSettings] = useState<Record<string, any>>({
    showLegend: true,
    showTitle: true,
    showTooltip: true,
    showGrid: true,
    colors: undefined,
    ...options
  });
  
  // SQL editor state
  const [sqlQuery, setSqlQuery] = useState(sql);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Update SQL state when prop changes
  useEffect(() => {
    setSqlQuery(sql);
    setHasChanges(false);
  }, [sql]);
  
  // Update settings when props change
  useEffect(() => {
    setChartSettings(prev => ({
      ...prev,
      ...options
    }));
  }, [options]);
  
  // Handle SQL change
  const handleSqlChange = (newSql: string) => {
    setSqlQuery(newSql);
    setHasChanges(newSql !== sql);
  };
  
  // Run query
  const handleRunQuery = () => {
    if (onSqlChange) {
      onSqlChange(sqlQuery);
    }
    if (onQueryRun) {
      onQueryRun();
    }
    setHasChanges(false);
  };
  
  // Handle settings change
  const handleSettingsChange = (key: string, value: any) => {
    const updatedSettings = {
      ...chartSettings,
      [key]: value
    };
    
    setChartSettings(updatedSettings);
    
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };
  
  // Get chart icon based on type
  const getChartIcon = () => {
    switch (type) {
      case 'bar':
        return <BarChart2 className="w-4 h-4" />;
      case 'pie':
        return <PieChart className="w-4 h-4" />;
      case 'line':
      case 'area':
        return <TrendingUp className="w-4 h-4" />;
      case 'table':
        return <Table className="w-4 h-4" />;
      default:
        return <BarChart2 className="w-4 h-4" />;
    }
  };
  
  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chart':
        return renderChartView();
      case 'sql':
        return renderSqlEditor();
      case 'data':
        return renderDataExplorer();
      case 'settings':
        return renderSettings();
      default:
        return renderChartView();
    }
  };
  
  // Render the chart visualization
  const renderChartView = () => {
    if (isLoading) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-red-500">
            <X className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </div>
      );
    }
    
    if (!data || data.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="mb-2">No data available</p>
            <button
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setActiveTab('sql')}
            >
              Edit Query
            </button>
          </div>
        </div>
      );
    }
    
    // Find the chart config for the type
    const chartConfig = allCharts.find(chart => chart.id === type) || allCharts[0];
    
    // Apply settings to chart props
    const chartProps = {
      ...chartConfig.props(theme),
      data,
      height: '100%', 
      width: '100%',
      ...chartSettings,
      animation: true,
      responsive: true,
    };
    
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="w-full h-full flex-1" style={{ minHeight: '200px' }}>
          <ChartRenderer 
            chartConfig={chartConfig}
            theme={theme}
            customProps={chartProps}
          />
        </div>
      </div>
    );
  };
  
  // Render SQL editor
  const renderSqlEditor = () => {
    return (
      <div className="h-full flex flex-col p-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {dataSourceName && (
              <span className="mr-2">Data Source: {dataSourceName}</span>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => {
                navigator.clipboard.writeText(sqlQuery);
              }}
              title="Copy SQL"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <textarea
            className="w-full h-full p-3 bg-transparent resize-none focus:outline-none font-mono text-sm text-gray-800 dark:text-gray-200"
            value={sqlQuery}
            onChange={(e) => handleSqlChange(e.target.value)}
            placeholder="Enter SQL query..."
            spellCheck={false}
          />
        </div>
        
        <div className="mt-2 flex justify-between items-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {hasChanges && "Unsaved changes"}
          </div>
          <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded flex items-center hover:bg-blue-700 disabled:opacity-50"
            onClick={handleRunQuery}
            disabled={!hasChanges || isLoading}
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Run Query
          </button>
        </div>
      </div>
    );
  };
  
  // Render data explorer
  const renderDataExplorer = () => {
    return (
      <div className="h-full flex flex-col p-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Data Preview</div>
          <button
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            onClick={() => {
              // Export data as CSV
              if (!data || data.length === 0) return;
              
              const headers = Object.keys(data[0]);
              const csvContent = [
                headers.join(','),
                ...data.map(row => 
                  headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' && value.includes(',') 
                      ? `"${value}"` 
                      : value;
                  }).join(',')
                )
              ].join('\n');
              
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `${title.replace(/\s+/g, '_')}_data.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            title="Download CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded">
          {data && data.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {Object.keys(data[0]).map((column, i) => (
                    <th 
                      key={i}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {data.slice(0, 100).map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {Object.values(row).map((cell, cellIndex) => (
                      <td 
                        key={cellIndex}
                        className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                      >
                        {cell === null ? 'NULL' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available
            </div>
          )}
        </div>
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {data ? `${data.length} rows` : 'No data'}
          {data && data.length > 100 && ' (showing first 100)'}
        </div>
      </div>
    );
  };
  
  // Render settings
  const renderSettings = () => {
    return (
      <div className="p-3 h-full overflow-y-auto">
        <h3 className="font-medium mb-4">Chart Settings</h3>
        
        {/* Chart Type Selection */}
        {availableChartTypes && onChangeType && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Chart Type</h4>
            <div className="grid grid-cols-3 gap-2">
              {availableChartTypes.map(chartType => (
                <button
                  key={chartType.id}
                  className={`p-2 rounded text-sm flex flex-col items-center ${
                    type === chartType.id 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-700' 
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => onChangeType(chartType.id)}
                >
                  <div className="mb-1">
                    {chartType.icon === 'bar-chart' && <BarChart2 className="w-5 h-5" />}
                    {chartType.icon === 'line-chart' && <TrendingUp className="w-5 h-5" />}
                    {chartType.icon === 'pie-chart' && <PieChart className="w-5 h-5" />}
                    {chartType.icon === 'table' && <Table className="w-5 h-5" />}
                  </div>
                  <span>{chartType.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Chart Position Controls */}
        {onMove && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Chart Position</h4>
            <div className="grid grid-cols-3 gap-2 max-w-[150px] mx-auto">
              <div></div>
              <button
                className="p-2 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() => onMove('up')}
                title="Move Up"
              >
                <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
              <div></div>
              
              <button
                className="p-2 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() => onMove('left')}
                title="Move Left"
              >
                <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 bg-blue-500 rounded-full"></div>
              </div>
              
              <button
                className="p-2 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() => onMove('right')}
                title="Move Right"
              >
                <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              
              <div></div>
              <button
                className="p-2 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() => onMove('down')}
                title="Move Down"
              >
                <svg className="w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </button>
              <div></div>
            </div>
          </div>
        )}
        
        {/* Display options */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">Display</h4>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                id="chart-show-title-input"
                type="checkbox"
                className="rounded text-blue-600 mr-2"
                checked={chartSettings.showTitle}
                onChange={(e) => handleSettingsChange('showTitle', e.target.checked)}
              />
              <label htmlFor="chart-show-title-input" className="text-sm cursor-pointer">Show Title</label>
            </div>
            
            <div className="flex items-center">
              <input
                id="chart-show-legend-input"
                type="checkbox"
                className="rounded text-blue-600 mr-2"
                checked={chartSettings.showLegend}
                onChange={(e) => handleSettingsChange('showLegend', e.target.checked)}
              />
              <label htmlFor="chart-show-legend-input" className="text-sm cursor-pointer">Show Legend</label>
            </div>
            
            <div className="flex items-center">
              <input
                id="chart-show-tooltip-input"
                type="checkbox"
                className="rounded text-blue-600 mr-2"
                checked={chartSettings.showTooltip}
                onChange={(e) => handleSettingsChange('showTooltip', e.target.checked)}
              />
              <label htmlFor="chart-show-tooltip-input" className="text-sm cursor-pointer">Show Tooltip</label>
            </div>
            
            <div className="flex items-center">
              <input
                id="chart-show-grid-input"
                type="checkbox"
                className="rounded text-blue-600 mr-2"
                checked={chartSettings.showGrid}
                onChange={(e) => handleSettingsChange('showGrid', e.target.checked)}
              />
              <label htmlFor="chart-show-grid-input" className="text-sm cursor-pointer">Show Grid</label>
            </div>
          </div>
        </div>
        
        {/* Color scheme */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">Color Scheme</h4>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['default', 'Default'],
              ['blue', 'Blue'],
              ['green', 'Green'],
              ['red', 'Red'],
              ['purple', 'Purple'],
              ['orange', 'Orange'],
              ['pastel', 'Pastel'],
              ['monochrome', 'Monochrome']
            ].map(([value, label]) => (
              <button
                key={value}
                className={`p-1 text-xs rounded border ${
                  chartSettings.colorScheme === value 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => handleSettingsChange('colorScheme', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Advanced settings based on chart type */}
        {(type === 'bar' || type === 'line' || type === 'area') && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Axis Settings</h4>
            <div className="space-y-2">
              <div className="block">
                <label htmlFor="chart-x-axis-label-input" className="text-sm">X-Axis Label</label>
                <input
                  id="chart-x-axis-label-input"
                  type="text"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                  value={chartSettings.xAxisLabel || ''}
                  onChange={(e) => handleSettingsChange('xAxisLabel', e.target.value)}
                  placeholder="X Axis"
                />
              </div>
              <div className="block">
                <label htmlFor="chart-y-axis-label-input" className="text-sm">Y-Axis Label</label>
                <input
                  id="chart-y-axis-label-input"
                  type="text"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                  value={chartSettings.yAxisLabel || ''}
                  onChange={(e) => handleSettingsChange('yAxisLabel', e.target.value)}
                  placeholder="Y Axis"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div 
      className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 ${className}`}
      style={{ 
        height: height || '100%', 
        width: width || '100%',
        transition: 'height 0.3s ease-in-out, width 0.3s ease-in-out'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {getChartIcon()}
          <h3 className="font-medium text-gray-800 dark:text-gray-200">{title}</h3>
          {dataSourceName && (
            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
              {dataSourceName}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {onResize && (
            <button 
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={onResize}
              title="Resize chart"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          )}
          
          {onDelete && (
            <button 
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={onDelete}
              title="Delete chart"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="px-2 pt-2 border-b border-gray-200 dark:border-gray-700 flex space-x-1">
        <button
          className={`px-3 py-1.5 text-xs rounded-t ${
            activeTab === 'chart'
              ? 'bg-white dark:bg-gray-900 border-t border-l border-r border-gray-200 dark:border-gray-700 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={() => setActiveTab('chart')}
        >
          Chart
        </button>
        <button
          className={`px-3 py-1.5 text-xs rounded-t flex items-center ${
            activeTab === 'sql'
              ? 'bg-white dark:bg-gray-900 border-t border-l border-r border-gray-200 dark:border-gray-700 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={() => setActiveTab('sql')}
        >
          <Code className="w-3 h-3 mr-1" />
          SQL
        </button>
        <button
          className={`px-3 py-1.5 text-xs rounded-t flex items-center ${
            activeTab === 'data'
              ? 'bg-white dark:bg-gray-900 border-t border-l border-r border-gray-200 dark:border-gray-700 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={() => setActiveTab('data')}
        >
          <Table className="w-3 h-3 mr-1" />
          Data
        </button>
        <button
          className={`px-3 py-1.5 text-xs rounded-t flex items-center ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-gray-900 border-t border-l border-r border-gray-200 dark:border-gray-700 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon className="w-3 h-3 mr-1" />
          Settings
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Chart; 