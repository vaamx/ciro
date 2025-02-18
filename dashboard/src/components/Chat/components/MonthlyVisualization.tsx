import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Visualization } from '../../Visualization';
import { openAIService } from '../../../services/openai';

export const MonthlyVisualization: React.FC = () => {
  const [visualization, setVisualization] = useState<{ type: string; config: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monthly sales data
  const salesData = {
    type: 'monthly_sales',
    data: {
      labels: [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ],
      values: [120, 150, 100, 130, 170, 160, 180, 140, 200, 190, 210, 230],
      title: 'Ventas Mensuales de Producto en 2023',
      xAxisLabel: 'Mes',
      yAxisLabel: 'Ventas (unidades)'
    }
  };

  useEffect(() => {
    generateVisualization();
  }, []);

  const generateVisualization = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const suggestion = await openAIService.suggestVisualization(salesData);
      setVisualization(suggestion);
    } catch (err) {
      setError('Error al generar la visualización. Por favor, intente de nuevo.');
      console.error('Error de visualización:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // If you want to show it immediately without AI suggestion, you can use this configuration:
  const immediateConfig = {
    type: 'bar',
    config: {
      data: {
        labels: salesData.data.labels,
        datasets: [{
          label: 'Ventas Mensuales',
          data: salesData.data.values,
          backgroundColor: 'rgba(59, 130, 246, 0.8)', // Tailwind blue-500
          borderRadius: 6,
          barThickness: 20
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: salesData.data.title,
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: salesData.data.xAxisLabel
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            title: {
              display: true,
              text: salesData.data.yAxisLabel
            },
            beginAtZero: true
          }
        }
      }
    }
  };

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg"
      >
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
            />
          </div>
        ) : error ? (
          <div className="h-80 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <div className="p-6">
            <Visualization
              type={visualization?.type || immediateConfig.type}
              config={visualization?.config || immediateConfig.config}
              className="h-80"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}; 