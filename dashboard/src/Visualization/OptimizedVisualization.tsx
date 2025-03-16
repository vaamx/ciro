import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts';
import { useVisualizationWorker } from '../hooks/useVisualizationWorker';
import { SAMPLING_CONFIG, RESPONSIVE_CONFIG } from '../utils/performanceConfig';

// Loading indicator component
const LoadingIndicator = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

interface VisualizationProps {
  config: {
    type: string;
    data: any[];
    xKey?: string;
    yKey?: string;
    series?: Array<{
      dataKey: string;
      name?: string;
      color?: string;
      type?: 'bar' | 'line' | 'area';
    }>;
    labels?: {
      xAxis?: string;
      yAxis?: string;
      title?: string;
    };
    options?: Record<string, any>;
  };
  height?: number;
  width?: string | number;
}

/**
 * Optimized visualization component that uses web workers for data processing
 * and implements caching and lazy loading
 */
export const OptimizedVisualization: React.FC<VisualizationProps> = ({
  config,
  height = RESPONSIVE_CONFIG.defaultHeight,
  width = '100%'
}) => {
  const { processData, isProcessing } = useVisualizationWorker();
  const [processedData, setProcessedData] = useState<any[]>([]);
  
  // Process data using worker when config changes
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      // Skip processing if no data
      if (!config.data || config.data.length === 0) {
        setProcessedData([]);
        return;
      }
      
      // Process data with worker
      const result = await processData(config.data, {
        type: config.type,
        options: {
          sampling: {
            maxPoints: SAMPLING_CONFIG.maxDataPoints,
            strategy: SAMPLING_CONFIG.defaultStrategy
          },
          ...config.options
        }
      });
      
      // Only update state if component is still mounted
      if (isMounted) {
        setProcessedData(result);
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [config, processData]);
  
  // Memoize chart colors to prevent unnecessary re-renders
  const CHART_COLORS = useMemo(() => [
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', 
    '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1'
  ], []);
  
  // Render the appropriate chart based on type
  const renderChart = () => {
    // Show loading indicator while processing
    if (isProcessing) {
      return <LoadingIndicator />;
    }
    
    // Handle empty data
    if (!processedData || processedData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full w-full text-gray-500">
          No data available
        </div>
      );
    }
    
    const { type, xKey = 'x', yKey = 'y', series = [], labels = {} } = config;
    
    switch (type) {
      case 'bar': {
        return (
          <ResponsiveContainer width={width} height={height}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} label={{ value: labels.xAxis, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: labels.yAxis, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {series.length > 0 ? (
                series.map((s, index) => (
                  <Bar 
                    key={s.dataKey} 
                    dataKey={s.dataKey} 
                    name={s.name || s.dataKey} 
                    fill={s.color || CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                ))
              ) : (
                <Bar dataKey={yKey} fill={CHART_COLORS[0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );
      }
      
      case 'line': {
        return (
          <ResponsiveContainer width={width} height={height}>
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} label={{ value: labels.xAxis, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: labels.yAxis, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {series.length > 0 ? (
                series.map((s, index) => (
                  <Line 
                    key={s.dataKey} 
                    type="monotone" 
                    dataKey={s.dataKey} 
                    name={s.name || s.dataKey} 
                    stroke={s.color || CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                ))
              ) : (
                <Line type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} />
              )}
            </LineChart>
          </ResponsiveContainer>
        );
      }
      
      case 'pie': {
        return (
          <ResponsiveContainer width={width} height={height}>
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={yKey}
                nameKey={xKey}
              >
                {processedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }
      
      case 'area': {
        return (
          <ResponsiveContainer width={width} height={height}>
            <AreaChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} label={{ value: labels.xAxis, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: labels.yAxis, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {series.length > 0 ? (
                series.map((s, index) => (
                  <Area 
                    key={s.dataKey} 
                    type="monotone" 
                    dataKey={s.dataKey} 
                    name={s.name || s.dataKey} 
                    fill={s.color || CHART_COLORS[index % CHART_COLORS.length]} 
                    stroke={s.color || CHART_COLORS[index % CHART_COLORS.length]} 
                    fillOpacity={0.3}
                  />
                ))
              ) : (
                <Area 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke={CHART_COLORS[0]} 
                  fill={CHART_COLORS[0]} 
                  fillOpacity={0.3} 
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      
      case 'scatter': {
        return (
          <ResponsiveContainer width={width} height={height}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey={xKey} 
                name={labels.xAxis || xKey} 
                label={{ value: labels.xAxis, position: 'insideBottom', offset: -5 }} 
              />
              <YAxis 
                type="number" 
                dataKey={yKey} 
                name={labels.yAxis || yKey} 
                label={{ value: labels.yAxis, angle: -90, position: 'insideLeft' }} 
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter 
                name={labels.title || 'Data'} 
                data={processedData} 
                fill={CHART_COLORS[0]} 
              />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }
      
      case 'composed': {
        return (
          <ResponsiveContainer width={width} height={height}>
            <ComposedChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} label={{ value: labels.xAxis, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: labels.yAxis, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {series.map((s, index) => {
                const color = s.color || CHART_COLORS[index % CHART_COLORS.length];
                
                switch (s.type) {
                  case 'bar':
                    return (
                      <Bar 
                        key={s.dataKey} 
                        dataKey={s.dataKey} 
                        name={s.name || s.dataKey} 
                        fill={color} 
                      />
                    );
                  case 'area':
                    return (
                      <Area 
                        key={s.dataKey} 
                        type="monotone" 
                        dataKey={s.dataKey} 
                        name={s.name || s.dataKey} 
                        fill={color} 
                        stroke={color} 
                        fillOpacity={0.3} 
                      />
                    );
                  case 'line':
                  default:
                    return (
                      <Line 
                        key={s.dataKey} 
                        type="monotone" 
                        dataKey={s.dataKey} 
                        name={s.name || s.dataKey} 
                        stroke={color} 
                      />
                    );
                }
              })}
            </ComposedChart>
          </ResponsiveContainer>
        );
      }
      
      default:
        return (
          <div className="flex items-center justify-center h-full w-full text-gray-500">
            Unsupported chart type: {type}
          </div>
        );
    }
  };
  
  return (
    <div className="visualization-container">
      {renderChart()}
    </div>
  );
}; 