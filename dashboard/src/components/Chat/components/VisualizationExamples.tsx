import { Visualization } from '../../Visualization';
import { motion } from 'framer-motion';

export function VisualizationExamples() {
  // Sample data for line chart (Time Series)
  const lineChartConfig = {
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Monthly Revenue',
        data: [3000, 3500, 4200, 4800, 5100, 5800],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Monthly Revenue Trend',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      }
    }
  };

  // Sample data for bar chart (Comparison)
  const barChartConfig = {
    data: {
      labels: ['Product A', 'Product B', 'Product C', 'Product D'],
      datasets: [{
        label: 'Sales Volume',
        data: [420, 380, 290, 350],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ],
        borderRadius: 6
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Product Sales Comparison',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      }
    }
  };

  // Sample data for pie chart (Distribution)
  const pieChartConfig = {
    data: {
      labels: ['Mobile', 'Desktop', 'Tablet'],
      datasets: [{
        data: [45, 40, 15],
        backgroundColor: [
          'rgba(244, 63, 94, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(234, 179, 8, 0.8)'
        ],
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'User Device Distribution',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      }
    }
  };

  // Sample data for radar chart (Multi-dimensional)
  const radarChartConfig = {
    data: {
      labels: ['Speed', 'Reliability', 'Security', 'Features', 'UX', 'Support'],
      datasets: [{
        label: 'Current',
        data: [85, 90, 95, 80, 88, 92],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        pointBackgroundColor: 'rgb(99, 102, 241)'
      }, {
        label: 'Target',
        data: [90, 95, 95, 85, 90, 95],
        borderColor: 'rgb(244, 63, 94)',
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        pointBackgroundColor: 'rgb(244, 63, 94)'
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Performance Metrics',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  };

  // Sample data for scatter plot (Correlation)
  const scatterChartConfig = {
    data: {
      datasets: [{
        label: 'Customer Data',
        data: [
          { x: 21, y: 550 },
          { x: 25, y: 620 },
          { x: 32, y: 780 },
          { x: 28, y: 650 },
          { x: 35, y: 810 },
          { x: 40, y: 920 },
          { x: 45, y: 980 }
        ],
        backgroundColor: 'rgba(147, 51, 234, 0.6)',
        pointRadius: 8,
        pointHoverRadius: 10
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Age vs. Spending Correlation',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Age'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Monthly Spending ($)'
          }
        }
      }
    }
  };

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Visualization Examples
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <Visualization
            type="line"
            config={lineChartConfig}
            className="h-80"
          />
        </motion.div>

        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <Visualization
            type="bar"
            config={barChartConfig}
            className="h-80"
          />
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <Visualization
            type="pie"
            config={pieChartConfig}
            className="h-80"
          />
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <Visualization
            type="radar"
            config={radarChartConfig}
            className="h-80"
          />
        </motion.div>

        {/* Scatter Plot */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 col-span-full"
        >
          <Visualization
            type="scatter"
            config={scatterChartConfig}
            className="h-80"
          />
        </motion.div>
      </div>
    </div>
  );
} 