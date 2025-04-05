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

// More vibrant color palette for charts
const vibrantColors = [
  'rgba(255, 99, 132, 0.7)',   // Bright pink
  'rgba(54, 162, 235, 0.7)',   // Bright blue
  'rgba(255, 206, 86, 0.7)',   // Bright yellow
  'rgba(75, 192, 192, 0.7)',   // Teal
  'rgba(153, 102, 255, 0.7)',  // Purple
  'rgba(255, 159, 64, 0.7)',   // Orange
  'rgba(46, 204, 113, 0.7)',   // Green
  'rgba(142, 68, 173, 0.7)',   // Dark purple
  'rgba(241, 196, 15, 0.7)',   // Gold
  'rgba(231, 76, 60, 0.7)'     // Red
];

// Border colors (darker versions of the fill colors)
const vibrantBorderColors = [
  'rgba(255, 99, 132, 1)',
  'rgba(54, 162, 235, 1)',
  'rgba(255, 206, 86, 1)',
  'rgba(75, 192, 192, 1)',
  'rgba(153, 102, 255, 1)',
  'rgba(255, 159, 64, 1)',
  'rgba(46, 204, 113, 1)',
  'rgba(142, 68, 173, 1)',
  'rgba(241, 196, 15, 1)',
  'rgba(231, 76, 60, 1)'
];

