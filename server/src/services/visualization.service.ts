import { VisualizationType } from './analytics-processor.service';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
  [key: string]: any;
}

interface TimeSeriesDataPoint extends DataPoint {
  date: string | Date;
}

interface MultiSeriesDataPoint {
  category: string;
  series: {
    name: string;
    value: number;
  }[];
}

// New interfaces for extended visualization types

/**
 * Data structure for network graph nodes
 */
interface NetworkNode {
  id: string;
  label: string;
  value?: number; // Size of the node
  color?: string;
  group?: string; // For grouping nodes
  [key: string]: any;
}

/**
 * Data structure for network graph edges/links
 */
interface NetworkEdge {
  source: string; // Source node id
  target: string; // Target node id
  value?: number; // Strength/weight of connection
  label?: string;
  color?: string;
  [key: string]: any;
}

/**
 * Data structure for geospatial map points
 */
interface GeoPoint {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  value?: number; // For determining point size/color intensity
  color?: string;
  [key: string]: any;
}

/**
 * Data structure for Sankey diagram nodes
 */
interface SankeyNode {
  id: string;
  label: string;
  color?: string;
  [key: string]: any;
}

/**
 * Data structure for Sankey diagram links
 */
interface SankeyLink {
  source: string; // Source node id
  target: string; // Target node id
  value: number; // Flow volume
  color?: string;
  [key: string]: any;
}

/**
 * Data structure for funnel chart stages
 */
interface FunnelStage {
  label: string;
  value: number;
  color?: string;
  percentage?: number; // Conversion rate from previous stage
  [key: string]: any;
}

/**
 * Service to generate visualization configurations for different chart types
 */
export class VisualizationService {
  private static instance: VisualizationService;

  private readonly defaultColors = [
    '#4299E1', // blue
    '#48BB78', // green
    '#F56565', // red
    '#ED8936', // orange
    '#9F7AEA', // purple
    '#667EEA', // indigo
    '#F687B3', // pink
    '#4FD1C5', // teal
    '#B794F4', // light purple
    '#FC8181', // light red
    '#68D391', // light green
    '#63B3ED'  // light blue
  ];

  private constructor() {}

  public static getInstance(): VisualizationService {
    if (!VisualizationService.instance) {
      VisualizationService.instance = new VisualizationService();
    }
    return VisualizationService.instance;
  }

