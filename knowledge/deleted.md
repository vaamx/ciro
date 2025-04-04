
interface AnalyticalResponse {
  summary: string;
  analysis?: string;
  steps: Array<{
    id: string | number;
    type?: string;
    description?: string;
    content: string;
    order?: number;
    data?: any;
  }>;
  insights: string[];
  visualization?: any;
  visualizations?: Array<{
    type: string;
    config: Record<string, any>;
  }>;
}



  const handleAddToDashboard = (config: any) => {
    console.log('Adding visualization to dashboard with config:', config);
    
    if (!config || !config.data || !Array.isArray(config.data) || config.data.length === 0) {
      showCustomToast('Invalid visualization data', 'error');
      return;
    }
    
    // Log the raw data for debugging
    console.log('Visualization data to be added to dashboard:', JSON.stringify(config.data));
    
    try {
      // Make sure we have valid x and y keys
      const xKey = config.xKey || (config.data[0] ? Object.keys(config.data[0])[0] : 'category');
      const yKey = config.yKey || (config.data[0] ? Object.keys(config.data[0])[1] : 'value');
      
      console.log(`Using xKey: ${xKey}, yKey: ${yKey}`);
      
      // Deep clone the data to avoid any reference issues
      const safeData = JSON.parse(JSON.stringify(config.data));
      
      // Validate the data has the required keys
      const validatedData = safeData.map((item: any) => {
        const newItem = {...item};
        if (typeof newItem[xKey] === 'undefined') {
          newItem[xKey] = 'Unknown';
        }
        if (typeof newItem[yKey] === 'undefined' || isNaN(Number(newItem[yKey]))) {
          newItem[yKey] = 0;
        }
        return newItem;
      });
      
      console.log('Validated data:', validatedData);
      
      // Prepare the color scheme
      const colors = [
      'rgba(54, 162, 235, 0.7)',  // Blue
      'rgba(255, 99, 132, 0.7)',  // Red
      'rgba(255, 206, 86, 0.7)',  // Yellow
        'rgba(75, 192, 192, 0.7)',   // Green
      'rgba(153, 102, 255, 0.7)', // Purple
        'rgba(255, 159, 64, 0.7)',   // Orange
        'rgba(46, 204, 113, 0.7)'    // Green
      ];
      
      const borderColors = colors.map(color => color.replace('0.7', '1'));
      
      // Create a unique ID for the widget
      const widgetId = `viz-${Date.now()}`;
      
      // Create the new widget with the visualization data - using proper Widget type with exact "visualization-widget" content value
      const newWidget: Widget = {
        id: widgetId,
        content: "visualization-widget", // This MUST match exactly what WidgetManager expects
        type: "visualization-widget", // Must match for consistency
        widget_type: "visualization-widget", // Required for backend
        title: config.labels?.title || "Analysis Visualization",
        size: "medium", // Valid value from Widget type
        settings: {
          visualization: {
            type: config.type || "bar",
            data: validatedData,
            xKey: xKey,
            yKey: yKey,
            series: config.series || [
              {
                dataKey: yKey,
                name: config.labels?.yAxis || yKey || "Value"
              }
            ],
            labels: {
              title: config.labels?.title || "Analysis Visualization",
              xAxis: config.labels?.xAxis || xKey,
              yAxis: config.labels?.yAxis || yKey
            },
            options: {
              useMultipleColors: config.type === 'bar' ? true : false,
              colors: colors,
              borderColors: borderColors,
              theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
            }
          },
          refreshInterval: 0,
          showTitle: true,
          expandable: true
        },
        position: Math.floor(Math.random() * 1000) // Use position for proper ordering
      };
      
      console.log('Created widget with settings:', JSON.stringify(newWidget.settings, null, 2));
      
      // Attempt to get dashboard context from window
      if (window.dashboardContext) {
        console.log('Dashboard context found, updating widgets');
        
        // Get current dashboard and its widgets
        const currentDashboard = window.dashboardContext.currentDashboard;
        if (currentDashboard) {
          const updatedWidgets = [...currentDashboard.widgets, newWidget];
          console.log('Updated widgets:', updatedWidgets.length);
          
          // Update the dashboard
          window.dashboardContext.updateWidgets(updatedWidgets)
            .then(() => {
              console.log('Widgets updated successfully');
              showCustomToast('Visualization added to dashboard', 'success');
              
              // Set a timeout to refresh the dashboard after the widget is added
              setTimeout(() => {
                refreshDashboard();
              }, 1000);
            })
            .catch((err: any) => {
              console.error('Error updating dashboard:', err);
              showCustomToast(`Failed to add visualization: ${err.message || 'Unknown error'}`, 'error');
            });
        } else {
          showCustomToast('No active dashboard found', 'error');
        }
      } else {
        showCustomToast('Dashboard context not available', 'error');
      }
    } catch (error: any) {
      console.error('Error adding visualization to dashboard:', error);
      showCustomToast(`Failed to add visualization: ${error.message || 'Unknown error'}`, 'error');
    }
  };
  
  // Function to force a refresh of the dashboard
  const refreshDashboard = () => {
    console.log('Forcing dashboard refresh');
    
    try {
      // Method 1: Dispatch resize events to force Chart.js to redraw
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          console.log(`Dispatched resize event ${i+1}`);
          window.dispatchEvent(new Event('resize'));
        }, i * 200);
      }
      
      // Method 2: Use the dashboard context to update widgets with a timestamp
      if (window.dashboardContext) {
        console.log('Found dashboard context, attempting to force refresh');
        const currentDashboard = window.dashboardContext.currentDashboard;
        
        if (currentDashboard && currentDashboard.widgets) {
          console.log(`Current dashboard has ${currentDashboard.widgets.length} widgets`);
          
          // Add a refresh timestamp to trigger re-renders
          const updatedWidgets = currentDashboard.widgets.map(widget => ({
            ...widget,
            _refreshTimestamp: Date.now() // Add timestamp to force re-render
          }));
          
          window.dashboardContext.updateWidgets(updatedWidgets)
            .then(() => {
              console.log('Successfully updated widgets with refresh timestamps');
            })
            .catch((err: any) => {
              console.error('Error updating widgets for refresh:', err);
            });
        }
      }
      
      // Method 3: Try direct DOM manipulation as a last resort
      // Try multiple selector approaches to find visualization widgets
      setTimeout(() => {
        const selectors = [
          '.visualization-widget',
          '.visualization-widget-container',
          '[class*="visualization"]',
          '.draggable-widget'
        ];
        
        let elements: NodeListOf<Element> | null = null;
        
        // Try each selector until we find elements
        for (const selector of selectors) {
          elements = document.querySelectorAll(selector);
          if (elements && elements.length > 0) {
            console.log(`Found ${elements.length} visualization widgets using selector: ${selector}`);
            break;
          }
        }
        
        if (!elements || elements.length === 0) {
          console.log('Found 0 visualization widgets to refresh');
          return;
        }
        
        // Force refresh on each element
        elements.forEach((element, index) => {
          try {
            const htmlElement = element as HTMLElement;
            
            // Force layout recalculation
            // Using void to indicate we're intentionally not using the offsetHeight value
            // This avoids the linter error for the unused variable
            void htmlElement.offsetHeight;
            
            // Apply and remove a class to force refresh
            htmlElement.classList.add('refresh-visualization');
            setTimeout(() => {
              htmlElement.classList.remove('refresh-visualization');
            }, 100);
            
            // Find and refresh any canvas elements
            const canvases = htmlElement.querySelectorAll('canvas');
            console.log(`Found ${canvases.length} canvas elements in widget ${index}`);
            
            if (canvases.length > 0) {
              canvases.forEach(canvas => {
                // Force canvas redraw
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
                
                // Trick to force chart.js to redraw
                const currentWidth = canvas.style.width;
                canvas.style.width = '99%';
                setTimeout(() => {
                  canvas.style.width = currentWidth || '100%';
                }, 50);
              });
            }
          } catch (err) {
            console.error(`Error refreshing visualization widget ${index}:`, err);
          }
        });
      }, 500);
    } catch (error) {
      console.error('Error during dashboard refresh:', error);
    }
  };

  // Function to show a custom toast notification
  const showCustomToast = (message: string, type: 'success' | 'error' | 'info') => {
    console.log('Showing custom toast notification:', message, type);
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'custom-toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.right = '20px';
      toastContainer.style.zIndex = '9999';
      document.body.appendChild(toastContainer);
      
      console.log('Created toast container:', toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.style.minWidth = '300px';
    toast.style.margin = '10px';
    toast.style.padding = '16px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.fontFamily = 'Inter, system-ui, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    // Set colors based on type
    if (type === 'success') {
      toast.style.backgroundColor = '#10B981';
      toast.style.color = 'white';
      toast.style.borderLeft = '4px solid #059669';
    } else if (type === 'error') {
      toast.style.backgroundColor = '#EF4444';
      toast.style.color = 'white';
      toast.style.borderLeft = '4px solid #B91C1C';
    } else {
      toast.style.backgroundColor = '#3B82F6';
      toast.style.color = 'white';
      toast.style.borderLeft = '4px solid #2563EB';
    }
    
    // Add icon based on type
    const icon = document.createElement('div');
    icon.style.marginRight = '12px';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.width = '24px';
    icon.style.height = '24px';
    
    if (type === 'success') {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    } else if (type === 'error') {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
    } else {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `;
    }
    
    // Add message
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.flex = '1';
    
    // Add close button
    const closeButton = document.createElement('div');
    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeButton.style.marginLeft = '12px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.opacity = '0.7';
    closeButton.style.transition = 'opacity 0.2s';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    
    closeButton.onmouseover = () => {
      closeButton.style.opacity = '1';
    };
    
    closeButton.onmouseout = () => {
      closeButton.style.opacity = '0.7';
    };
    
    closeButton.onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    };
    
    // Append elements to toast
    toast.appendChild(icon);
    toast.appendChild(messageElement);
    toast.appendChild(closeButton);
    
    // Append toast to container
    toastContainer.appendChild(toast);
    
    console.log('Toast element created and appended:', toast);
    
    // Show toast
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
      console.log('Toast should be visible now');
    }, 10);
    
    // Auto-hide toast after 5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  };

  const handleExport = (config: any) => {
    try {
      // Create a CSV string from the data
      const data = config.data || [];
      if (!data.length) {
        showCustomToast('No data to export', 'error');
        return;
      }
      
      // Get headers from the first data item
      const headers = Object.keys(data[0]);
      
      // Create CSV content
      let csvContent = headers.join(',') + '\n';
      
      // Add data rows
      data.forEach((item: any) => {
        const row = headers.map(header => {
          const value = item[header];
          // Handle strings with commas by wrapping in quotes
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',');
        csvContent += row + '\n';
      });
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'visualization_data.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success notification with custom toast
      showCustomToast('Data exported successfully', 'success');
      
      // Use the showNotification from useNotification hook
      showNotification({
          type: 'success',
          message: 'Data exported successfully'
        });
      
        // Fallback to window object if hook fails
        // @ts-ignore - notificationContext is added to window by the NotificationProvider
        if (window.notificationContext && window.notificationContext.showNotification) {
          window.notificationContext.showNotification({
            type: 'success',
            message: 'Data exported successfully'
          });
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      
      // Show error notification with custom toast
      showCustomToast('Failed to export data', 'error');
      
      // Use the showNotification from useNotification hook
      showNotification({
          type: 'error',
          message: 'Failed to export data'
        });
    }
  };


import { useNotification } from '../../../contexts/NotificationContext';
import { marked } from 'marked';

const SimpleVisualization = (props: any) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Updated color palette with better transparency to match the reference image
  const vibrantColors = [
    'rgba(255, 99, 132, 0.7)',   // Pink/Red
    'rgba(54, 162, 235, 0.7)',   // Blue
    'rgba(255, 206, 86, 0.7)',   // Yellow
    'rgba(75, 192, 192, 0.7)',   // Teal
    'rgba(153, 102, 255, 0.7)',  // Purple
    'rgba(255, 159, 64, 0.7)',   // Orange
    'rgba(46, 204, 113, 0.7)',   // Green
    'rgba(52, 73, 94, 0.7)'      // Dark Blue
  ];

  const vibrantBorderColors = [
    'rgba(255, 99, 132, 0.9)',
    'rgba(54, 162, 235, 0.9)',
    'rgba(255, 206, 86, 0.9)',
    'rgba(75, 192, 192, 0.9)',
    'rgba(153, 102, 255, 0.9)',
    'rgba(255, 159, 64, 0.9)',
    'rgba(46, 204, 113, 0.9)',
    'rgba(52, 73, 94, 0.9)'
  ];

  // Simulate loading and check for errors
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Validate the props
        if (!props || !props.data) {
          throw new Error('No visualization data provided');
        }
        
        if (!Array.isArray(props.data) || props.data.length === 0) {
          throw new Error('Visualization data must be a non-empty array');
        }
        
        // Check if required keys exist
        const xKey = props.xKey || Object.keys(props.data[0])[0];
        const yKey = props.yKey || Object.keys(props.data[0])[1];
        
        if (!xKey || !yKey) {
          throw new Error('Could not determine x and y keys for visualization');
        }
        
        // Validate that the keys exist in the data
        const sampleItem = props.data[0];
        if (typeof sampleItem[xKey] === 'undefined') {
          throw new Error(`X-axis key "${xKey}" not found in data`);
        }
        
        if (typeof sampleItem[yKey] === 'undefined') {
          throw new Error(`Y-axis key "${yKey}" not found in data`);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error in SimpleVisualization:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [props]);
  
  // Log the props for debugging
  useEffect(() => {
    console.log('SimpleVisualization props:', props);
  }, [props]);
  
  if (loading) {
    return (
      <div className="h-80 w-full animate-pulse flex flex-col justify-center items-center">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 w-32 mb-4 rounded"></div>
        <div className="h-60 bg-gray-200 dark:bg-gray-700 w-full rounded mb-4"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 w-24 rounded"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-80 w-full flex flex-col justify-center items-center text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
        <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
        <h4 className="text-red-600 dark:text-red-400 font-medium mb-1">Failed to load visualization</h4>
        <p className="text-sm text-red-500 dark:text-red-300">{error.message}</p>
      </div>
    );
  }
  
  // Ensure we have valid data
  const visualizationData = props.data || [];
  if (!visualizationData.length) {
    return (
      <div className="h-80 w-full flex flex-col justify-center items-center text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
        <AlertTriangle className="h-8 w-8 text-gray-500 mb-2" />
        <h4 className="text-gray-600 dark:text-gray-400 font-medium mb-1">No data available</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">No data available for visualization</p>
      </div>
    );
  }
  
  // Create config with sensible defaults if not provided
  const config = {
    type: props.type || 'bar',
    data: visualizationData,
    width: props.width || '100%',
    height: props.height || 400,
    xKey: props.xKey || Object.keys(visualizationData[0])[0],
    yKey: props.yKey || Object.keys(visualizationData[0])[1],
    series: props.series || [{
      dataKey: props.yKey || Object.keys(visualizationData[0])[1],
      name: 'Sales' // Set to "Sales" to match the image
    }],
    labels: props.labels || {
      title: 'Analysis Visualization',
      xAxis: 'Segment',
      yAxis: 'Sales'
    },
    options: {
      ...(props.options || {}),
      // Use vibrant color palette for more colorful charts
      colors: props.options?.colors || vibrantColors,
      borderColors: props.options?.borderColors || vibrantBorderColors,
      useMultipleColors: true // Flag to use multiple colors for each bar
    }
  };
  
  console.log('Rendering visualization with config:', config);
  
  // For bar charts, directly use Chart.js instead of the Visualization component
  if (config.type === 'bar') {
    // Register required Chart.js components if not already registered
    if (!ChartJS.registry.controllers.get('bar')) {
      ChartJS.register(
        CategoryScale,
        LinearScale,
        BarElement,
        Title,
        Tooltip,
        Legend
      );
    }
    
    // Format the data correctly for Chart.js
    const labels = config.data.map((item: any) => item[config.xKey]);
    
    // Create the dataset with multiple colors
    const dataset = {
      label: config.labels.yAxis,
      data: config.data.map((item: any) => item[config.yKey]),
      backgroundColor: config.data.map((_: any, i: number) => vibrantColors[i % vibrantColors.length]),
      borderColor: config.data.map((_: any, i: number) => vibrantBorderColors[i % vibrantBorderColors.length]),
      borderWidth: 1,
      borderRadius: 0, // Remove rounded corners
      barPercentage: 0.8, // Slightly thinner bars
      categoryPercentage: 0.8 // More space between bars
    };
    
    const chartData = {
      labels,
      datasets: [dataset]
    };
    
    // Log the chart data for debugging
    console.log('Chart data:', chartData);
    
    // Detect if we're in dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Get the background color from the parent element
    const getBackgroundColor = () => {
      // For light mode, use a light blue background similar to the reference image
      if (!isDarkMode) {
        return 'rgba(240, 247, 255, 0.8)';
      }
      // For dark mode, use a dark blue background
      return 'rgba(15, 23, 42, 0.8)';
    };
    
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          align: 'center' as const,
          labels: {
            boxWidth: 40,
            boxHeight: 15,
            padding: 20,
            font: {
              size: 12,
              family: 'Inter, system-ui, sans-serif'
            },
            color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
          }
        },
        title: {
          display: false, // Remove secondary title
          text: config.labels.title,
          font: {
            size: 16,
            weight: 'bold' as const,
            family: 'Inter, system-ui, sans-serif'
          },
          color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
          padding: {
            top: 10,
            bottom: 20
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
          intersect: false,
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
          bodyColor: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 4,
          titleFont: {
            size: 14,
            weight: 'normal' as const
          },
          bodyFont: {
            size: 13
          },
          displayColors: true,
          boxWidth: 10,
          boxHeight: 10,
          boxPadding: 3
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.1)',
            drawBorder: false,
            lineWidth: 1
          },
          border: {
            display: false
          },
          ticks: {
            padding: 10,
            font: {
              size: 11,
              family: 'Inter, system-ui, sans-serif'
            },
            color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
          },
          title: {
            display: false, // Remove Y axis title
            text: config.labels.yAxis,
            font: {
              size: 12,
              family: 'Inter, system-ui, sans-serif'
            },
            color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
            padding: {
              bottom: 10
            }
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          border: {
            display: false
          },
          ticks: {
            padding: 10,
            font: {
              size: 11,
              family: 'Inter, system-ui, sans-serif'
            },
            color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
          },
          title: {
            display: false, // Remove X axis title
            text: config.labels.xAxis,
            font: {
              size: 12,
              family: 'Inter, system-ui, sans-serif'
            },
            color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
            padding: {
              top: 10
            }
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart' as const
      }
    };
    
    return (
      <div 
        style={{ 
          height: config.height, 
          width: config.width,
          backgroundColor: getBackgroundColor(),
          borderRadius: '0.5rem',
          padding: '1rem'
        }}
      >
        <Bar data={chartData} options={chartOptions} />
      </div>
    );
  }
  
  // For other chart types, try to use the Visualization component
  try {
    // Dynamically import the Visualization component
    const VisualizationComponent = React.lazy(() => 
      import('../../../components/Visualization').then(module => ({ 
        default: module.Visualization 
      }))
    );
    
    return (
      <React.Suspense fallback={<div>Loading...</div>}>
        <VisualizationComponent 
          type={config.type} 
          config={config} 
          className="h-80" 
        />
      </React.Suspense>
    );
  } catch (err) {
    console.error('Failed to load Visualization component:', err);
    return (
      <div className="h-80 w-full flex flex-col justify-center items-center text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
        <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
        <h4 className="text-red-600 dark:text-red-400 font-medium mb-1">Failed to load visualization</h4>
        <p className="text-sm text-red-500 dark:text-red-300">
          {err instanceof Error ? err.message : 'Unknown error'}
        </p>
      </div>
    );
  }
};
