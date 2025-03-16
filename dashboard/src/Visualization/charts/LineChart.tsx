import React from 'react';
import { VisualizationProps } from '../index';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { CHART_COLORS, DARK_CHART_COLORS, CHART_BORDER_COLORS } from '../constants';

// Register the required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Extended VisualizationProps interface with theme
 */
interface LineChartProps extends VisualizationProps {
  theme?: 'light' | 'dark';
}

/**
 * Line Chart Component
 * Renders a line chart visualization using Chart.js
 */
const LineChart: React.FC<LineChartProps> = ({
  data,
  width = '100%',
  height = 400, // Increased default height
  xKey,
  yKey,
  series,
  labels,
  options = {},
  theme = 'light'
}) => {
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Use provided colors or default vibrant colors from constants
  const colors = options.colors || (theme === 'dark' ? DARK_CHART_COLORS : CHART_COLORS);
  const borderColors = options.borderColors || CHART_BORDER_COLORS;
  
  // Create background colors with lower opacity for fills
  const backgroundColors = colors.map((color: string) => {
    return color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1, $2, $3, 0.2)');
  });
  
  // Process data for chart
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
        const color = s.color || colors[index % colors.length];
        const borderColor = borderColors[index % borderColors.length];
        const bgColor = s.color ? 
          color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1, $2, $3, 0.1)') : 
          backgroundColors[index % backgroundColors.length];

        return {
          label: s.name || dataKey,
          data: data.map(item => Number(item[dataKey] || 0)),
          borderColor: color,
          backgroundColor: bgColor,
          borderWidth: 2,
          pointBackgroundColor: borderColor,
          pointBorderColor: 'rgba(255,255,255,0.8)',
          pointHoverBackgroundColor: borderColor,
          pointHoverBorderColor: 'rgba(255,255,255,1)',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,  // Add some curve to the lines
          fill: options.fill !== false && s.type !== 'line', // Fill area if not explicitly disabled
        };
      });
      
      return { labels: chartLabels, datasets };
    }
    
    // Otherwise, create a single dataset
    return {
      labels: chartLabels,
      datasets: [{
        label: labels?.yAxis || yKey || 'Value',
        data: data.map(item => Number(item[yKey || 'value'] || 0)),
        borderColor: colors[0],
        backgroundColor: backgroundColors[0],
        borderWidth: 2,
        pointBackgroundColor: borderColors[0],
        pointBorderColor: 'rgba(255,255,255,0.8)',
        pointHoverBackgroundColor: borderColors[0],
        pointHoverBorderColor: 'rgba(255,255,255,1)',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: options.fill !== false,
      }]
    };
  }, [data, xKey, yKey, series, colors, borderColors, backgroundColors, labels, options.fill]);
  
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
        grid: {
          display: false,
          drawBorder: true,
          borderDash: [5, 5],
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        }
      },
      y: {
        title: {
          display: !!labels?.yAxis,
          text: labels?.yAxis || '',
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        beginAtZero: true,
        grid: {
          drawBorder: true,
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          // Format large numbers with K, M, etc.
          callback: function(value: any) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          }
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as const
    },
    layout: {
      padding: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      }
    },
    elements: {
      line: {
        tension: 0.3 // Adds a smooth curve to lines
      },
      point: {
        radius: 4,
        hoverRadius: 6,
        hitRadius: 8
      }
    },
    ...options
  };

  return (
    <div style={{ width: chartWidth, height: chartHeight }}>
      <Line data={chartData} options={defaultOptions} />
    </div>
  );
};

export default LineChart; 