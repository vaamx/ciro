import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line, Bar, Pie, Radar, Scatter } from 'react-chartjs-2';
import { motion } from 'framer-motion';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
);

interface VisualizationProps {
  type: string;
  config: any;
  className?: string;
}

const defaultChartOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        padding: 20,
        font: {
          family: 'Inter, system-ui, sans-serif',
          size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      titleFont: {
        family: 'Inter, system-ui, sans-serif',
        size: 14,
        weight: 600
      },
      bodyFont: {
        family: 'Inter, system-ui, sans-serif',
        size: 12
      },
      cornerRadius: 4,
      displayColors: true
    }
  },
  animation: {
    duration: 750,
    easing: 'easeInOutQuart'
  }
};

export const Visualization: React.FC<VisualizationProps> = ({
  type,
  config,
  className = 'h-64'
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...config.options
  };

  // Handle table visualization
  if (type === 'table') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`overflow-x-auto ${className}`}
      >
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            {config.headers && (
              <tr>
                {config.headers.map((header: string, index: number) => (
                  <th
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {config.data.map((row: any[], rowIndex: number) => (
              <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                {row.map((cell: any, cellIndex: number) => (
                  <td
                    key={cellIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    );
  }

  // Handle line chart
  if (type === 'line') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Line
          options={chartOptions}
          data={config.data}
        />
      </motion.div>
    );
  }

  // Handle bar chart
  if (type === 'bar') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Bar
          options={chartOptions}
          data={config.data}
        />
      </motion.div>
    );
  }

  // Handle pie chart
  if (type === 'pie') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Pie
          options={chartOptions}
          data={config.data}
        />
      </motion.div>
    );
  }

  // Handle radar chart
  if (type === 'radar') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Radar
          options={chartOptions}
          data={config.data}
        />
      </motion.div>
    );
  }

  // Handle scatter plot
  if (type === 'scatter') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Scatter
          options={chartOptions}
          data={config.data}
        />
      </motion.div>
    );
  }

  // Handle heatmap (using custom implementation)
  if (type === 'heatmap') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`${className} grid gap-1`}
        style={{
          gridTemplateColumns: `repeat(${config.data[0].length}, minmax(0, 1fr))`
        }}
      >
        {config.data.map((row: number[], rowIndex: number) =>
          row.map((value: number, colIndex: number) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="aspect-square rounded"
              style={{
                backgroundColor: `rgba(147, 51, 234, ${value})`,
                transition: 'background-color 0.3s ease'
              }}
              title={`Value: ${value}`}
            />
          ))
        )}
      </motion.div>
    );
  }

  // Default fallback
  return (
    <div className={`${className} flex items-center justify-center text-gray-500 dark:text-gray-400`}>
      Unsupported visualization type: {type}
    </div>
  );
}; 