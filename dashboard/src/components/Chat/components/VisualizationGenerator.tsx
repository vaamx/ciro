import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Visualization } from '../../Visualization';
import { openAIService } from '../../../services/openai';

export const VisualizationGenerator: React.FC = () => {
  const [visualization, setVisualization] = useState<{ type: string; config: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Example datasets
  const sampleDatasets = {
    timeSeriesData: {
      dates: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05'],
      values: [1200, 1350, 1800, 1650, 2100],
      metric: 'Monthly Sales'
    },
    
    categoryData: {
      categories: ['Electronics', 'Clothing', 'Books', 'Home', 'Sports'],
      values: [45000, 32000, 18000, 25000, 15000],
      metric: 'Revenue by Category'
    },
    
    distributionData: {
      segments: ['Premium', 'Standard', 'Basic'],
      counts: [250, 450, 300],
      metric: 'Customer Segments'
    },

    correlationData: {
      points: [
        { age: 25, income: 45000 },
        { age: 30, income: 55000 },
        { age: 35, income: 65000 },
        { age: 40, income: 80000 },
        { age: 45, income: 90000 },
        { age: 50, income: 95000 }
      ],
      metrics: ['Age', 'Income']
    }
  };

  const generateVisualization = async (data: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const suggestion = await openAIService.suggestVisualization(data);
      setVisualization(suggestion);
    } catch (err) {
      setError('Failed to generate visualization. Please try again.');
      console.error('Visualization generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Visualization Generator
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time Series Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => generateVisualization(sampleDatasets.timeSeriesData)}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Time Series Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate a visualization for monthly sales trends
          </p>
        </motion.button>

        {/* Category Data Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => generateVisualization(sampleDatasets.categoryData)}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Category Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate a visualization for revenue by category
          </p>
        </motion.button>

        {/* Distribution Data Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => generateVisualization(sampleDatasets.distributionData)}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Distribution Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate a visualization for customer segments
          </p>
        </motion.button>

        {/* Correlation Data Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => generateVisualization(sampleDatasets.correlationData)}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Correlation Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate a visualization for age-income correlation
          </p>
        </motion.button>
      </div>

      {/* Visualization Result */}
      {isLoading && (
        <div className="mt-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"
          />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Generating visualization...
          </p>
        </div>
      )}

      {error && (
        <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {visualization && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg"
        >
          <Visualization
            type={visualization.type}
            config={visualization.config}
            className="h-80"
          />
        </motion.div>
      )}
    </div>
  );
}; 