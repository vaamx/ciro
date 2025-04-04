/**
 * Web Worker for processing visualization data
 * This worker handles heavy data processing tasks to keep the UI responsive
 */

// Process large datasets by sampling or aggregating
function sampleData(data, options = {}) {
  const { maxPoints = 1000, strategy = 'uniform' } = options;
  
  // If data is small enough, return as is
  if (!data || data.length <= maxPoints) {
    return data;
  }
  
  // Choose sampling strategy
  switch (strategy) {
    case 'uniform': {
      // Uniform sampling - take evenly spaced points
      const step = Math.ceil(data.length / maxPoints);
      return data.filter((_, index) => index % step === 0);
    }
    
    case 'random': {
      // Random sampling
      const sampled = [];
      const step = data.length / maxPoints;
      
      for (let i = 0; i < maxPoints; i++) {
        const index = Math.floor(Math.random() * data.length);
        sampled.push(data[index]);
      }
      
      return sampled;
    }
    
    case 'aggregate': {
      // Aggregate data into fewer points
      const result = [];
      const step = Math.ceil(data.length / maxPoints);
      
      for (let i = 0; i < data.length; i += step) {
        const chunk = data.slice(i, i + step);
        const aggregated = {};
        
        // Get the first item's keys
        const keys = Object.keys(chunk[0] || {});
        
        // For each key, calculate the average (for numeric values)
        keys.forEach(key => {
          const values = chunk.map(item => item[key]);
          
          // If numeric, calculate average
          if (typeof values[0] === 'number') {
            const sum = values.reduce((acc, val) => acc + val, 0);
            aggregated[key] = sum / values.length;
          } else {
            // For non-numeric, use the most common value
            const counts = values.reduce((acc, val) => {
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            }, {});
            
            const mostCommon = Object.entries(counts)
              .sort((a, b) => b[1] - a[1])[0][0];
              
            aggregated[key] = mostCommon;
          }
        });
        
        result.push(aggregated);
      }
      
      return result;
    }
    
    default:
      return data;
  }
}

// Calculate statistics for data
function calculateStatistics(data, field) {
  if (!data || !data.length || !field) {
    return null;
  }
  
  const values = data.map(item => item[field]).filter(val => typeof val === 'number');
  
  if (!values.length) {
    return null;
  }
  
  // Sort values for percentile calculations
  values.sort((a, b) => a - b);
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  
  // Calculate variance and standard deviation
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate percentiles
  const getPercentile = (p) => {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  };
  
  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    sum,
    mean,
    median: getPercentile(50),
    p25: getPercentile(25),
    p75: getPercentile(75),
    p90: getPercentile(90),
    variance,
    stdDev
  };
}

// Process data for different chart types
function processChartData(data, config) {
  const { type, options = {} } = config;
  
  // Sample data if needed
  const sampledData = sampleData(data, options.sampling);
  
  switch (type) {
    case 'bar':
    case 'line':
    case 'area':
    case 'scatter':
      // These chart types can use the data as is after sampling
      return sampledData;
      
    case 'pie':
    case 'donut':
      // For pie charts, limit to top N categories
      if (options.limitCategories && sampledData.length > options.limitCategories) {
        const sorted = [...sampledData].sort((a, b) => b[options.valueKey] - a[options.valueKey]);
        const topCategories = sorted.slice(0, options.limitCategories - 1);
        
        // Aggregate the rest as "Other"
        const otherSum = sorted.slice(options.limitCategories - 1)
          .reduce((sum, item) => sum + item[options.valueKey], 0);
          
        if (otherSum > 0) {
          const otherCategory = { [options.labelKey]: 'Other', [options.valueKey]: otherSum };
          return [...topCategories, otherCategory];
        }
        
        return topCategories;
      }
      return sampledData;
      
    default:
      return sampledData;
  }
}

// Handle messages from the main thread
self.onmessage = function(event) {
  const { id, type, payload } = event.data;
  
  try {
    let result;
    
    switch (type) {
      case 'sample':
        result = sampleData(payload.data, payload.options);
        break;
        
      case 'statistics':
        result = calculateStatistics(payload.data, payload.field);
        break;
        
      case 'processChart':
        result = processChartData(payload.data, payload.config);
        break;
        
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    // Send the result back to the main thread
    self.postMessage({ id, type, result });
  } catch (error) {
    // Send error back to the main thread
    self.postMessage({ 
      id, 
      type, 
      error: error.message || 'Unknown error in visualization worker' 
    });
  }
}; 