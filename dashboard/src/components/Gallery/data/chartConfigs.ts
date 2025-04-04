import { 
  BarChart, 
  LineChart, 
  PieChart, 
  AreaChart, 
  DonutChart,
  StackedBarChart,
  WaterfallChart,
  BridgeChart,
  BarVarianceChart,
  HorizontalBarChart,
  YoYComparisonBarChart,
  EnhancedAreaChart,
  BaseChart
} from '../../../Visualization/echarts';

import * as chartData from './chartData';
import { LucideIcon, BarChart2, LineChart as LineChartIcon, PieChart as PieChartIcon, Radar, ScatterChart } from 'lucide-react';

// Define chart category interface
export interface ChartCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  charts: ChartConfig[];
}

// Define chart configuration interface
export interface ChartConfig {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  description: string;
  sampleData: any[] | null;
  props: (theme: string) => any;
  tags: string[];
  categoryId?: string;
  categoryName?: string;
}

// Bar Chart configurations
const getBarChartProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 400,
  showValues: true,
  valueFormatter: (value: number) => `${value.toFixed(1)}M`,
  valueFontSize: 12,
  valueFontWeight: 'bold',
  valuePosition: 'top',
  valueDistance: 5,
  highlightIndices: [8],
  highlightColor: '#5470c6',
  showChangeIndicators: true,
  showMonthOverMonthChange: true,
  showOverallGrowth: true,
  acpyLabels: true,
  previousYearData: chartData.previousYearData,
  previousYearKey: 'value',
  showPreviousYear: true,
  previousYearOpacity: 0.7,
  highlightExceeded: true,
  exceededColor: '#ee6666',
  labels: {
    title: 'Monthly Performance',
    xAxis: '',
    yAxis: ''
  },
  options: {
    grid: {
      top: 80,
      right: 30,
      bottom: 20,
      left: 60
    },
    yAxis: {
      max: 50,
      axisLabel: {
        formatter: '{value}M'
      }
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 0,
        fontSize: 11
      }
    }
  }
});

const getStackedBarProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'series1',
  theme,
  height: 200,
  showStackTotal: true,
  stackTotalFormatter: (value: number) => `${value.toFixed(0)}`,
  stackTotalPosition: 'top',
  stackTotalOffset: 15,
  stackTotalFontSize: 12,
  stackTotalColor: theme === 'dark' ? '#eee' : '#333',
  showStackLabels: true,
  stackLabelPosition: 'inside',
  stackLabelFormatter: (value: number) => value >= 50 ? `${value.toFixed(0)}` : '',
  
  series: [
    { name: 'Series 1', dataKey: 'series1', color: '#5470c6' },
    { name: 'Series 2', dataKey: 'series2', color: '#91cc75' },
    { name: 'Series 3', dataKey: 'series3', color: '#fac858' }
  ],
  labels: {
    title: 'Stacked Monthly Values',
    xAxis: 'Month',
    yAxis: 'Value'
  },
  options: {
    grid: {
      top: 50,
      right: 0,
      bottom: 0,
      left: 0
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      orient: 'horizontal'
    }
  }
});

const getWaterfallProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 300,
  baselineLabel: 'ΔPY%',
  positiveColor: theme === 'dark' ? '#7cffb2' : '#91cc75',
  negativeColor: theme === 'dark' ? '#ff6e76' : '#ee6666',
  markerColor: theme === 'dark' ? '#fff' : '#000',
  labelColor: theme === 'dark' ? '#ddd' : '#333',
  xAxisColor: theme === 'dark' ? '#666' : '#888',
  xAxisWidth: 2,
  showConnectingLine: true,
  lineWidth: 5,
  markerSize: 3.5,
  fontSize: 13,
  percentFormat: true,
  showValueLabels: true,
  minLineHeight: 25,
  useLogScale: true,
  labels: {
    title: 'Variance Analysis',
    xAxis: '',
    yAxis: 'ΔPY%'
  },
  options: {
    grid: {
      top: 80,
      right: 40,
      bottom: 50,
      left: 40
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 30,
        fontSize: 11
      }
    }
  }
});

const getBridgeProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  startValueKey: 'startValue',
  endValueKey: 'endValue',
  theme,
  height: 320,
  width: '100%',
  positiveColor: theme === 'dark' ? '#7cffb2' : '#91cc75',
  negativeColor: theme === 'dark' ? '#ff6e76' : '#ee6666',
  startColor: theme === 'dark' ? '#555' : '#333',
  endColor: theme === 'dark' ? '#555' : '#333',
  markerColor: theme === 'dark' ? '#fff' : '#000',
  markerSize: 6,
  lineColor: theme === 'dark' ? '#999' : '#888',
  connectingLineWidth: 1,
  lineWidth: 2,
  labelColor: theme === 'dark' ? '#ddd' : '#333',
  xAxisColor: theme === 'dark' ? '#666' : '#888',
  xAxisWidth: 1,
  showConnectingLine: true,
  barWidth: 25,
  fontSize: 12,
  percentFormat: true,
  valueFormat: 'M',
  showValueLabels: true,
  showEndPercentage: true,
  labels: {
    title: 'Revenue Bridge Analysis',
    xAxis: '',
    yAxis: ''
  },
  options: {
    grid: {
      top: 60,
      right: 10,
      bottom: 60,
      left: 10
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 30,
        fontSize: 10
      }
    }
  }
});

const getBarVarianceProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 350,
  barWidth: 30,
  valuePrefix: '',
  valueSuffix: 'M',
  labelPosition: 'top',
  labelOffset: 10,
  labelFontSize: 12,
  labelFontWeight: 'bold',
  showLabel: true,
  positiveColor: theme === 'dark' ? '#7cffb2' : '#91cc75',
  negativeColor: theme === 'dark' ? '#ff6e76' : '#ee6666',
  labels: {
    title: 'Monthly Variance (ΔPY)',
    xAxis: '',
    yAxis: 'Value'
  },
  options: {
    grid: {
      top: 60,
      right: 20,
      bottom: 30,
      left: 40
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 0
      }
    }
  }
});

const getHorizontalBarProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 350,
  barWidth: 20,
  valueFormatter: (value: number) => `${value.toFixed(1)}M`,
  showValues: true,
  valueFontSize: 12,
  valueFontWeight: 'normal',
  valueDistance: 5,
  barColor: theme === 'dark' ? '#626681' : '#505050',
  highlightedBarColor: theme === 'dark' ? '#3498db' : '#0088cc',
  highlightedIndices: [0],
  labels: {
    title: 'City Performance',
    xAxis: 'Value',
    yAxis: '',
    series: 'AC'
  },
  options: {
    grid: {
      top: 60,
      right: 30,
      bottom: 20,
      left: 80
    }
  }
});

// Line Chart configurations
const getLineChartProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 200,
  smooth: true,
  labels: {
    title: 'Monthly Trends',
    xAxis: 'Month',
    yAxis: 'Value'
  },
  options: {
    grid: {
      top: 50,
      right: 0,
      bottom: 15,
      left: 0
    }
  }
});

const getAreaChartProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 200,
  smooth: true,
  showArea: true,
  labels: {
    title: 'Monthly Trends',
    xAxis: 'Month',
    yAxis: 'Value'
  },
  options: {
    grid: {
      top: 50,
      right: 0,
      bottom: 15,
      left: 0
    }
  }
});

// Pie Chart configurations
const getPieChartProps = (theme: string) => ({
  nameKey: 'name',
  valueKey: 'value',
  theme,
  height: 250,
  labels: {
    title: 'Product Distribution'
  },
  options: {
    legend: {
      orient: 'horizontal',
      bottom: 0,
      type: 'scroll'
    },
    series: {
      radius: ['45%', '70%'],
      center: ['50%', '45%']
    }
  }
});

const getDonutChartProps = (theme: string) => ({
  nameKey: 'name',
  valueKey: 'value',
  theme,
  height: 200,
  options: {
    title: {
      show: true,
      text: 'Product Distribution',
      left: 'center',
      top: '10px', 
      textStyle: {
        color: '#333',
        fontSize: 16
      },
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      type: 'scroll'
    },
    series: {
      radius: ['45%', '70%'],
      center: ['50%', '55%']
    }
  }
});

