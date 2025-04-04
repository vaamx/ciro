import React from 'react';
import { VisualizationProps } from '../index';

/**
 * Geospatial Map Component
 * Renders a simplified map visualization with geospatial data
 */
const GeospatialMap: React.FC<VisualizationProps> = ({
  data,
  width = '100%',
  height = 300,
  options,
  theme = 'light'
}) => {
  // If no valid data is provided, return a placeholder
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div 
        className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} rounded-lg p-4 border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`}
        style={{ width, height }}
      >
        <div className="flex items-center justify-center h-full">
          <p className={`text-${theme === 'dark' ? 'gray-400' : 'gray-500'}`}>
            No geospatial data available
          </p>
        </div>
      </div>
    );
  }
  
  // For now, create a visual representation of a map with points
  const chartHeight = typeof height === 'number' ? `${height}px` : height;
  const chartWidth = typeof width === 'number' ? `${width}px` : width;
  
  // Extract points count if available
  const pointCount = data.length;
  
  // Get color from options or use a default color
  const colors = options?.colors || ['#4338CA', '#6366F1', '#818CF8'];
  const landColor = theme === 'dark' ? '#1F2937' : '#E2E8F0';
  const waterColor = theme === 'dark' ? '#111827' : '#F1F5F9';
  const strokeColor = theme === 'dark' ? '#374151' : '#CBD5E1';
  
  // Find map center from data if it has lat/lng coordinates
  const hasGeoCoords = data.some(point => 'lat' in point && 'lng' in point);
  
  return (
    <div 
      className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} rounded-lg p-4 border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`}
      style={{ width: chartWidth, height: chartHeight }}
    >
      <div className="flex flex-col h-full">
        <div className={`text-center text-sm font-medium mb-2 text-${theme === 'dark' ? 'gray-300' : 'gray-700'}`}>
          {options?.title || 'Geospatial Map'}
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full h-full max-w-full max-h-full relative">
            {/* Simple map visualization */}
            <svg 
              viewBox="0 0 100 60" 
              className="w-full h-full" 
              style={{ 
                backgroundColor: waterColor, 
                borderRadius: '0.375rem' 
              }}
            >
              {/* Simplified continents */}
              <path 
                d="M20,15 Q30,5 40,15 T70,15 Q75,25 65,35 T40,40 Q30,50 15,30 Z" 
                fill={landColor} 
                stroke={strokeColor} 
                strokeWidth="0.5"
              />
              <path 
                d="M75,45 Q85,40 90,45 T80,50 Z" 
                fill={landColor} 
                stroke={strokeColor} 
                strokeWidth="0.5"
              />
              
              {/* Data points */}
              {hasGeoCoords ? (
                data.map((point, index) => {
                  // Normalize geographic coordinates to the SVG viewport
                  // This is very simplified - real mapping would use proper projections
                  const lat = typeof point.lat === 'number' ? point.lat : 0;
                  const lng = typeof point.lng === 'number' ? point.lng : 0;
                  
                  // Extremely simplified conversion (just for visualization)
                  // Maps lat from -90 to 90 → 60 to 0, and lng from -180 to 180 → 0 to 100
                  const x = ((lng + 180) / 360) * 100;
                  const y = 60 - ((lat + 90) / 180) * 60;
                  
                  // Size based on value if available
                  const value = typeof point.value === 'number' ? point.value : 50;
                  const size = Math.max(1, Math.min(5, (value / 100) * 4 + 1));
                  
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={size}
                      fill={colors[index % colors.length]}
                      opacity={0.8}
                      stroke={theme === 'dark' ? '#111827' : 'white'}
                      strokeWidth="0.3"
                    />
                  );
                })
              ) : (
                // Random points if no geo coordinates
                Array.from({ length: Math.min(data.length, 10) }).map((_, index) => (
                  <circle
                    key={index}
                    cx={20 + Math.random() * 60}
                    cy={10 + Math.random() * 40}
                    r={1 + Math.random() * 3}
                    fill={colors[index % colors.length]}
                    opacity={0.8}
                    stroke={theme === 'dark' ? '#111827' : 'white'}
                    strokeWidth="0.3"
                  />
                ))
              )}
            </svg>
          </div>
        </div>
        
        <div className={`mt-2 text-xs text-${theme === 'dark' ? 'gray-500' : 'gray-400'} text-center`}>
          {pointCount} geographic data points
          {hasGeoCoords ? ' with coordinates' : ''}
        </div>
      </div>
    </div>
  );
};

export default GeospatialMap; 