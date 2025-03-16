import React, { useState, useCallback } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import BarChartComponent from './charts/BarChart';
import LineChartComponent from './charts/LineChart';
import PieChartComponent from './charts/PieChart';
import AreaChartComponent from './charts/AreaChart';
import ScatterChartComponent from './charts/ScatterChart';
import HeatmapChartComponent from './charts/HeatmapChart';
import { CHART_COLORS, DARK_CHART_COLORS, CHART_BORDER_COLORS } from './constants';

// Sample data for demos and tests
const DEMO_DATA = [
  { name: 'Group A', value: 400 },
  { name: 'Group B', value: 300 },
  { name: 'Group C', value: 300 },
  { name: 'Group D', value: 200 }
];

// Enhanced tooltip component with animations
const AnimatedTooltip = ({ active, payload, label, theme }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const bgColor = theme === 'dark' ? '#1f2937' : '#ffffff';
  const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
  const borderColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  
  // Helper function to safely render any value as a string
  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg shadow-lg p-3"
      style={{ 
        backgroundColor: bgColor, 
        color: textColor, 
        border: `1px solid ${borderColor}`,
        maxWidth: '300px'
      }}
    >
      <p className="font-medium mb-1">{renderValue(label)}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span>{renderValue(entry.name)}: </span>
          <span className="font-medium">{renderValue(entry.value)}</span>
        </div>
      ))}
    </motion.div>
  );
};

// Active shape for pie chart with hover effect
const renderActiveShape = (props: any) => {
  const { 
    cx, cy, fill, payload, percent
  } = props;

  // Helper function to safely render any value as a string
  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {renderValue(payload.name)}
      </text>
      <text x={cx} y={cy + 20} textAnchor="middle" fill={fill}>
        {`${(percent * 100).toFixed(2)}%`}
      </text>
    </g>
  );
};

interface InteractiveVisualizationProps {
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
  theme?: 'light' | 'dark';
  onDataPointClick?: (data: any) => void;
  enableDrillDown?: boolean;
}

