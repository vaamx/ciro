import React, { useState, useEffect } from 'react';
import { ChatMessage } from '../types';
import { EnhancedStepByStepVisualization, AnalyticalStep } from './EnhancedStepByStepVisualization';
import { MessageMarkdown } from './MessageMarkdown';

interface VisualizationAdapterProps {
  message: ChatMessage;
  messageId: string;
}

/**
 * Visualization Adapter Component - General Purpose Implementation
 * 
 * Provides a unified interface for visualization components.
 * Handles any response and extracts structured data for visualization without hardcoded values.
 */
export const VisualizationAdapter: React.FC<VisualizationAdapterProps> = ({ 
  message 
}) => {
  const [steps, setSteps] = useState<AnalyticalStep[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizationData, setVisualizationData] = useState<any>(null);
  const [dataSourceType] = useState<string>('qdrant');
  
  /**
   * Extract structured data from text content
   * Handles various formats without any hardcoded values or domain-specific logic
   */
  const extractStructuredData = (content: string): any[] | null => {
    try {
      console.log('Extracting structured data using generic patterns');
      
      // First try to locate and parse any JSON data - highest priority
      const jsonMatches = content.match(/```json\n([\s\S]*?)\n```|`\$\{JSON\.stringify\((.*?)\)\}`/g);
      if (jsonMatches) {
        for (const match of jsonMatches) {
          try {
            // Clean up the JSON string by removing markdown code block syntax
            const cleanJson = match
              .replace(/```json\n/, '')
              .replace(/\n```/, '')
              .replace(/`\$\{JSON\.stringify\((.*?)\)\}`/, '$1')
              .trim();
            
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`Successfully parsed JSON array with ${parsed.length} items`);
              return parsed;
            } else if (typeof parsed === 'object' && parsed !== null) {
              // Handle cases where the JSON is an object with data property
              if (parsed.data && Array.isArray(parsed.data)) {
                console.log(`Found data array in JSON object with ${parsed.data.length} items`);
                return parsed.data;
              }
              // Convert object to array of key-value pairs
              console.log('Converting JSON object to Category/Value pairs');
              return Object.entries(parsed).map(([key, value]) => ({
                Category: key,
                Value: typeof value === 'number' ? value : 1
              }));
            }
          } catch (parseError) {
            console.log('Failed to parse JSON, continuing with other extraction methods');
          }
        }
      }
      
      // Handle markdown tables with objective pattern matching
      const tableMatch = content.match(/\|(.+)\|[\r\n]+\|([-:|]+\|)+[\r\n]+([\s\S]+?)(?:\n\n|\n\d+\s*|$)/g);
      if (tableMatch) {
        console.log('Found markdown table pattern');
        const tables = tableMatch.map(table => {
          // Split table into rows, filter empty rows
          const rows = table.split('\n').filter(row => row.trim() !== '' && row.includes('|'));
          
          // Skip if we don't have enough rows for a proper table
          if (rows.length < 3) {
            return null;
          }
          
          // Extract headers
          const headers = rows[0].split('|')
            .map(h => h.trim())
            .filter(h => h !== '');
          
          console.log(`Found table with headers: ${headers.join(', ')}`);
          
          // Find separator row (contains dashes or colons)
          const separatorRow = rows.findIndex(row => row.includes('-') && row.includes('|'));
          
          // Parse data rows
          const data = [];
          const startRow = separatorRow !== -1 ? separatorRow + 1 : 1;
          
          for (let i = startRow; i < rows.length; i++) {
            const cells = rows[i].split('|')
              .map(c => c.trim())
              .filter(c => c !== '');
            
            if (cells.length > 0) {
              const rowData: Record<string, any> = {};
              
              // Map cells to headers
              cells.forEach((cell, idx) => {
                if (idx < headers.length) {
                  const header = headers[idx];
                  
                  // Convert numeric values when appropriate
                  if (/^-?\d+(\.\d+)?%?$/.test(cell)) {
                    // Handle percentage values
                    if (cell.endsWith('%')) {
                      rowData[header] = parseFloat(cell.replace('%', '')) / 100;
                    } else {
                      rowData[header] = parseFloat(cell);
                    }
                  } else {
                    rowData[header] = cell;
                  }
                }
              });
              
              if (Object.keys(rowData).length > 0) {
                data.push(rowData);
              }
            }
          }
          
          if (data.length > 0) {
            console.log(`Successfully parsed ${data.length} rows from table`);
            return data;
          }
          
          return null;
        }).filter(Boolean)[0];
        
        if (tables && tables.length > 0) {
          console.log(`Extracted table with ${tables.length} rows`);
          
          // Look for Category/Value pattern which is ideal for visualization
          const hasCategoryValue = tables.some(row => 
            Object.keys(row).includes('Category') && 
            Object.keys(row).includes('Value')
          );
          
          if (hasCategoryValue) {
            console.log('Found Category/Value format suitable for visualization');
            return tables;
          }
          
          // Transform data to Category/Value format if possible
          // First find a good candidate for Category (string column) and Value (numeric column)
          const firstRow = tables[0];
          const keys = Object.keys(firstRow);
          
          // Find first string column and first numeric column
          const categoryKey = keys.find(key => typeof firstRow[key] === 'string') || keys[0];
          const valueKey = keys.find(key => typeof firstRow[key] === 'number') || keys[1] || keys[0];
          
          // Convert to Category/Value format
          return tables.map(row => ({
            Category: String(row[categoryKey]),
            Value: typeof row[valueKey] === 'number' ? row[valueKey] : 1
          }));
        }
      }
      
      // Check for key-value pairs in various formats
      const keyValuePairs: {Category: string, Value: number}[] = [];
      
      // Pattern 1: Key: Value format
      const keyValueRegex = /^([^:]+):\s*(\d+(?:\.\d+)?)\s*$/gm;
      let match;
      while ((match = keyValueRegex.exec(content)) !== null) {
        keyValuePairs.push({
          Category: match[1].trim(),
          Value: parseFloat(match[2])
        });
      }
      
      // Pattern 2: Bullet points with values
      const bulletPointRegex = /[•\-\*]\s+([^:]+):\s*(\d+(?:\.\d+)?)/g;
      while ((match = bulletPointRegex.exec(content)) !== null) {
        keyValuePairs.push({
          Category: match[1].trim(),
          Value: parseFloat(match[2])
        });
      }
      
      // Pattern 3: Any line with a colon and a number
      const anyLineRegex = /([^:\n]+):\s*(\d+(?:\.\d+)?)\s*(?:\(|$)/gm;
      while ((match = anyLineRegex.exec(content)) !== null) {
        // Skip if already captured by other patterns
        const category = match[1].trim();
        if (!keyValuePairs.some(kvp => kvp.Category === category)) {
          keyValuePairs.push({
            Category: category,
            Value: parseFloat(match[2])
          });
        }
      }
      
      if (keyValuePairs.length > 0) {
        console.log(`Extracted ${keyValuePairs.length} key-value pairs`);
        return keyValuePairs;
      }
      
      // If we get here, try to extract insights sections
      const sections = content.match(/##\s+([^\n]+)\n([\s\S]+?)(?=##|$)/g);
      if (sections) {
        for (const section of sections) {
          // Look for insights section
          if (section.toLowerCase().includes('insight') || section.toLowerCase().includes('finding')) {
            // Extract bullet points from this section
            const bulletPoints = section.match(/[•\-\*]\s+([^\n]+)/g);
            if (bulletPoints && bulletPoints.length > 0) {
              return bulletPoints.map(point => ({
                Category: point.replace(/^[•\-\*]\s+/, '').trim(),
                Value: 1 // Use 1 as a count representing existence
              }));
            }
          }
        }
      }
      
      // Last resort: extract any list items as potential data points
      const listItems = content.match(/(?:^|\n)[•\-\*]\s+([^\n]+)/g);
      if (listItems && listItems.length > 0) {
        console.log(`Found ${listItems.length} list items to use as data points`);
        return listItems.map(item => ({
          Category: item.replace(/^[•\-\*]\s+/, '').trim(),
          Value: 1
        }));
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting structured data:', error);
      return null;
    }
  };
  
  /**
   * Create visualization data from structured data
   * Uses data characteristics to determine best visualization without hardcoded values
   */
  const createVisualizationData = ({ data, requestedType = '' }: { data: any[], requestedType: string }): any | null => {
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No data provided for visualization');
      return null;
    }
    
    console.log(`Creating visualization data with type: ${requestedType || 'auto'} for ${data.length} items`);
    
    // Safety check: make sure data is an array of objects
    if (typeof data[0] !== 'object') {
      console.log('Data is not in expected format, converting to objects');
      data = data.map(item => ({ value: item }));
    }
    
    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    
    console.log('Available keys for visualization:', keys.join(', '));

    // Try to identify the best columns for visualization
    let categoryKey = '';
    let numericKey = '';
    
    // For category key, first look for "Category" key directly which is our standard
    if (keys.includes('Category')) {
      categoryKey = 'Category';
    } else {
      // Otherwise look for common category identifiers
      const categoryKeywords = [
        'category', 'name', 'type', 'group', 'label', 'segment', 'id',
        'class', 'classification', 'topic', 'entity', 'item', 'title',
        'desc', 'description', 'key', 'field'
      ];
      
      for (const keyword of categoryKeywords) {
        const matchingKey = keys.find(key => key.toLowerCase().includes(keyword));
        if (matchingKey) {
          categoryKey = matchingKey;
          break;
        }
      }
    }
    
    // For numeric key, first check for "Value" which is our standard
    if (keys.includes('Value')) {
      numericKey = 'Value';
    } else {
      // Otherwise look for numeric identifiers
      const numericKeywords = [
        'value', 'count', 'number', 'amount', 'total', 'sum', 
        'quantity', 'size', 'percentage', 'percent', 'score',
        'weight', 'frequency', 'occurrences', 'volume'
      ];
      
      // First check for keys with numeric keywords
      for (const keyword of numericKeywords) {
        const matchingKey = keys.find(key => key.toLowerCase().includes(keyword));
        if (matchingKey) {
          numericKey = matchingKey;
          break;
        }
      }
      
      // If no matching keywords, look for any numeric value column
      if (!numericKey) {
        numericKey = keys.find(key => {
          const value = firstItem[key];
          return typeof value === 'number' || 
                 (typeof value === 'string' && !isNaN(parseFloat(value)));
        }) || '';
      }
    }
    
    // If we couldn't find specific columns, use heuristics
    if (!categoryKey) {
      // Find a text column for x-axis, preferably the first column
      categoryKey = keys.find(key => 
        typeof data[0][key] === 'string' && 
        !key.toLowerCase().includes('url')
      ) || keys[0] || 'category';
    }
    
    if (!numericKey) {
      // Find a numeric column for y-axis, or use the second column
      numericKey = keys.find(key => 
        typeof data[0][key] === 'number' || 
        (!isNaN(parseFloat(data[0][key])) && typeof data[0][key] !== 'boolean')
      ) || (keys.length > 1 ? keys[1] : keys[0]) || 'value';
    }
    
    console.log(`Using category key: ${categoryKey}, numeric key: ${numericKey}`);
    
    // Convert string values to numbers if needed
    let processedData = data;
    if (numericKey && data.length > 0 && typeof data[0][numericKey] === 'string') {
      processedData = data.map(item => {
        const value = item[numericKey];
        if (typeof value === 'string') {
          // Try to extract numeric values
          const numericMatch = value.match(/(\d+(\.\d+)?)/);
          if (numericMatch) {
            return {
              ...item,
              [numericKey]: parseFloat(numericMatch[1])
            };
          }
        }
        return item;
      });
    }
    
    // Clean and normalize data
    processedData = processedData.filter(item => 
      item[categoryKey] !== undefined && 
      item[categoryKey] !== null &&
      item[numericKey] !== undefined
    );
    
    // Determine the best visualization type if not specified
    let visualizationType = requestedType;
    if (!visualizationType || visualizationType === '') {
      // Infer visualization type based on data characteristics
      
      // Look for time/date related fields for potential time series data
      const hasTimeField = keys.some(key => {
        const keyLower = key.toLowerCase();
        return keyLower.includes('date') || 
               keyLower.includes('time') || 
               keyLower.includes('year') ||
               keyLower.includes('month') ||
               keyLower.includes('day');
      });
      
      if (hasTimeField) {
        // Time-based data works best with line charts
        visualizationType = 'line';
      } else if (processedData.length <= 8) {
        // Small datasets work well with pie charts
        visualizationType = 'pie';
      } else {
        // Default to bar chart for most data
        visualizationType = 'bar';
      }
    }
    
    console.log(`Final visualization type: ${visualizationType}`);
    
    // Set appropriate data structure based on visualization type
    let formattedData = processedData;
    let chartOptions: Record<string, any> = {
      useDirectColorAssignment: true,
      useMultipleColors: true
    };
    
    // Special handling for pie charts
    if (visualizationType === 'pie') {
      chartOptions = {
        ...chartOptions,
        forceChartType: 'pie', 
        isPieChart: true,
        legend: { enabled: true }
      };
      
      // Ensure data has name and value fields for pie chart
      if (!keys.includes('name') && !keys.includes('value')) {
        formattedData = processedData.map(item => ({
          name: item[categoryKey],
          value: typeof item[numericKey] === 'string' ? parseFloat(item[numericKey]) : item[numericKey],
          ...item // preserve original data
        }));
      }
    }
    
    // Auto-generate a meaningful title based on the data
    let title = '';
    
    // Format keys for readability
    const formatKey = (key: string) => {
      return key
        .replace(/([A-Z])/g, ' $1') // Convert camelCase to spaces
        .replace(/_/g, ' ') // Remove underscores and replace with spaces
        .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
        .trim();
    };
    
    const category = formatKey(categoryKey);
    const numeric = formatKey(numericKey);
    
    // Create appropriate title based on visualization type
    if (visualizationType === 'pie') {
      title = `Distribution by ${category}`;
    } else if (visualizationType === 'bar') {
      title = `${numeric} by ${category}`;
    } else if (visualizationType === 'line') {
      title = `${numeric} Trends by ${category}`;
    } else if (visualizationType === 'scatter') {
      title = `${category} to ${numeric} Relationship`;
    }
    
    // Create visualization data
    const visualizationData = {
      type: visualizationType,
      data: formattedData,
      xKey: categoryKey,
      yKey: numericKey,
      title: title,
      options: chartOptions,
      preserveType: true  // Always preserve chart type
    };
    
    return visualizationData;
  };
  
  /**
   * Detect appropriate chart type based on query content
   * Uses general patterns without hardcoded references to specific domains
   */
  const detectChartRequest = (content: string): string => {
    if (!content) return '';
    
    const lowerContent = content.toLowerCase();
    
    // Check for explicit chart type requests
    if (lowerContent.includes('pie chart') || lowerContent.includes('piechart')) {
      return 'pie';
    } else if (lowerContent.includes('bar chart') || lowerContent.includes('barchart')) {
      return 'bar';
    } else if (lowerContent.includes('line chart') || lowerContent.includes('linechart') || lowerContent.includes('trend')) {
      return 'line';
    } else if (lowerContent.includes('scatter plot') || lowerContent.includes('scatterplot')) {
      return 'scatter';
    }
    
    // Check for semantic indicators
    if (lowerContent.includes('distribution') || 
        lowerContent.includes('breakdown') || 
        lowerContent.includes('composition')) {
      return 'pie';
    } else if (lowerContent.includes('compare') || 
              lowerContent.includes('comparison') || 
              lowerContent.includes('versus') || 
              lowerContent.includes('vs')) {
      return 'bar';
    } else if (lowerContent.includes('trend') || 
              lowerContent.includes('over time') || 
              lowerContent.includes('change') || 
              lowerContent.includes('evolution')) {
      return 'line';
    } else if (lowerContent.includes('relationship') || 
              lowerContent.includes('correlation') || 
              lowerContent.includes('between')) {
      return 'scatter';
    }
    
    return '';
  };
  
  // Process message content to extract structured data and create visualizations
  useEffect(() => {
    if (!message.content || message.status !== 'complete') {
      return;
    }

    setIsLoading(true);
    
    try {
      const userQuery = message.metadata?.userQuery as string || '';
      console.log(`Processing message content (${message.content.length} chars)`);
      console.log(`User query: ${userQuery}`);
      
      // Extract structured data from the message content
      const structuredData = extractStructuredData(message.content);
      if (structuredData && structuredData.length > 0) {
        console.log(`Extracted structured data with ${structuredData.length} items`);
        
        // Determine requested visualization type from query
        const requestedType = detectChartRequest(userQuery);
        
        // Create visualization with appropriate data
        const vizData = createVisualizationData({
          data: structuredData,
          requestedType
        });
        
        if (vizData) {
          console.log('Created visualization with type:', vizData.type);
          
          // Create analytical steps for EnhancedStepByStepVisualization
          const analyticalSteps: AnalyticalStep[] = [];
          
          // If we have a meaningful number of data points, create proper steps
          if (structuredData.length > 1) {
            // Data preparation step
            analyticalSteps.push({
              id: `step-1`,
              type: 'filtering',
              description: 'Data Preparation',
              order: 1,
              content: 'Extracting and organizing data for analysis.',
              data: structuredData
            });
            
            // Analysis step
            analyticalSteps.push({
              id: `step-2`,
              type: 'analysis',
              description: 'Data Analysis',
              order: 2,
              content: 'Analyzing the extracted data to identify patterns.',
              data: structuredData
            });
            
            // Visualization step
            analyticalSteps.push({
              id: `step-3`,
              type: 'visualization',
              description: 'Data Visualization',
              order: 3,
              content: 'Generating visual representation of the findings.',
              visualization: {
                type: vizData.type,
                config: {
                  data: vizData.data,
                  xKey: vizData.xKey,
                  yKey: vizData.yKey,
                  options: vizData.options
                }
              }
            });
          }
          
          // Set steps for visualization
          setSteps(analyticalSteps);
          
          // Create a summary from the data
          const summaryText = `Analysis of ${structuredData.length} data points shows patterns worth exploring.`;
          setSummary(summaryText);
          
          // Set visualization data
          setVisualizationData(vizData);
        }
      } else {
        console.log('No structured data found in message content');
      }
    } catch (error) {
      console.error('Error processing message content:', error);
      setError('Failed to process visualization data: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [message.content, message.status]);
  
  // Render loading state for message in loading status
  const renderLoadingState = () => {
    return (
      <div className="p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
          <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full" style={{ animationDelay: '0.2s' }}></div>
          <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full" style={{ animationDelay: '0.4s' }}></div>
          <span className="text-gray-500 dark:text-gray-400 ml-2">Processing data...</span>
        </div>
      </div>
    );
  };
  
  // Render loading state for component loading
  const renderComponentLoading = () => {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  };
  
  // Render error state
  const renderErrorState = () => {
    return (
      <div className="p-4 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-lg">
        <p className="font-medium">Error rendering visualization</p>
        <p className="text-sm">{error}</p>
        <div className="mt-4">
          <MessageMarkdown content={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)} />
        </div>
      </div>
    );
  };
  
  // Determine what to render
  if (message.status === 'loading') {
    return renderLoadingState();
  }
  
  if (isLoading) {
    return renderComponentLoading();
  }
  
  if (error) {
    return renderErrorState();
  }
  
  // Extract insights from steps
  const allInsights = steps
    .filter(step => step.insights && step.insights.length > 0)
    .flatMap(step => step.insights || []);
  
  // ALWAYS show message content if available
  const messageContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  
  // If we have no visualization data but the message has content, just render the content directly
  if (!visualizationData && message.content) {
    return (
      <div className="rag-response-container">
        <div className="mb-4">
          <MessageMarkdown content={messageContent} />
        </div>
      </div>
    );
  }
  
  // For visualization data, render both content and visualization
  if (visualizationData && message.content) {
    return (
      <div className="rag-response-container">
        <div className="mb-4">
          <MessageMarkdown content={messageContent} />
        </div>
        <EnhancedStepByStepVisualization
          steps={steps}
          autoPlay={false}
          dataSourceType={dataSourceType}
          insights={allInsights}
          summary={summary}
          visualizationData={visualizationData}
        />
      </div>
    );
  }
  
  // Fallback to just visualization if somehow we have that but no content
  return (
    <EnhancedStepByStepVisualization
      steps={steps}
      autoPlay={false}
      dataSourceType={dataSourceType}
      insights={allInsights}
      summary={summary}
      visualizationData={visualizationData}
    />
  );
};

