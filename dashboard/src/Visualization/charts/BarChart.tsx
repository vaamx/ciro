import React from 'react';
import { VisualizationProps } from '../index';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { CHART_COLORS, DARK_CHART_COLORS, CHART_BORDER_COLORS } from '../constants';

// Register the required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Extended VisualizationProps interface with theme
 */
interface BarChartProps extends VisualizationProps {
  theme?: 'light' | 'dark';
}

/**
 * Bar Chart Component
 * Renders a bar chart visualization using Chart.js
 */
const BarChart: React.FC<BarChartProps> = ({
  data,
  width = '100%',
  height = 400,
  xKey,
  yKey,
  series,
  labels,
  options = {},
  theme = 'light'
}) => {
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Use provided colors or default vibrant colors
  const colors = options.colors || (theme === 'dark' ? DARK_CHART_COLORS : CHART_COLORS);
  const borderColors = options.borderColors || CHART_BORDER_COLORS;
  
  // Process data for the chart
  const chartData = React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { labels: [], datasets: [] };
    }
    
    // Extract labels from data
    const chartLabels = data.map(item => item[xKey || 'label'] || 'Unknown');
    
    // If we have series defined, create multiple datasets
    if (series && Array.isArray(series) && series.length > 0) {
      const datasets = series.map((s, index) => {
        const dataKey = s.dataKey || yKey || 'value';
        // Force the color to be used exactly as provided
        const color = s.color || colors[index % colors.length];
        const borderColor = borderColors[index % borderColors.length];

        return {
          label: s.name || dataKey,
          data: data.map(item => Number(item[dataKey] || 0)),
          backgroundColor: color,
          borderColor: borderColor,
          borderWidth: 1,
          borderRadius: options.borderRadius || 4,
          barPercentage: options.barPercentage || 0.8,
          categoryPercentage: options.categoryPercentage || 0.8,
          hoverBackgroundColor: borderColor,
          hoverBorderColor: borderColor,
          // Ensure direct color assignment if specified
          ...(options.useDirectColorAssignment && { 
            backgroundColor: data.map((_, i) => colors[i % colors.length])
          })
        };
      });
      
      return { labels: chartLabels, datasets };
    }
    
    // Otherwise, create a single dataset
    const datasetColor = colors[0];
    const datasetBorderColor = borderColors[0];

    return {
      labels: chartLabels,
      datasets: [{
        label: labels?.yAxis || yKey || 'Value',
        data: data.map(item => Number(item[yKey || 'value'] || 0)),
        backgroundColor: options.useDirectColorAssignment 
          ? data.map((_, i) => colors[i % colors.length])  // Apply colors directly to each bar
          : datasetColor,
        borderColor: options.useDirectColorAssignment
          ? data.map((_, i) => borderColors[i % borderColors.length])
          : datasetBorderColor,
        borderWidth: 1,
        borderRadius: options.borderRadius || 4,
        barPercentage: options.barPercentage || 0.8,
        categoryPercentage: options.categoryPercentage || 0.8,
        hoverBackgroundColor: options.useDirectColorAssignment
          ? data.map((_, i) => borderColors[i % borderColors.length])
          : datasetBorderColor,
        hoverBorderColor: options.useDirectColorAssignment
          ? data.map((_, i) => borderColors[i % borderColors.length])
          : datasetBorderColor
      }]
    };
  }, [data, xKey, yKey, series, colors, borderColors, labels, options]);
  
  // Default chart options
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        }
      },
      title: {
        display: !!labels?.title,
        text: labels?.title || '',
        color: theme === 'dark' ? '#e5e7eb' : '#374151',
        font: {
          size: 16,
          weight: 'bold' as const
        },
        padding: { bottom: 20 }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(26, 32, 44, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        bodyColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        borderColor: theme === 'dark' ? 'rgba(74, 85, 104, 0.3)' : 'rgba(203, 213, 224, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 6,
        boxPadding: 6,
        displayColors: true,
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: true,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat().format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: !!labels?.xAxis,
          text: labels?.xAxis || '',
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          padding: { top: 10 }
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        grid: {
          display: false,
          drawBorder: true,
          borderDash: [5, 5],
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        title: {
          display: !!labels?.yAxis,
          text: labels?.yAxis || '',
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        beginAtZero: true,
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          // Format large numbers with K, M, etc.
          callback: function(value: any) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          }
        },
        grid: {
          drawBorder: true,
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
    },
    layout: {
      padding: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      }
    },
    // Override defaults with any user-provided options
    ...options
  };

  return (
    <div style={{ width: chartWidth, height: chartHeight }}>
      <Bar data={chartData} options={defaultOptions} />
    </div>
  );
};

export default BarChart; 