// Scatter Chart configuration
const getScatterPlotProps = (theme: string) => ({
  option: {
    xAxis: { type: 'value', name: 'Height (cm)' },
    yAxis: { type: 'value', name: 'Weight (kg)' },
    grid: {
      top: 40,
      right: 5,
      bottom: 20,
      left: 30
    },
    series: [{
      type: 'scatter',
      symbolSize: 10,
      data: chartData.scatterData
    }]
  },
  theme,
  height: 350
});

// YoY Comparison Bar Chart configuration
const getYoYComparisonBarProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme: theme,
  height: 440,
  showValues: true,
  valueFormatter: (value: number) => `${value.toFixed(1)}`,
  valueFontSize: 11,
  valueFontWeight: 'bold',
  valuePosition: 'top',
  valueDistance: 5,
  highlightIndices: [],
  highlightColor: '#333333',
  showChangeIndicators: true,
  changePercentages: chartData.yoyChangePercentages,
  showMonthOverMonthChange: false,
  showOverallGrowth: false,
  annotations: [],
  acpyLabels: true,
  previousYearData: chartData.yoyPreviousYearData,
  previousYearKey: 'value',
  showPreviousYear: true,
  previousYearOpacity: 0.9,
  highlightExceeded: false,
  exceededColor: '#333333',
  negativeVarianceColor: '#e74c3c',
  positiveVarianceColor: '#3ab45b',
  barColor: '#333333',
  previousYearBarColor: '#333333',
  percentageFontSize: 10,
  percentageFontWeight: 'bold',
  negativeOnly: false,
  labels: {
    title: 'AC vs PY Comparison',
    xAxis: '',
    yAxis: ''
  },
  options: {
    backgroundColor: '#ffffff',
    color: ['#333333'],
    grid: {
      top: 50,
      right: 30,
      bottom: 20,
      left: 40,
      containLabel: true
    },
    tooltipFormatter: function(params: any) {
      if (Array.isArray(params)) {
        params = params[0]; // Get the first item if it's an array
      }
      
      const index = params.dataIndex;
      const acValue = chartData.yoyBarChartData[index]?.value || 0;
      const pyValue = chartData.yoyPreviousYearData[index]?.value || 0;
      const change = chartData.yoyChangePercentages.find(c => c.index === index);
      const percentChange = change ? change.value.toFixed(1) : '0.0';
      const percentColor = change && change.value >= 0 ? '#3ab45b' : '#e74c3c';
      
      return `
        <div style="padding: 5px 10px;">
          <div style="font-weight: bold; margin-bottom: 5px;">${params.name}</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>AC:</span>
            <span style="font-weight: bold;">${acValue.toFixed(1)}K</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>PY:</span>
            <span style="font-weight: bold;">${pyValue.toFixed(1)}K</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: ${percentColor}; font-weight: bold; margin-top: 5px; border-top: 1px solid rgba(200,200,200,0.3); padding-top: 5px;">
            <span>YoY:</span>
            <span>${change && change.value >= 0 ? '+' : ''}${percentChange}%</span>
          </div>
        </div>
      `;
    },
    yAxis: {
      max: function(value: { max: number }) {
        return Math.ceil(value.max * 1.3); // Add 30% space above the highest bar for arrows
      },
      min: 0,
      axisLabel: {
        formatter: '{value}',
        color: '#666666'
      },
      splitLine: {
        show: true,
        lineStyle: {
          type: 'solid',
          width: 1,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 0,
        fontSize: 11,
        color: '#666666'
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: '#cccccc'
        }
      },
      splitLine: {
        show: false
      }
    },
    itemStyle: {
      color: '#333333',
      borderRadius: [0, 0, 0, 0]
    }
  }
});