export const InteractiveVisualization: React.FC<InteractiveVisualizationProps> = ({
  config,
  height = 300,
  width = '100%',
  theme = 'light',
  onDataPointClick,
  enableDrillDown = false
}) => {
  const {
    type,
    data = [],
    xKey = 'name',
    yKey = 'value',
    series = [],
    labels = {},
    options = {}
  } = config;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [drillDownData, setDrillDownData] = useState<any>(null);

  // Default series if none provided
  const chartSeries = series.length > 0 
    ? series 
    : [{ dataKey: yKey, name: yKey }];

  // Detect theme if not explicitly provided
  const currentTheme = theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  // Add color to series if not specified
  const coloredSeries = chartSeries.map((s, i) => {
    // For bar charts with useDirectColorAssignment, don't add a specific color
    // This allows the BarChart component to apply different colors to each bar
    if (type.toLowerCase() === 'bar' && options.useDirectColorAssignment && !s.color) {
      return {
        ...s
      };
    }
    
    // For other chart types, or if useDirectColorAssignment is false, add color
    return {
      ...s,
      color: s.color || CHART_COLORS[i % CHART_COLORS.length]
    };
  });

  // Handle click on data point
  const handleDataPointClick = useCallback((data: any) => {
    if (onDataPointClick) {
      onDataPointClick(data);
    }

    if (enableDrillDown && data.drillDown) {
      setDrillDownData(data.drillDown);
    }
  }, [onDataPointClick, enableDrillDown, drillDownData]);

  const resetDrillDown = () => {
    setDrillDownData(null);
  };

  // Store functions to handle pie chart interactions
  const handlePieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const handlePieLeave = () => {
    setActiveIndex(null);
  };

  // If we're in drill-down view
  if (drillDownData) {
    return (
      <div className="relative">
        <button 
          onClick={resetDrillDown}
          className="absolute top-0 right-0 z-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 m-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <InteractiveVisualization 
          config={{
            type: drillDownData.type || type,
            data: drillDownData.data,
            xKey: drillDownData.xKey || xKey,
            yKey: drillDownData.yKey || yKey,
            labels: {
              ...labels,
              title: drillDownData.title || `Drill Down: ${labels.title || ''}`
            },
            options
          }}
          height={height}
          width={width}
          theme={theme}
          onDataPointClick={onDataPointClick}
        />
      </div>
    );
  }

  // Add vibrant colors if not provided
  const enhancedOptions = {
    ...options,
    // Ensure we're not overriding user-provided colors
    colors: options.colors || CHART_COLORS,
    borderColors: options.borderColors || CHART_BORDER_COLORS,
    useDirectColorAssignment: options.useDirectColorAssignment !== undefined 
      ? options.useDirectColorAssignment 
      : true,  // Enable direct color assignment by default
    animation: options.animation !== undefined ? options.animation : true,
    maintainAspectRatio: false, // Disable aspect ratio to use full height
    responsiveAnimationDuration: 500,
    plugins: {
      ...(options.plugins || {}),
      legend: {
        position: 'bottom',
        display: true,
        ...(options.plugins?.legend || {})
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        ...(options.plugins?.tooltip || {})
      }
    },
    // Preserve the interaction handlers from previous implementation
    onHover: options.onHover || ((e: any, elements: any[]) => {
      if (e.native && e.native.target) {
        e.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      }
    }),
    onClick: options.onClick || handleDataPointClick
  };

  // Render the appropriate chart
  const renderChart = () => {
    switch (type.toLowerCase()) {
      case 'bar':
        return (
          <BarChartComponent
            data={data}
            width={width}
            height={height}
            xKey={xKey}
            yKey={yKey}
            series={coloredSeries}
            labels={labels}
            options={enhancedOptions}
            theme={currentTheme}
          />
        );
      case 'line':
        return (
          <LineChartComponent
            data={data}
            width={width}
            height={height}
            xKey={xKey}
            yKey={yKey}
            series={coloredSeries}
            labels={labels}
            options={enhancedOptions}
            theme={currentTheme}
          />
        );
      case 'pie':
        return (
          <PieChartComponent
            data={data}
            width={width}
            height={height}
            xKey={xKey}
            yKey={yKey}
            series={coloredSeries}
            labels={labels}
            options={{
              ...enhancedOptions,
              activeIndex: activeIndex,
              onSectorEnter: handlePieEnter,
              onSectorLeave: handlePieLeave
            }}
            theme={currentTheme}
          />
        );
      case 'area':
        return (
          <AreaChartComponent
            data={data}
            width={width}
            height={height}
            xKey={xKey}
            yKey={yKey}
            series={coloredSeries}
            labels={labels}
            options={enhancedOptions}
            theme={currentTheme}
          />
        );
      case 'scatter':
        return (
          <ScatterChartComponent
            data={data}
            width={width}
            height={height}
            xKey={xKey}
            yKey={yKey}
            series={coloredSeries}
            labels={labels}
            options={enhancedOptions}
            theme={currentTheme}
          />
        );
      case 'heatmap':
        return (
          <HeatmapChartComponent
            data={data}
            width={width}
            height={height}
            xKey={xKey}
            yKey={yKey}
            series={coloredSeries}
            labels={labels}
            options={enhancedOptions}
            theme={currentTheme}
          />
        );
      default:
        // For other chart types, use direct recharts components as fallback
        return (
          <div className="chart-fallback">
            <ResponsiveContainer width="100%" height={height}>
              {type.toLowerCase() === 'pie' ? (
                <PieChart>
                  <Pie
                    activeIndex={activeIndex !== null ? activeIndex : undefined}
                    activeShape={renderActiveShape}
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey={yKey}
                    onMouseEnter={handlePieEnter}
                    onMouseLeave={handlePieLeave}
                    onClick={handleDataPointClick}
                  >
                    {data.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<AnimatedTooltip theme={theme} />} />
                  <Legend />
                </PieChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={xKey} />
                  <YAxis />
                  <Tooltip content={<AnimatedTooltip theme={theme} />} />
                  <Legend />
                  {coloredSeries.map((s, index) => (
                    <Bar
                      key={index}
                      dataKey={s.dataKey}
                      name={s.name || s.dataKey}
                      fill={s.color}
                      onClick={handleDataPointClick}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        );
    }
  };

  return (
    <div className="interactive-visualization">
      {labels.title && (
        <h3 className="text-lg font-medium mb-2 text-center">{labels.title}</h3>
      )}
      {renderChart()}
    </div>
  );
};

// Demonstrating the direct use of all imported recharts components in a demo function
const renderDirectRechartsDemo = (theme: string = 'light', data: any[] = DEMO_DATA) => {
  const chartColors = theme === 'dark' ? DARK_CHART_COLORS : CHART_COLORS;
  
  return (
    <div className="recharts-demo-container">
      <div className="mb-8">
        <h4 className="text-sm mb-2 font-semibold">Bar Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip content={<AnimatedTooltip theme={theme} />} />
            <Legend />
            <Bar dataKey="value" fill={chartColors[0]}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mb-8">
        <h4 className="text-sm mb-2 font-semibold">Line Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip content={<AnimatedTooltip theme={theme} />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={chartColors[1]} 
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mb-8">
        <h4 className="text-sm mb-2 font-semibold">Pie Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              dataKey="value"
              activeShape={renderActiveShape}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip content={<AnimatedTooltip theme={theme} />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mb-8">
        <h4 className="text-sm mb-2 font-semibold">Area Chart</h4>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip content={<AnimatedTooltip theme={theme} />} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={chartColors[2]} 
              fill={chartColors[2]} 
              fillOpacity={0.3} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Export the demo function for testing purposes
export { renderDirectRechartsDemo }; 