export const Visualization: React.FC<VisualizationProps> = ({
  type,
  config,
  className = 'h-64'
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...(config.options || {})
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
    // Format the data correctly for Chart.js
    const labels = config.data.map((item: any) => item[config.xKey || Object.keys(item)[0]]);
    
    // Determine what data series to display
    let datasets = [];
    if (config.series && Array.isArray(config.series) && config.series.length > 0) {
      // Use series configuration
      datasets = config.series.map((serie: any, index: number) => ({
        label: serie.name || serie.dataKey,
        data: config.data.map((item: any) => item[serie.dataKey]),
        borderColor: serie.color || vibrantBorderColors[index % vibrantBorderColors.length],
        backgroundColor: serie.color || vibrantColors[index % vibrantColors.length],
        tension: 0.1
      }));
    } else {
      // Create single series using yKey
      const yKey = config.yKey || Object.keys(config.data[0])[1];
      datasets = [{
        label: config.labels?.yAxis || yKey,
        data: config.data.map((item: any) => item[yKey]),
        borderColor: vibrantBorderColors[0],
        backgroundColor: vibrantColors[0],
        tension: 0.1
      }];
    }
    
    // Correctly formatted data for Chart.js
    const chartData = {
      labels,
      datasets
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Line
          options={chartOptions}
          data={chartData}
        />
      </motion.div>
    );
  }

  // Handle bar chart
  if (type === 'bar') {
    // Format the data correctly for Chart.js
    const labels = config.data.map((item: any) => item[config.xKey || Object.keys(item)[0]]);
    
    // Determine what data series to display
    let datasets = [];
    if (config.series && Array.isArray(config.series) && config.series.length > 0) {
      // Use series configuration
      datasets = config.series.map((serie: any, index: number) => ({
        label: serie.name || serie.dataKey,
        data: config.data.map((item: any) => item[serie.dataKey]),
        backgroundColor: serie.color || vibrantColors[index % vibrantColors.length],
        borderColor: serie.color || vibrantBorderColors[index % vibrantBorderColors.length],
        borderWidth: 1
      }));
    } else {
      // Create single series using yKey
      const yKey = config.yKey || Object.keys(config.data[0])[1];
      
      // Always use multiple colors for bar charts
      datasets = [{
        label: config.labels?.yAxis || yKey,
        data: config.data.map((item: any) => item[yKey]),
        borderColor: config.data.map((_: any, i: number) => vibrantBorderColors[i % vibrantBorderColors.length]),
        backgroundColor: config.data.map((_: any, i: number) => vibrantColors[i % vibrantColors.length]),
      }];
    }
    
    // Correctly formatted data for Chart.js
    const chartData = {
      labels,
      datasets
    };
    
    // Enhanced options for bar charts with better text visibility
    const barChartOptions = {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        legend: {
          ...chartOptions.plugins?.legend,
          labels: {
            ...chartOptions.plugins?.legend?.labels,
            color: document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.8)' 
              : 'rgba(0, 0, 0, 0.8)'
          }
        },
        title: {
          ...chartOptions.plugins?.title,
          color: document.documentElement.classList.contains('dark') 
            ? 'rgba(255, 255, 255, 0.9)' 
            : 'rgba(0, 0, 0, 0.9)'
        }
      },
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales?.y,
          ticks: {
            ...chartOptions.scales?.y?.ticks,
            color: document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.8)' 
              : 'rgba(0, 0, 0, 0.8)'
          },
          title: {
            ...chartOptions.scales?.y?.title,
            color: document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.9)' 
              : 'rgba(0, 0, 0, 0.9)'
          }
        },
        x: {
          ...chartOptions.scales?.x,
          ticks: {
            ...chartOptions.scales?.x?.ticks,
            color: document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.8)' 
              : 'rgba(0, 0, 0, 0.8)'
          },
          title: {
            ...chartOptions.scales?.x?.title,
            color: document.documentElement.classList.contains('dark') 
              ? 'rgba(255, 255, 255, 0.9)' 
              : 'rgba(0, 0, 0, 0.9)'
          }
        }
      }
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Bar
          options={barChartOptions}
          data={chartData}
        />
      </motion.div>
    );
  }

  // Handle pie chart
  if (type === 'pie') {
    // Format the data correctly for Chart.js
    const labels = config.data.map((item: any) => item[config.xKey || Object.keys(item)[0]]);
    
    // For pie charts, we typically need a single dataset with colors for each slice
    const valueKey = config.yKey || Object.keys(config.data[0])[1];
    const backgroundColors = config.data.map((_: any, index: number) => vibrantColors[index % vibrantColors.length]);
    
    // Correctly formatted data for Chart.js
    const chartData = {
      labels,
      datasets: [{
        label: config.labels?.yAxis || valueKey,
        data: config.data.map((item: any) => item[valueKey]),
        backgroundColor: backgroundColors,
        borderColor: config.data.map((_: any, index: number) => vibrantBorderColors[index % vibrantBorderColors.length]),
        borderWidth: 1
      }]
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Pie
          options={chartOptions}
          data={chartData}
        />
      </motion.div>
    );
  }

  // Handle radar chart
  if (type === 'radar') {
    // Format the data correctly for Chart.js
    const labels = config.data.map((item: any) => item[config.xKey || Object.keys(item)[0]]);
    
    // Determine what data series to display
    let datasets = [];
    if (config.series && Array.isArray(config.series) && config.series.length > 0) {
      // Use series configuration
      datasets = config.series.map((serie: any, index: number) => ({
        label: serie.name || serie.dataKey,
        data: config.data.map((item: any) => item[serie.dataKey]),
        borderColor: serie.color || vibrantBorderColors[index % vibrantBorderColors.length],
        backgroundColor: serie.color || vibrantColors[index % vibrantColors.length],
      }));
    } else {
      // Create single series using yKey
      const yKey = config.yKey || Object.keys(config.data[0])[1];
      datasets = [{
        label: config.labels?.yAxis || yKey,
        data: config.data.map((item: any) => item[yKey]),
        borderColor: vibrantBorderColors[0],
        backgroundColor: vibrantColors[0],
      }];
    }
    
    // Correctly formatted data for Chart.js
    const chartData = {
      labels,
      datasets
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Radar
          options={chartOptions}
          data={chartData}
        />
      </motion.div>
    );
  }

  // Handle scatter chart
  if (type === 'scatter') {
    // For scatter chart, we need x and y coordinates
    let datasets = [];
    if (config.series && Array.isArray(config.series) && config.series.length > 0) {
      // Use series configuration
      datasets = config.series.map((serie: any, index: number) => {
        const xDataKey = serie.xDataKey || config.xKey || Object.keys(config.data[0])[0];
        const yDataKey = serie.dataKey || config.yKey || Object.keys(config.data[0])[1];
        
        return {
          label: serie.name || yDataKey,
          data: config.data.map((item: any) => ({ 
            x: item[xDataKey],
            y: item[yDataKey]
          })),
          backgroundColor: serie.color || vibrantColors[index % vibrantColors.length],
        };
      });
    } else {
      // Create single series using xKey and yKey
      const xKey = config.xKey || Object.keys(config.data[0])[0];
      const yKey = config.yKey || Object.keys(config.data[0])[1];
      
      datasets = [{
        label: config.labels?.yAxis || yKey,
        data: config.data.map((item: any) => ({ 
          x: item[xKey],
          y: item[yKey]
        })),
        backgroundColor: vibrantColors[0],
      }];
    }
    
    // Correctly formatted data for Chart.js
    const chartData = {
      datasets
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <Scatter
          options={chartOptions}
          data={chartData}
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