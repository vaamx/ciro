import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { ChartConfig } from '../data/chartConfigs';
import { ChartRenderer } from './ChartRenderer';
import { useTheme } from '../../../contexts/ThemeContext';

interface ZoomModalProps {
  chart: ChartConfig | null;
  theme: string;
  onClose: () => void;
  chartConfig?: any;
}

/**
 * Modal component for viewing charts in an enlarged format
 */
export const ZoomModal: React.FC<ZoomModalProps> = ({ chart, theme, onClose, chartConfig }) => {
  const { isDarkMode } = useTheme();
  const systemTheme = isDarkMode ? 'dark' : 'light';
  
  if (!chart) return null;

  const getZoomedChartProps = () => {
    if (chart.id === 'bridge-chart') {
      return {
        ...chart.props(theme),
        breakAxis: true,
        onEvents: {
          breakAxis: () => {
            // Just trigger a redraw when the axis break state changes
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 50);
          }
        },
        height: '100%',
        width: '100%',
        fontSize: Math.max(18, chart.props(theme).fontSize || 18),
        markerSize: Math.max(10, chart.props(theme).markerSize || 10)
      };
    } else if (chart.id === 'waterfall-chart') {
      // Custom handling for waterfall chart modal
      return {
        ...chart.props(theme),
        height: '100%',
        width: '100%',
        lineWidth: 8, // Even thicker lines in zoomed view
        markerSize: 2, // Very small dots
        fontSize: Math.max(15, chart.props(theme).fontSize || 15),
        options: {
          grid: {
            top: 80,
            right: 40,
            bottom: 60,
            left: 40
          },
          xAxis: {
            axisLabel: {
              interval: 0,
              rotate: 30,
              fontSize: 12
            }
          }
        }
      };
    } else if (chart.id === 'horizontal-bar') {
      return {
        ...chart.props(theme),
        height: '100%',
        width: '100%',
        options: {
          ...chart.props(theme).options,
          grid: {
            top: 60,
            right: 60,
            bottom: 20,
            left: 120
          }
        }
      };
    } else {
      const origProps = chart.props(theme);
      return {
        ...origProps,
        height: '100%',
        width: '100%',
        fontSize: Math.max(18, origProps.fontSize || 18),
        markerSize: Math.max(10, origProps.markerSize || 10),
        options: {
          ...origProps.options,
          grid: {
            ...origProps.options?.grid,
            top: 40,
            right: 20,
            bottom: 0,
            left: 20
          }
        }
      };
    }
  };

  const zoomedChartProps = getZoomedChartProps();
  const themeMismatch = theme !== systemTheme;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full md:w-2/3 lg:w-3/5 max-w-4xl max-h-[700px] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50">
              {chart.name}
            </h3>
            {themeMismatch && (
              <div className="ml-3 flex items-center text-amber-600 dark:text-amber-400">
                <AlertCircle size={16} className="mr-1" />
                <span className="text-xs">Using {theme} theme</span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 h-[400px]">
          <ChartRenderer 
            chartConfig={chart}
            theme={theme}
            isPreview={false}
            customProps={zoomedChartProps}
            customConfig={chartConfig}
          />
        </div>
        
        {chart.id === 'bridge-chart' && (
          <div className="px-5 pb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-700 dark:text-blue-300">
              <p>The axis is broken to highlight the significant difference between start and end values.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 