// Enhanced Area Chart configuration
const getEnhancedAreaChartProps = (theme: string) => ({
  xKey: 'category',
  yKey: 'value',
  theme,
  height: 400,
  smooth: false,
  showSymbol: true,
  showValues: true,
  valueFormatter: (value: number) => `${value.toFixed(1)}M`,
  previousYearData: chartData.previousYearMonthlyData,
  previousYearKey: 'value',
  showOverallGrowth: true,
  overallGrowthValue: '+19.7%',
  overallGrowthPosition: 'topRight',
  acColor: '#000000', // Black for AC line
  positiveAreaColor: '#8DC21F',
  pyColor: '#e0e0e0',
  lowerColor: '#FF6666',
  highlightIndex: 8, // September (0-indexed)
  highlightColor: '#FF6666',
  highlightMaxValue: true, // Enable highlighting of the max value
  maxValueColor: '#1890ff', // Light blue highlight for max value
  showConnectingLines: true,
  connectingLineColor: '#dddddd',
  connectingLineWidth: 1,
  connectingLineStyle: 'dashed',
  showPyLabels: false, // Hide PY value labels
  labels: {
    title: 'Monthly Performance (AC vs PY)',
    xAxis: '',
    yAxis: ''
  },
  options: {
    grid: {
      top: 60,
      right: 60,
      bottom: 40,
      left: 40,
      backgroundColor: 'rgba(255,255,255,0.02)'
    },
    yAxis: {
      min: 0,
      max: 50,
      interval: 10,
      axisLabel: {
        formatter: '{value}M',
        fontSize: 12,
        padding: [0, 15, 0, 0]
      }
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 0,
        fontSize: 11,
        margin: 14
      }
    }
  }
});