  /**
   * Creates a pie chart configuration
   */
  public createPieChartConfig(
    data: DataPoint[],
    title = 'Pie Chart',
    includePercentages = true
  ): Record<string, any> {
    // Add colors if not present
    const coloredData = data.map((point, index) => ({
      ...point,
      color: point.color || this.defaultColors[index % this.defaultColors.length]
    }));

    return {
      type: 'pie',
      data: {
        labels: coloredData.map(d => d.label),
        datasets: [{
          data: coloredData.map(d => d.value),
          backgroundColor: coloredData.map(d => d.color)
        }]
      },
      options: {
        title: {
          display: true,
          text: title
        },
        tooltips: {
          callbacks: {
            label: function(tooltipItem: any, chartData: any) {
              const dataset = chartData.datasets[tooltipItem.datasetIndex];
              const value = dataset.data[tooltipItem.index];
              const total = dataset.data.reduce((acc: number, val: number) => acc + val, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return includePercentages 
                ? `${chartData.labels[tooltipItem.index]}: ${value} (${percentage}%)`
                : `${chartData.labels[tooltipItem.index]}: ${value}`;
            }
          }
        }
      },
      displayData: coloredData
    };
  }

  /**
   * Creates a bar chart configuration
   */
  public createBarChartConfig(
    data: DataPoint[],
    title = 'Bar Chart',
    horizontal = false,
    stacked = false
  ): Record<string, any> {
    return {
      type: horizontal ? 'horizontalBar' : 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map((d, i) => d.color || this.defaultColors[i % this.defaultColors.length])
        }]
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          xAxes: [{
            stacked: stacked,
            ticks: {
              beginAtZero: true
            }
          }],
          yAxes: [{
            stacked: stacked,
            ticks: {
              beginAtZero: true
            }
          }]
        }
      },
      displayData: data
    };
  }

  /**
   * Creates a multi-series bar chart configuration
   */
  public createMultiSeriesBarChartConfig(
    data: MultiSeriesDataPoint[],
    title = 'Comparison Chart',
    horizontal = false
  ): Record<string, any> {
    // Get all series names
    const seriesNames = new Set<string>();
    data.forEach(item => {
      item.series.forEach(series => {
        seriesNames.add(series.name);
      });
    });
    
    // Create dataset for each series
    const datasets = Array.from(seriesNames).map((name, index) => {
      return {
        label: name,
        data: data.map(item => {
          const series = item.series.find(s => s.name === name);
          return series ? series.value : 0;
        }),
        backgroundColor: this.defaultColors[index % this.defaultColors.length]
      };
    });

    return {
      type: horizontal ? 'horizontalBar' : 'bar',
      data: {
        labels: data.map(d => d.category),
        datasets
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          xAxes: [{
            ticks: {
              beginAtZero: true
            }
          }],
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      },
      displayData: data
    };
  }

  /**
   * Creates a line chart configuration
   */
  public createLineChartConfig(
    data: TimeSeriesDataPoint[],
    title = 'Line Chart',
    smoothing = false
  ): Record<string, any> {
    // Sort data by date
    const sortedData = [...data].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return {
      type: 'line',
      data: {
        labels: sortedData.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          data: sortedData.map(d => d.value),
          backgroundColor: 'rgba(66, 153, 225, 0.2)', // light blue
          borderColor: '#4299E1', // blue
          borderWidth: 2,
          pointBackgroundColor: '#4299E1',
          tension: smoothing ? 0.4 : 0 // Apply curve tension if smoothing is true
        }]
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          xAxes: [{
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM D'
              }
            }
          }],
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      },
      displayData: sortedData
    };
  }

  /**
   * Creates a multi-series line chart configuration
   */
  public createMultiSeriesLineChartConfig(
    data: {
      series: string;
      data: TimeSeriesDataPoint[];
    }[],
    title = 'Trends Over Time'
  ): Record<string, any> {
    const datasets = data.map((series, index) => {
      const color = this.defaultColors[index % this.defaultColors.length];
      return {
        label: series.series,
        data: series.data.map(d => ({
          x: new Date(d.date),
          y: d.value
        })),
        backgroundColor: `${color}33`, // 20% opacity
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color
      };
    });

    return {
      type: 'line',
      data: {
        datasets
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          xAxes: [{
            type: 'time',
            time: {
              unit: 'day'
            }
          }],
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      },
      displayData: data
    };
  }

  /**
   * Creates a radar chart configuration
   */
  public createRadarChartConfig(
    data: DataPoint[],
    title = 'Radar Chart'
  ): Record<string, any> {
    return {
      type: 'radar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: 'rgba(102, 126, 234, 0.2)', // light indigo
          borderColor: '#667EEA', // indigo
          pointBackgroundColor: '#667EEA'
        }]
      },
      options: {
        title: {
          display: true,
          text: title
        }
      },
      displayData: data
    };
  }

  /**
   * Creates a scatter plot configuration
   */
  public createScatterPlotConfig(
    data: {
      label: string;
      x: number;
      y: number;
      [key: string]: any;
    }[],
    xAxisLabel = 'X Axis',
    yAxisLabel = 'Y Axis',
    title = 'Scatter Plot'
  ): Record<string, any> {
    return {
      type: 'scatter',
      data: {
        datasets: [{
          data: data.map(d => ({
            x: d.x,
            y: d.y,
            label: d.label
          })),
          backgroundColor: '#4299E1' // blue
        }]
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          xAxes: [{
            type: 'linear',
            position: 'bottom',
            scaleLabel: {
              display: true,
              labelString: xAxisLabel
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: yAxisLabel
            }
          }]
        },
        tooltips: {
          callbacks: {
            label: function(tooltipItem: any, data: any) {
              const dataset = data.datasets[tooltipItem.datasetIndex];
              const point = dataset.data[tooltipItem.index];
              return point.label + ': (' + tooltipItem.xLabel + ', ' + tooltipItem.yLabel + ')';
            }
          }
        }
      },
      displayData: data
    };
  }

  /**
   * Creates a heatmap configuration
   */
  public createHeatmapConfig(
    data: {
      x: string;
      y: string;
      value: number;
    }[],
    title = 'Heatmap'
  ): Record<string, any> {
    // Extract unique x and y values
    const xLabels = Array.from(new Set(data.map(d => d.x)));
    const yLabels = Array.from(new Set(data.map(d => d.y)));
    
    // Create data matrix
    const dataMatrix: number[][] = [];
    for (let i = 0; i < yLabels.length; i++) {
      dataMatrix[i] = [];
      for (let j = 0; j < xLabels.length; j++) {
        const point = data.find(d => d.x === xLabels[j] && d.y === yLabels[i]);
        dataMatrix[i][j] = point ? point.value : 0;
      }
    }

    return {
      type: 'heatmap',
      data: {
        labels: xLabels,
        datasets: yLabels.map((y, i) => ({
          label: y,
          data: dataMatrix[i]
        }))
      },
      options: {
        title: {
          display: true,
          text: title
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'X Axis'
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: 'Y Axis'
            }
          }]
        }
      },
      displayData: data
    };
  }

  /**
   * Creates a table configuration
   */
  public createTableConfig(
    data: Record<string, any>[],
    title = 'Data Table',
    includedColumns?: string[]
  ): Record<string, any> {
    if (!data || data.length === 0) {
      return {
        type: 'table',
        data: {
          headers: [],
          rows: []
        },
        options: {
          title: {
            display: true,
            text: title
          }
        },
        displayData: []
      };
    }

    // Determine columns to display
    const allColumns = Object.keys(data[0]);
    const columns = includedColumns || allColumns;

    return {
      type: 'table',
      data: {
        headers: columns,
        rows: data.map(row => columns.map(col => row[col]))
      },
      options: {
        title: {
          display: true,
          text: title
        },
        paging: data.length > 10,
        pageSize: 10,
        searching: data.length > 10,
        ordering: true
      },
      displayData: data
    };
  }

  /**
   * Creates a network graph configuration
   * @param nodes The nodes in the network
   * @param edges The edges/connections between nodes
   * @param title The chart title
   * @returns Network graph configuration
   */
  public createNetworkGraphConfig(
    nodes: NetworkNode[],
    edges: NetworkEdge[],
    title = 'Network Graph'
  ): Record<string, any> {
    // Add colors to nodes if not present
    const coloredNodes = nodes.map((node, index) => ({
      ...node,
      color: node.color || this.defaultColors[index % this.defaultColors.length]
    }));

    return {
      type: 'network',
      data: {
        nodes: coloredNodes,
        edges: edges
      },
      options: {
        title: {
          display: true,
          text: title
        },
        layout: {
          hierarchical: false
        },
        nodes: {
          shape: 'dot',
          scaling: {
            min: 10,
            max: 30,
            label: {
              enabled: true,
              min: 14,
              max: 30
            }
          },
          font: {
            size: 12,
            face: 'Arial'
          }
        },
        edges: {
          width: 1,
          length: 200,
          arrows: {
            to: {
              enabled: false,
              scaleFactor: 0.5
            }
          },
          smooth: {
            enabled: true,
            type: 'continuous'
          }
        },
        physics: {
          stabilization: {
            enabled: true,
            iterations: 1000,
            updateInterval: 100
          },
          barnesHut: {
            gravitationalConstant: -80000,
            springConstant: 0.001,
            springLength: 200
          }
        },
        interaction: {
          tooltipDelay: 200,
          hideEdgesOnDrag: true,
          multiselect: true
        }
      },
      displayData: {
        nodes: coloredNodes,
        edges: edges
      }
    };
  }

  /**
   * Creates a geospatial map configuration
   * @param points The geographical points to display
   * @param title The chart title
   * @param centerLat Optional center latitude
   * @param centerLng Optional center longitude
   * @param zoom Optional initial zoom level
   * @returns Geospatial map configuration
   */
  public createGeospatialMapConfig(
    points: GeoPoint[],
    title = 'Geospatial Map',
    centerLat?: number,
    centerLng?: number,
    zoom = 3
  ): Record<string, any> {
    // Calculate center if not provided
    let center = { lat: centerLat, lng: centerLng };
    if (!centerLat || !centerLng) {
      const latSum = points.reduce((sum, point) => sum + point.latitude, 0);
      const lngSum = points.reduce((sum, point) => sum + point.longitude, 0);
      center = {
        lat: latSum / points.length,
        lng: lngSum / points.length
      };
    }

    // Add colors to points if not present
    const coloredPoints = points.map((point, index) => ({
      ...point,
      color: point.color || this.defaultColors[index % this.defaultColors.length]
    }));

    return {
      type: 'geospatial',
      data: coloredPoints,
      options: {
        title: {
          display: true,
          text: title
        },
        center,
        zoom,
        mapType: 'roadmap', // Options: 'roadmap', 'satellite', 'hybrid', 'terrain'
        markers: {
          clustering: points.length > 50,
          size: {
            min: 5,
            max: 20,
            field: 'value' // Field to use for sizing markers
          }
        },
        heatmap: {
          enabled: false,
          radius: 20,
          opacity: 0.6,
          gradient: ['rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 191, 255, 1)', 'rgba(0, 127, 255, 1)', 'rgba(0, 63, 255, 1)', 'rgba(0, 0, 255, 1)']
        }
      },
      displayData: coloredPoints
    };
  }

  /**
   * Creates a Sankey diagram configuration
   * @param nodes The nodes in the Sankey diagram
   * @param links The links between nodes
   * @param title The chart title
   * @returns Sankey diagram configuration
   */
  public createSankeyDiagramConfig(
    nodes: SankeyNode[],
    links: SankeyLink[],
    title = 'Sankey Diagram'
  ): Record<string, any> {
    // Add colors to nodes if not present
    const coloredNodes = nodes.map((node, index) => ({
      ...node,
      color: node.color || this.defaultColors[index % this.defaultColors.length]
    }));

    return {
      type: 'sankey',
      data: {
        nodes: coloredNodes,
        links: links
      },
      options: {
        title: {
          display: true,
          text: title
        },
        node: {
          padding: 15,
          width: 8,
          nodePadding: 10
        },
        link: {
          opacity: 0.5
        }
      },
      displayData: {
        nodes: coloredNodes,
        links: links
      }
    };
  }

  /**
   * Creates a funnel chart configuration
   * @param stages The stages of the funnel
   * @param title The chart title
   * @param showPercentages Whether to show conversion percentages
   * @returns Funnel chart configuration
   */
  public createFunnelChartConfig(
    stages: FunnelStage[],
    title = 'Funnel Chart',
    showPercentages = true
  ): Record<string, any> {
    // Sort stages by value in descending order if not already sorted
    const sortedStages = [...stages].sort((a, b) => b.value - a.value);
    
    // Calculate percentages if not provided
    if (showPercentages) {
      for (let i = 1; i < sortedStages.length; i++) {
        if (sortedStages[i].percentage === undefined) {
          const prevValue = sortedStages[i-1].value;
          const currValue = sortedStages[i].value;
          sortedStages[i].percentage = prevValue > 0 ? (currValue / prevValue) * 100 : 0;
        }
      }
    }
    
    // Add colors if not present
    const coloredStages = sortedStages.map((stage, index) => ({
      ...stage,
      color: stage.color || this.defaultColors[index % this.defaultColors.length]
    }));

    return {
      type: 'funnel',
      data: coloredStages,
      options: {
        title: {
          display: true,
          text: title
        },
        block: {
          dynamicHeight: true,
          minHeight: 15,
          highlight: true
        },
        tooltip: {
          enabled: true
        },
        legend: {
          enabled: true,
          position: 'right'
        },
        showPercentages
      },
      displayData: coloredStages
    };
  }

  /**
   * Creates a 3D chart configuration
   * @param data The data points
   * @param title The chart title
   * @param type The type of 3D chart ('bar', 'scatter', 'surface')
   * @returns 3D chart configuration
   */
  public create3DChartConfig(
    data: Array<{ x: number; y: number; z: number; label?: string; color?: string }>,
    title = '3D Chart',
    type: '3d_bar' | '3d_scatter' | '3d_surface' = '3d_scatter'
  ): Record<string, any> {
    // Add colors if not present
    const coloredData = data.map((point, index) => ({
      ...point,
      color: point.color || this.defaultColors[index % this.defaultColors.length]
    }));

    return {
      type: type,
      data: coloredData,
      options: {
        title: {
          display: true,
          text: title
        },
        axes: {
          x: {
            title: 'X Axis',
            range: [
              Math.min(...data.map(d => d.x)),
              Math.max(...data.map(d => d.x))
            ]
          },
          y: {
            title: 'Y Axis',
            range: [
              Math.min(...data.map(d => d.y)),
              Math.max(...data.map(d => d.y))
            ]
          },
          z: {
            title: 'Z Axis',
            range: [
              Math.min(...data.map(d => d.z)),
              Math.max(...data.map(d => d.z))
            ]
          }
        },
        camera: {
          eye: { x: 1.25, y: 1.25, z: 1.25 }
        },
        animation: {
          enabled: true,
          duration: 1000
        }
      },
      displayData: coloredData
    };
  }

  /**
   * Creates an animated chart configuration
   * @param frames The data frames for animation
   * @param baseType The base chart type
   * @param title The chart title
   * @param options Additional options
   * @returns Animated chart configuration
   */
  public createAnimatedChartConfig(
    frames: Array<{ data: any[]; timestamp: number | string; label?: string }>,
    baseType: VisualizationType,
    title = 'Animated Chart',
    options?: Record<string, any>
  ): Record<string, any> {
    // Sort frames by timestamp
    const sortedFrames = [...frames].sort((a, b) => {
      const aTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const bTime = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    // Create base chart config from the first frame
    const baseConfig = this.createVisualization(
      baseType,
      sortedFrames[0].data,
      title,
      options
    );

    return {
      type: 'animated',
      baseType,
      data: sortedFrames,
      options: {
        ...baseConfig.options,
        title: {
          display: true,
          text: title
        },
        animation: {
          duration: 500,
          easing: 'linear'
        },
        controls: {
          play: true,
          pause: true,
          stop: true,
          speed: true,
          progress: true
        },
        loop: true
      },
      displayData: sortedFrames
    };
  }

  /**
   * Creates an appropriate visualization based on the visualization type and data
   */
  public createVisualization(
    visualizationType: VisualizationType,
    data: any[],
    title?: string,
    options?: Record<string, any>
  ): Record<string, any> {
    switch (visualizationType) {
      case VisualizationType.PIE_CHART:
        return this.createPieChartConfig(data, title);
      
      case VisualizationType.BAR_CHART:
        return this.createBarChartConfig(
          data, 
          title, 
          options?.horizontal || false, 
          options?.stacked || false
        );
      
      case VisualizationType.LINE_CHART:
        return this.createLineChartConfig(
          data, 
          title, 
          options?.smoothing || false
        );
      
      case VisualizationType.SCATTER_PLOT:
        return this.createScatterPlotConfig(
          data,
          options?.xAxisLabel || 'X Axis',
          options?.yAxisLabel || 'Y Axis',
          title
        );
      
      case VisualizationType.HEATMAP:
        return this.createHeatmapConfig(data, title);
      
      case VisualizationType.TABLE:
        return this.createTableConfig(
          data, 
          title, 
          options?.includedColumns
        );
      
      case VisualizationType.RADAR_CHART:
      case VisualizationType.SPIDER_CHART: // Support both names
        return this.createRadarChartConfig(data, title);
      
      case VisualizationType.FUNNEL_CHART:
        return this.createFunnelChartConfig(
          data,
          title,
          options?.showPercentages !== false
        );
      
      case VisualizationType.NETWORK_GRAPH:
        if (options?.nodes && options?.edges) {
          return this.createNetworkGraphConfig(
            options.nodes,
            options.edges,
            title
          );
        }
        // If data is not in the expected format, convert it
        const nodes: NetworkNode[] = [];
        const edges: NetworkEdge[] = [];
        // Attempt to extract nodes and edges from data
        // This is a simplified conversion and may need to be adjusted
        data.forEach((item, index) => {
          if (item.id) {
            nodes.push({
              id: item.id,
              label: item.label || `Node ${item.id}`,
              value: item.value || 1,
              color: item.color || this.defaultColors[index % this.defaultColors.length]
            });
          }
          if (item.source && item.target) {
            edges.push({
              source: item.source,
              target: item.target,
              value: item.value || 1
            });
          }
        });
        return this.createNetworkGraphConfig(nodes, edges, title);
      
      case VisualizationType.GEOSPATIAL_MAP:
        if (options?.points) {
          return this.createGeospatialMapConfig(
            options.points,
            title,
            options.centerLat,
            options.centerLng,
            options.zoom
          );
        }
        // If data is not in the expected format, convert it
        const points: GeoPoint[] = data.map((item, index) => ({
          id: item.id || `point-${index}`,
          latitude: item.latitude || item.lat,
          longitude: item.longitude || item.lng,
          label: item.label || item.name || `Point ${index}`,
          value: item.value || 1,
          color: item.color || this.defaultColors[index % this.defaultColors.length]
        }));
        return this.createGeospatialMapConfig(points, title);
      
      case VisualizationType.SANKEY_DIAGRAM:
        if (options?.nodes && options?.links) {
          return this.createSankeyDiagramConfig(
            options.nodes,
            options.links,
            title
          );
        }
        // If no specific nodes/links provided, return empty config
        return this.createSankeyDiagramConfig([], [], title);
      
      case VisualizationType.THREE_D_CHART:
        return this.create3DChartConfig(
          data,
          title,
          options?.type || '3d_scatter'
        );
      
      case VisualizationType.ANIMATED_CHART:
        if (options?.frames && options?.baseType) {
          return this.createAnimatedChartConfig(
            options.frames,
            options.baseType,
            title,
            options
          );
        }
        // If no frames provided, create a default animated bar chart
        const frames = [{ data, timestamp: Date.now(), label: 'Current' }];
        return this.createAnimatedChartConfig(
          frames,
          VisualizationType.BAR_CHART,
          title,
          options
        );
      
      // Add more visualization types as needed
      
      default:
        // Default to table if no appropriate visualization is found
        return this.createTableConfig(data, title);
    }
  }
} 