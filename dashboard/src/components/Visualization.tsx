import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface VisualizationProps {
  type: string;
  config: any;
  className?: string;
}

const defaultOptions: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
};

export const Visualization: React.FC<VisualizationProps> = ({
  type,
  config,
  className = 'h-64'
}) => {
  // Handle table visualization
  if (type === 'table') {
    return (
      <div className={`overflow-x-auto ${className}`}>
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
              <tr key={rowIndex}>
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
      </div>
    );
  }

  // Handle line chart
  if (type === 'line') {
    return (
      <div className={className}>
        <Line
          options={defaultOptions}
          data={config.data as ChartData<'line'>}
        />
      </div>
    );
  }

  // Handle bar chart
  if (type === 'bar') {
    return (
      <div className={className}>
        <Bar
          options={defaultOptions}
          data={config.data as ChartData<'bar'>}
        />
      </div>
    );
  }

  // Default fallback
  return (
    <div className={`${className} flex items-center justify-center text-gray-500 dark:text-gray-400`}>
      Unsupported visualization type: {type}
    </div>
  );
}; 