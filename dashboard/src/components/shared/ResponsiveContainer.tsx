import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  mobileBreakpoint?: number;
  tabletBreakpoint?: number;
  desktopBreakpoint?: number;
  mobileHeight?: number | string;
  tabletHeight?: number | string;
  desktopHeight?: number | string;
  className?: string;
  style?: React.CSSProperties;
  onBreakpointChange?: (breakpoint: 'mobile' | 'tablet' | 'desktop') => void;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  mobileBreakpoint = 640,
  tabletBreakpoint = 1024,
  desktopBreakpoint = 1280,
  mobileHeight = 250,
  tabletHeight = 350,
  desktopHeight = 450,
  className = '',
  style = {},
  onBreakpointChange
}) => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [containerHeight, setContainerHeight] = useState<number | string>(desktopHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Update breakpoint and height based on window width
  const updateDimensions = () => {
    const width = window.innerWidth;
    let newBreakpoint: 'mobile' | 'tablet' | 'desktop';
    let newHeight: number | string;
    
    if (width < mobileBreakpoint) {
      newBreakpoint = 'mobile';
      newHeight = mobileHeight;
    } else if (width < tabletBreakpoint) {
      newBreakpoint = 'tablet';
      newHeight = tabletHeight;
    } else if (width >= desktopBreakpoint) {
      // Explicitly use desktopBreakpoint to determine when we're at desktop size
      newBreakpoint = 'desktop';
      newHeight = desktopHeight;
    } else {
      // Between tablet and desktop breakpoints
      newBreakpoint = 'desktop';
      newHeight = desktopHeight;
    }
    
    if (newBreakpoint !== currentBreakpoint) {
      setCurrentBreakpoint(newBreakpoint);
      
      if (onBreakpointChange) {
        onBreakpointChange(newBreakpoint);
      }
    }
    
    setContainerHeight(newHeight);
  };
  
  // Initialize and add resize listener
  useEffect(() => {
    updateDimensions();
    
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [mobileBreakpoint, tabletBreakpoint, mobileHeight, tabletHeight, desktopHeight]);
  
  return (
    <div
      ref={containerRef}
      className={`responsive-container ${className} ${currentBreakpoint}`}
      style={{
        ...style,
        height: containerHeight,
        width: '100%'
      }}
    >
      {children}
    </div>
  );
};

// Responsive grid component
interface ResponsiveGridProps {
  children: React.ReactNode;
  mobileColumns?: number;
  tabletColumns?: number;
  desktopColumns?: number;
  gap?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = '1rem',
  className = '',
  style = {}
}) => {
  const [columns, setColumns] = useState(desktopColumns);
  
  // Update columns based on window width
  const updateColumns = () => {
    const width = window.innerWidth;
    
    if (width < 640) {
      setColumns(mobileColumns);
    } else if (width < 1024) {
      setColumns(tabletColumns);
    } else {
      setColumns(desktopColumns);
    }
  };
  
  // Initialize and add resize listener
  useEffect(() => {
    updateColumns();
    
    window.addEventListener('resize', updateColumns);
    
    return () => {
      window.removeEventListener('resize', updateColumns);
    };
  }, [mobileColumns, tabletColumns, desktopColumns]);
  
  return (
    <div
      className={`responsive-grid ${className}`}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap
      }}
    >
      {children}
    </div>
  );
};

// Responsive visualization container
interface ResponsiveVisualizationProps {
  children: React.ReactNode;
  aspectRatio?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  maxHeight?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
  style?: React.CSSProperties;
}

export const ResponsiveVisualization: React.FC<ResponsiveVisualizationProps> = ({
  children,
  aspectRatio = {
    mobile: 1.2, // 5:6 aspect ratio
    tablet: 1.5, // 3:2 aspect ratio
    desktop: 1.78 // 16:9 aspect ratio
  },
  maxHeight = {
    mobile: 300,
    tablet: 400,
    desktop: 500
  },
  className = '',
  style = {}
}) => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fix the updateBreakpoint function to prevent nested updates
  const updateBreakpoint = useCallback(() => {
    const width = window.innerWidth;
    
    let newBreakpoint: 'mobile' | 'tablet' | 'desktop';
    if (width < 640) {
      newBreakpoint = 'mobile';
    } else if (width < 1024) {
      newBreakpoint = 'tablet';
    } else {
      newBreakpoint = 'desktop';
    }
    
    // Only update state if breakpoint changed
    if (newBreakpoint !== currentBreakpoint) {
      setCurrentBreakpoint(newBreakpoint);
    }
  }, [currentBreakpoint]);
  
  // Fix the calculateDimensions function to use useCallback
  const calculateDimensions = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    let height = containerWidth / (aspectRatio[currentBreakpoint] || 1);
    
    // Apply max height limit if specified
    const currentMaxHeight = maxHeight[currentBreakpoint] || Infinity;
    if (height > currentMaxHeight) {
      height = currentMaxHeight;
    }
    
    // Only update state if dimensions have changed
    if (dimensions.width !== containerWidth || dimensions.height !== height) {
      setDimensions({
        width: containerWidth,
        height
      });
    }
  }, [aspectRatio, currentBreakpoint, maxHeight, dimensions]);
  
  // Update the useEffect to separate the breakpoint and dimension updates
  useEffect(() => {
    // Initial update of breakpoint
    updateBreakpoint();
    
    // Add event listener for window resize to update breakpoint
    window.addEventListener('resize', updateBreakpoint);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  }, [updateBreakpoint]);
  
  // Add separate useEffect for dimension updates
  useEffect(() => {
    // Initial calculation
    calculateDimensions();
    
    // Setup ResizeObserver for container size changes
    if (containerRef.current && window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(calculateDimensions);
      resizeObserver.observe(containerRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
    
    // Add resize listener as fallback for browsers without ResizeObserver
    window.addEventListener('resize', calculateDimensions);
    return () => {
      window.removeEventListener('resize', calculateDimensions);
    };
  }, [calculateDimensions]);
  
  return (
    <div
      ref={containerRef}
      className={`responsive-visualization ${className} ${currentBreakpoint}`}
      style={{
        ...style,
        width: '100%'
      }}
    >
      <div
        className="visualization-content"
        style={{
          width: '100%',
          height: dimensions.height,
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  );
}; 