// Define chart categories
export const chartTypeCategories: ChartCategory[] = [
  {
    id: 'bar',
    name: 'Bar Charts',
    icon: BarChart2,
    charts: [
      {
        id: 'basic-bar',
        name: 'Bar Chart',
        component: BarChart,
        description: 'Visualize data using rectangular bars with heights proportional to values',
        sampleData: chartData.barChartData,
        props: getBarChartProps,
        tags: ['bar', 'basic', 'vertical', 'comparison']
      },
      {
        id: 'stacked-bar',
        name: 'Stacked Bar Chart',
        component: StackedBarChart,
        description: 'Compare multiple data series on top of each other',
        sampleData: chartData.stackedBarData,
        props: getStackedBarProps,
        tags: ['bar', 'stacked', 'multi-series']
      },
      {
        id: 'waterfall-chart',
        name: 'Waterfall Chart',
        component: WaterfallChart,
        description: 'Display variance analysis showing positive and negative changes over time or categories',
        sampleData: chartData.waterfallData,
        props: getWaterfallProps,
        tags: ['waterfall', 'variance', 'bridge', 'positive-negative']
      },
      {
        id: 'bridge-chart',
        name: 'Bridge Chart',
        component: BridgeChart,
        description: 'Display financial variance and progression from starting to ending values with incremental changes. Features axis break for large value differences.',
        sampleData: chartData.bridgeData,
        props: getBridgeProps,
        tags: ['bridge', 'financial', 'variance', 'waterfall', 'positive-negative']
      },
      {
        id: 'bar-variance',
        name: 'Bar Variance Chart',
        component: BarVarianceChart,
        description: 'Display positive and negative variances with bars and appropriate color coding',
        sampleData: chartData.barVarianceData,
        props: getBarVarianceProps,
        tags: ['bar', 'variance', 'positive-negative']
      },
      {
        id: 'horizontal-bar',
        name: 'Horizontal Bar Chart',
        component: HorizontalBarChart,
        description: 'Display data values as horizontal bars with city names',
        sampleData: chartData.horizontalBarData,
        props: getHorizontalBarProps,
        tags: ['bar', 'horizontal', 'cities', 'comparison']
      },
      {
        id: 'yoy-comparison-bar-chart',
        name: 'Year-over-Year Comparison Bar Chart',
        component: YoYComparisonBarChart,
        description: 'Advanced bar chart showing current vs previous year data with negative variance indicators.',
        sampleData: chartData.yoyBarChartData,
        props: getYoYComparisonBarProps,
        tags: ['bar', 'column', 'comparison', 'year-over-year', 'variance', 'PY'],
        categoryId: 'bar-charts',
        categoryName: 'Bar Charts'
      }
    ]
  },
  {
    id: 'line',
    name: 'Line Charts',
    icon: LineChartIcon,
    charts: [
      {
        id: 'basic-line',
        name: 'Line Chart',
        component: LineChart,
        description: 'Display information as a series of data points connected by straight lines',
        sampleData: chartData.lineChartData,
        props: getLineChartProps,
        tags: ['line', 'trend', 'basic']
      },
      {
        id: 'area',
        name: 'Area Chart',
        component: AreaChart,
        description: 'Show how values evolve over time with filled areas below the line',
        sampleData: chartData.lineChartData,
        props: getAreaChartProps,
        tags: ['area', 'trend', 'shaded']
      },
      {
        id: 'enhanced-area-chart',
        name: 'Enhanced Area Chart',
        component: EnhancedAreaChart,
        description: 'Advanced visualization that displays AC vs PY performance with colored areas, dynamic highlighting, and growth indicators.',
        sampleData: chartData.monthlyPerformanceData,
        props: getEnhancedAreaChartProps,
        tags: ['area', 'enhanced', 'comparison', 'performance', 'growth']
      }
    ]
  },
  {
    id: 'pie',
    name: 'Pie Charts',
    icon: PieChartIcon,
    charts: [
      {
        id: 'basic-pie',
        name: 'Pie Chart',
        component: PieChart,
        description: 'Show composition as portions of a whole in a circular graph',
        sampleData: chartData.pieChartData,
        props: getPieChartProps,
        tags: ['pie', 'proportion', 'basic']
      },
      {
        id: 'donut',
        name: 'Donut Chart',
        component: DonutChart,
        description: 'A pie chart with a hole in the center for additional information',
        sampleData: chartData.pieChartData,
        props: getDonutChartProps,
        tags: ['donut', 'pie', 'proportion']
      }
    ]
  },
  {
    id: 'scatter',
    name: 'Scatter Charts',
    icon: ScatterChart,
    charts: [
      {
        id: 'scatter-plot',
        name: 'Scatter Plot',
        component: BaseChart,
        description: 'Display values for two variables as points in a Cartesian coordinate system',
        sampleData: null,
        props: getScatterPlotProps,
        tags: ['scatter', 'statistical', 'correlation']
      }
    ]
  },
  {
    id: 'radar',
    name: 'Radar Charts',
    icon: Radar,
    charts: [
      {
        id: 'radar-chart',
        name: 'Radar Chart',
        component: BaseChart,
        description: 'Display multivariate data as a two-dimensional chart with three or more variables',
        sampleData: null,
        props: (theme: string) => ({
          option: {
            radar: {
              indicator: [
                { name: 'Sales', max: 10000 },
                { name: 'Marketing', max: 10000 },
                { name: 'Development', max: 10000 },
                { name: 'Customer Support', max: 10000 },
                { name: 'HR', max: 10000 },
                { name: 'Administration', max: 10000 }
              ]
            },
            series: [{
              type: 'radar',
              data: [
                {
                  value: [4300, 5800, 6900, 9000, 3500, 8000],
                  name: 'Allocated Budget'
                },
                {
                  value: [5000, 7000, 8000, 5000, 4000, 7000],
                  name: 'Actual Spending'
                }
              ]
            }]
          },
          theme,
          height: 300
        }),
        tags: ['radar', 'comparison', 'multivariate']
      }
    ]
  }
];

// Flatten all charts for search
export const allCharts = chartTypeCategories.flatMap(category => 
  category.charts.map(chart => ({ ...chart, categoryId: category.id, categoryName: category.name }))
);

// Add backward compatibility for old chart IDs
export const chartsBackwardCompatibility = [
  { oldId: 'bar-chart', newId: 'basic-bar' },
  { oldId: 'line-chart', newId: 'basic-line' },
  { oldId: 'pie-chart', newId: 'basic-pie' },
  { oldId: 'area-chart', newId: 'area' }
];

// Add backward compatibility charts to allCharts
chartsBackwardCompatibility.forEach(({ oldId, newId }) => {
  const originalChart = allCharts.find(chart => chart.id === newId);
  if (originalChart) {
    // Clone the chart with the old ID
    allCharts.push({
      ...originalChart,
      id: oldId
    });
  }
}); 