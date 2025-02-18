import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Visualization } from '../../Visualization';
import { openAIService } from '../../../services/openai';

export const ProductComparison: React.FC = () => {
  const [visualizations, setVisualizations] = useState<Array<{ type: string; config: any }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product comparison data
  const productData = {
    products: ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'],
    metrics: {
      productionCost: [15, 20, 10, 25, 30],
      salesPrice: [30, 45, 25, 50, 60],
      unitsSold: [1000, 800, 1200, 600, 400],
      profitMargin: [50, 55, 60, 50, 50],
      customerSatisfaction: [8, 7, 9, 6, 8]
    }
  };

  // Different visualization configurations
  const visualizationConfigs = [
    // Bar chart for Units Sold
    {
      type: 'bar',
      config: {
        data: {
          labels: productData.products,
          datasets: [{
            label: 'Units Sold',
            data: productData.metrics.unitsSold,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Product Sales Volume Comparison',
              font: { size: 16, weight: 'bold' }
            },
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Units Sold' }
            }
          }
        }
      }
    },
    // Line chart for Profit Margins
    {
      type: 'line',
      config: {
        data: {
          labels: productData.products,
          datasets: [{
            label: 'Profit Margin (%)',
            data: productData.metrics.profitMargin,
            borderColor: 'rgb(147, 51, 234)',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Product Profit Margins',
              font: { size: 16, weight: 'bold' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Profit Margin (%)' }
            }
          }
        }
      }
    },
    // Bar chart for Cost vs Price
    {
      type: 'bar',
      config: {
        data: {
          labels: productData.products,
          datasets: [
            {
              label: 'Production Cost',
              data: productData.metrics.productionCost,
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              borderRadius: 6
            },
            {
              label: 'Sales Price',
              data: productData.metrics.salesPrice,
              backgroundColor: 'rgba(34, 197, 94, 0.8)',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Production Cost vs Sales Price',
              font: { size: 16, weight: 'bold' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Amount ($)' }
            }
          }
        }
      }
    },
    // Radar chart for Customer Satisfaction
    {
      type: 'radar',
      config: {
        data: {
          labels: productData.products,
          datasets: [{
            label: 'Customer Satisfaction',
            data: productData.metrics.customerSatisfaction,
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgb(99, 102, 241)',
            pointBackgroundColor: 'rgb(99, 102, 241)'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Customer Satisfaction Ratings',
              font: { size: 16, weight: 'bold' }
            }
          },
          scales: {
            r: {
              beginAtZero: true,
              max: 10,
              ticks: { stepSize: 2 }
            }
          }
        }
      }
    }
  ];

  useEffect(() => {
    setVisualizations(visualizationConfigs);
    setIsLoading(false);
  }, []);

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Manufacturing Products Comparison
      </h2>

      {isLoading ? (
        <div className="h-80 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"
          />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {visualizations.map((viz, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <Visualization
                type={viz.type}
                config={viz.config}
                className="h-80"
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}; 