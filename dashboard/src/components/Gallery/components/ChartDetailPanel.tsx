import React, { useState } from 'react';
import { X, Tag, Maximize2, Edit3, Code, BarChart2, Share2, LineChart, Download, Save, ArrowRight, Sliders, PaintBucket, Grid, Layers } from 'lucide-react';
import { ChartConfig } from '../data/chartConfigs';
import { ChartRenderer } from './ChartRenderer';
import { useTheme } from '../../../contexts/ThemeContext';

interface ChartDetailPanelProps {
  chart: ChartConfig | null;
  theme: string;
  onClose: () => void;
  onThemeChange: (theme: string) => void;
  onZoom: (chart: ChartConfig) => void;
  chartConfig?: any;
  onConfigChange?: (configKey: string, value: any) => void;
  onOpenInStudio?: (chart: ChartConfig) => void;
}

/**
 * Enhanced panel component that provides a preview of the selected chart
 * with options to customize, explore data, and view implementation code
 */
export const ChartDetailPanel: React.FC<ChartDetailPanelProps> = ({
  chart,
  theme,
  onClose,
  onThemeChange,
  onZoom,
  chartConfig,
  onConfigChange,
  onOpenInStudio
}) => {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'preview' | 'data' | 'code' | 'customize'>('preview');
  const [dataText, setDataText] = useState<string>('');
  
  if (!chart) return null;

  // Initialize the data text when chart changes
  React.useEffect(() => {
    if (chart && chart.sampleData) {
      setDataText(JSON.stringify(chart.sampleData, null, 2));
    }
  }, [chart]);

  // Theme selector component
  const renderThemeSelector = () => (
    <div className="flex-1 min-w-[200px]">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        Visualization Theme
      </label>
      <select
        value={theme}
        onChange={(e) => onThemeChange(e.target.value)}
        className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        This setting only affects this visualization
      </p>
    </div>
  );

  // Selected chart props
  const selectedChartProps = React.useMemo(() => {
    let props = chart.props(theme);
    
    // Add additional props for bridge chart to enable axis break
    if (chart.id === 'bridge-chart') {
      props = {
        ...props,
        breakAxis: true,
        onEvents: {
          breakAxis: () => {
            // Just trigger a redraw when the axis break state changes
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 50);
          }
        }
      };
    }
    
    return props;
  }, [chart, theme]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'preview':
        return (
          <div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-[400px] w-full chart-container relative">
              {selectedChartProps && (
                <ChartRenderer 
                  chartConfig={chart}
                  theme={theme} 
                  isPreview={false}
                  customProps={{
                    ...selectedChartProps,
                    height: '100%',
                    width: '100%'
                  }}
                  customConfig={chartConfig}
                />
              )}
              <button
                className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none z-10 focus:ring-2 focus:ring-blue-500 group"
                onClick={() => onZoom(chart)}
                title="Zoom chart"
                aria-label="Expand visualization"
              >
                <Maximize2 size={16} className="text-gray-700 dark:text-gray-300" />
                <span className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -mt-10 left-1/2 transform -translate-x-1/2 w-max">
                  Zoom chart
                </span>
              </button>
            </div>

            {chart.id === 'bridge-chart' && (
              <div className="mt-4 mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-700 dark:text-blue-300">
                <p>The axis is broken to highlight the significant difference between start and end values.</p>
                <p className="mt-1">Click on any break indicator to toggle the view.</p>
              </div>
            )}
          </div>
        );
      
      case 'data':
        return (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Sample Data</h3>
              <div className="flex space-x-2">
                <button className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                  <Download size={14} className="inline mr-1" />
                  Export
                </button>
                <button className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                  <Save size={14} className="inline mr-1" />
                  Save Changes
                </button>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 h-[350px] overflow-auto">
              <textarea 
                className="w-full h-full p-4 font-mono text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none"
                value={dataText}
                onChange={(e) => setDataText(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Edit the data above to see how it affects the visualization
              </p>
              <button 
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
                onClick={() => setActiveTab('preview')}
              >
                Update Preview
                <ArrowRight size={14} className="ml-1" />
              </button>
            </div>
          </div>
        );

      case 'code':
        return (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Implementation Code</h3>
              <div className="flex space-x-2">
                <button className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                  <Download size={14} className="inline mr-1" />
                  Copy Code
                </button>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 h-[350px] overflow-auto p-4">
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
{`import React from 'react';
import { ${chart.component.name} } from 'echarts/charts';

// Sample implementation for ${chart.name}
export const ${chart.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')} = (props) => {
  const chartOptions = {
    // Chart configuration
    ...${JSON.stringify(selectedChartProps, null, 2)}
  };

  return (
    <${chart.component.name} 
      options={chartOptions}
      style={{ height: '100%', width: '100%' }}
      {...props}
    />
  );
};`}
              </pre>
            </div>
            <div className="mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This is a simplified implementation. In Studio mode, you'll have access to the full code editor.
              </p>
            </div>
          </div>
        );

      case 'customize':
        return (
          <div className="space-y-5 p-1">
            {onConfigChange && (
              <>
                {/* Visual style controls */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                    <PaintBucket className="w-4 h-4 mr-2" />
                    Visual Style
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Color Palette
                      </label>
                      <select 
                        className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        onChange={(e) => onConfigChange('colorPalette', e.target.value)}
                        value={chartConfig?.colorPalette || "default"}
                      >
                        <option value="default">Default</option>
                        <option value="categorical">Categorical</option>
                        <option value="sequential">Sequential</option>
                        <option value="diverging">Diverging</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <input 
                          type="checkbox" 
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onChange={(e) => onConfigChange('showLegend', e.target.checked)}
                          checked={chartConfig?.showLegend !== false}
                        />
                        Show Legend
                      </label>
                    </div>
                  </div>
                </div>

                {/* Layout controls */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                    <Grid className="w-4 h-4 mr-2" />
                    Layout
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Chart Aspect Ratio
                      </label>
                      <select 
                        className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        onChange={(e) => onConfigChange('aspectRatio', e.target.value)}
                        value={chartConfig?.aspectRatio || "auto"}
                      >
                        <option value="auto">Auto</option>
                        <option value="square">Square (1:1)</option>
                        <option value="landscape">Landscape (4:3)</option>
                        <option value="wide">Wide (16:9)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Padding
                      </label>
                      <div className="flex items-center">
                        <input 
                          type="range" 
                          min="0" 
                          max="50" 
                          className="w-full h-2 rounded-full appearance-none bg-gray-300 dark:bg-gray-700"
                          onChange={(e) => onConfigChange('padding', parseInt(e.target.value))}
                          value={chartConfig?.padding || 20}
                        />
                        <span className="ml-3 w-10 text-sm text-gray-600 dark:text-gray-400">{chartConfig?.padding || 20}px</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data presentation controls */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                    <BarChart2 className="w-4 h-4 mr-2" />
                    Data Presentation
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <input 
                          type="checkbox" 
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onChange={(e) => onConfigChange('showValues', e.target.checked)}
                          checked={chartConfig?.showValues === true}
                        />
                        Show Data Values
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <input 
                          type="checkbox" 
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onChange={(e) => onConfigChange('showGridlines', e.target.checked)}
                          checked={chartConfig?.showGridlines !== false}
                        />
                        Show Gridlines
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Animation Speed
                      </label>
                      <select 
                        className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        onChange={(e) => onConfigChange('animationSpeed', e.target.value)}
                        value={chartConfig?.animationSpeed || "medium"}
                      >
                        <option value="none">No Animation</option>
                        <option value="slow">Slow</option>
                        <option value="medium">Medium</option>
                        <option value="fast">Fast</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Advanced settings button */}
                <div className="pt-2">
                  <button className="flex items-center justify-center w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <Layers className="w-4 h-4 mr-2" />
                    Advanced Settings
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                  <button 
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      // Reset to defaults
                      if (onConfigChange) {
                        onConfigChange('reset', true);
                      }
                    }}
                  >
                    Reset to Defaults
                  </button>
                  <button 
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
                    onClick={() => setActiveTab('preview')}
                  >
                    Apply Changes
                    <ArrowRight size={14} className="ml-1" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-30 overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-3/5 lg:w-1/2 2xl:w-2/5 bg-white dark:bg-gray-800 overflow-y-auto shadow-xl transform transition-transform duration-300 ease-in-out details-panel">
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={onClose}
              className="mr-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{chart.name}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              className="py-1.5 px-3 bg-blue-600 text-white rounded flex items-center hover:bg-blue-700 transition-colors"
              onClick={() => onOpenInStudio?.(chart)}
            >
              <Edit3 className="w-4 h-4 mr-1.5" />
              Open in Studio
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">
              {chart.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {chart.description}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-6">
            {renderThemeSelector()}
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                View
              </label>
              <div className="grid grid-cols-1 gap-2">
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs text-blue-700 dark:text-blue-300">
                  <p>You're currently in <strong>Gallery View</strong>, which allows you to explore and customize this visualization with sample data.</p>
                  <p className="mt-1">Use <strong>Open in Studio</strong> to work with real data and advanced features.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Tabs for different views */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex space-x-4">
              <button
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === 'preview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('preview')}
              >
                <BarChart2 className="w-4 h-4 inline mr-1" />
                Preview
              </button>
              <button
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === 'customize'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('customize')}
              >
                <Sliders className="w-4 h-4 inline mr-1" />
                Customize
              </button>
              <button
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === 'data'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('data')}
              >
                <LineChart className="w-4 h-4 inline mr-1" />
                Data
              </button>
              <button
                className={`py-2 px-1 border-b-2 text-sm font-medium ${
                  activeTab === 'code'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab('code')}
              >
                <Code className="w-4 h-4 inline mr-1" />
                Code
              </button>
            </div>
          </div>
          
          {/* Tab content */}
          {renderTabContent()}
          
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {chart.tags.map((tag: string) => (
                <span 
                  key={tag} 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                >
                  <Tag className="w-3.5 h-3.5 mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Implementation Notes</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              This chart is part of our Apache ECharts integration. ECharts provides better performance, 
              more customization options, and a wider range of chart types than previous libraries.
            </p>
            {theme !== (isDarkMode ? 'dark' : 'light') && (
              <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> This visualization is using a different theme than your system theme.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between mt-8">
            <button className="py-2 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
              <Share2 className="w-4 h-4 mr-1.5" />
              Share Template
            </button>
            <button 
              className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
              onClick={() => onOpenInStudio?.(chart)}
            >
              Open in Studio
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 