import React from 'react';
import { VisualizationProps } from '../index';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { CHART_COLORS, DARK_CHART_COLORS, CHART_BORDER_COLORS } from '../constants';

// Register the required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

/**
 * Extended props interface with theme
 */
interface PieChartProps extends VisualizationProps {
  theme?: 'light' | 'dark';
}

/**
 * Pie Chart Component
 * Renders a pie chart visualization using Chart.js
 */
const PieChart: React.FC<PieChartProps> = ({
  data,
  width = '100%',
  height = 400,
  xKey,
  yKey,
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
    
    // For pie charts, we need a category field (xKey) and a value field (yKey)
    const effectiveXKey = xKey || 'label';
    const effectiveYKey = yKey || 'value';
    
    // Extract labels and data values
    const chartLabels = data.map(item => item[effectiveXKey] || 'Unknown');
    const chartValues = data.map(item => Number(item[effectiveYKey] || 0));
    
    // Add hover effect to colors
    const hoverColors = colors.map((color: string) => {
      return color.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, 'rgba($1, $2, $3, 0.9)');
    });
    
    // Create the dataset
    return {
      labels: chartLabels,
      datasets: [{
        label: labels?.yAxis || effectiveYKey,
        data: chartValues,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 2,
        hoverBackgroundColor: hoverColors,
        hoverBorderColor: borderColors,
        hoverBorderWidth: 3,
        hoverOffset: 8
      }]
    };
  }, [data, xKey, yKey, colors, borderColors, labels]);
  
  // Chart options
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const, // Position legend to the right for pie charts
        labels: {
          boxWidth: 12,
          padding: 15,
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          font: {
            size: 12
          },
          generateLabels: function(chart: any) {
            const datasets = chart.data.datasets;
            
            if (datasets.length === 0) return [];
            
            // Generate legend labels with custom formatting
            return chart.data.labels.map((label: string, i: number) => {
              const value = datasets[0].data[i];
              const total = datasets[0].data.reduce((acc: number, val: number) => acc + val, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
              
              return {
                text: `${label} (${percentage})`,
                fillStyle: datasets[0].backgroundColor[i],
                strokeStyle: datasets[0].borderColor[i],
                lineWidth: 1,
                hidden: isNaN(datasets[0].data[i]) || datasets[0].data[i] === 0,
                index: i
              };
            });
          }
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
            const label = context.label || '';
            const value = context.raw;
            const total = context.dataset.data.reduce((acc: number, val: number) => acc + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
            return `${label}: ${new Intl.NumberFormat().format(value)} (${percentage})`;
          }
        }
      }
    },
    cutout: options.doughnut ? '50%' : '0%', // Makes it a doughnut if specified
    radius: '90%', // Slightly smaller to fit in the container
    animation: {
      animateRotate: true,
      animateScale: true,
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
    ...options
  };

  return (
    <div style={{ width: chartWidth, height: chartHeight }}>
      <Pie data={chartData} options={defaultOptions} />
    </div>
  );
};

export default PieChart; 