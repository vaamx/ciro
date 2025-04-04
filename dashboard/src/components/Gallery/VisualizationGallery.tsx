import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Palette } from 'lucide-react';
import { registerThemes } from '../../Visualization/echarts';
import { useTheme } from '../../contexts/ThemeContext';

// Import reusable components
import { GallerySidebar } from './components/GallerySidebar';
import { ChartCategorySection } from './components/ChartCategorySection';
import { ChartDetailPanel } from './components/ChartDetailPanel';
import { ZoomModal } from './components/ZoomModal';

// Import chart configurations
import { chartTypeCategories, allCharts, ChartConfig } from './data/chartConfigs';

// Import the Studio component
import { Studio } from '../../components/Studio';

// Initialize themes
registerThemes();

// Define chart configuration type
interface ChartConfigOptions {
  colorPalette: string;
  showLegend: boolean;
  aspectRatio: string;
  padding: number;
  showValues: boolean;
  showGridlines: boolean;
  animationSpeed: string;
  [key: string]: any;
}

export const VisualizationGallery: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
  const [selectedChart, setSelectedChart] = useState<ChartConfig | null>(null);
  const [zoomedChart, setZoomedChart] = useState<ChartConfig | null>(null);
  
  // Add state for chart configuration
  const [chartConfig, setChartConfig] = useState<ChartConfigOptions>({
    colorPalette: 'default',
    showLegend: true,
    aspectRatio: 'auto',
    padding: 20,
    showValues: false,
    showGridlines: true,
    animationSpeed: 'medium'
  });
  
  // Use the global theme context instead of local state
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? 'dark' : 'light';
  
  // Create refs for each category section
  const contentAreaRef = useRef<HTMLDivElement>(null);
  
  // Handle theme change
  const handleThemeChange = (newTheme: string) => {
    // In this implementation, we won't change the global theme
    // Only allow light or dark
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.warn('Invalid theme requested:', newTheme);
      return;
    }
    
    console.log('Theme change requested to:', newTheme);
    
    // Force a refresh to apply theme
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  };

  // Effect to handle theme changes from the global context
  useEffect(() => {
    // Force a refresh to apply theme changes
    window.dispatchEvent(new Event('resize'));
  }, [isDarkMode]);

  // Handle chart config changes
  const handleConfigChange = useCallback((key: string, value: any) => {
    setChartConfig(prevConfig => ({
      ...prevConfig,
      [key]: value
    }));
    
    // Trigger a visualization refresh
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    
    console.log(`Changed ${key} to:`, value);
  }, []);

  // Filter charts based on search and category
  const filteredCharts = allCharts
    // Filter out backward compatibility charts (those with IDs that match oldId in chartsBackwardCompatibility)
    .filter(chart => !['bar-chart', 'line-chart', 'pie-chart', 'area-chart'].includes(chart.id))
    .filter(chart => {
      const matchesSearch = 
        chart.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        chart.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chart.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategoryId === 'all' || chart.categoryId === selectedCategoryId;
      
      return matchesSearch && matchesCategory;
    });

  // Group charts by category
  const chartsByCategory = chartTypeCategories.map(category => ({
    ...category,
    filteredCharts: filteredCharts.filter(chart => chart.categoryId === category.id)
  }));

  // Manually implement scrolling
  const handleCategoryClick = (categoryId: string) => {
    // Update state
    setSelectedCategoryId(categoryId);
    
    // Find element to scroll to
    setTimeout(() => {
      if (categoryId === 'all') return;
      
      const sectionElement = document.getElementById(`section-${categoryId}`);
      if (!sectionElement) {
        console.warn(`Section not found: section-${categoryId}`);
        return;
      }
      
      const containerElement = document.getElementById('visualization-content-area');
      if (!containerElement) {
        console.warn('Content container not found');
        return;
      }
      
      // Calculate the scroll position
      const scrollTop = sectionElement.offsetTop - 20; // 20px offset for better visibility
      
      console.log('Scrolling to:', {
        sectionId: categoryId,
        offsetTop: sectionElement.offsetTop,
        scrollTop
      });
      
      // Set the scroll position directly
      containerElement.scrollTop = scrollTop;
    }, 100);
  };
  
  // Add state for showing Studio
  const [showStudio, setShowStudio] = useState(false);
  const [studioChartTemplate, setStudioChartTemplate] = useState<string | undefined>();

  // Update the handleOpenInStudio function
  const handleOpenInStudio = useCallback((chart: ChartConfig) => {
    console.log('Opening chart in Studio:', chart.id);
    setShowStudio(true);
    setStudioChartTemplate(chart.id);
  }, []);

  return (
    <div className="flex h-full">
      {showStudio ? (
        <Studio 
          chartTemplateId={studioChartTemplate} 
          onClose={() => setShowStudio(false)}
          isFullPage={true}
        />
      ) : (
        <>
          {/* Left sidebar with filters */}
          <GallerySidebar
            categories={chartTypeCategories}
            selectedCategoryId={selectedCategoryId}
            searchTerm={searchTerm}
            onCategorySelect={handleCategoryClick}
            onSearchChange={setSearchTerm}
          />
          
          {/* Main content area - Gallery grid */}
          <div className="w-full lg:w-5/6 xl:w-[88%] flex">
            {/* Scrollable content area */}
            <div 
              id="visualization-content-area"
              ref={contentAreaRef} 
              className="flex-1 p-6 overflow-y-auto"
            >
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Visualization Gallery
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Browse and customize data visualizations for your dashboards and reports
              </p>
              
              {/* If search is active, show filtered results across all categories */}
              {searchTerm ? (
                <div>
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">
                    Search Results for "{searchTerm}"
                  </h2>
                  {filteredCharts.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                        <Palette className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No matching visualizations</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">Try different search terms or clear your search to see all visualizations.</p>
                      <button 
                        className="text-blue-600 font-medium hover:text-blue-500 transition-colors"
                        onClick={() => setSearchTerm('')}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCharts.map((chart) => (
                        <div 
                          key={chart.id}
                          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedChart(chart)}
                        >
                          <h3 className="font-medium text-gray-900 dark:text-white mb-2">{chart.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{chart.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Render categories based on selection
                <>
                  {selectedCategoryId === 'all' ? (
                    // Show all categories when "all" is selected
                    chartsByCategory.map((category) => (
                      <div key={category.id} className="mb-10" id={`section-${category.id}`}>
                        <ChartCategorySection
                          category={category}
                          filteredCharts={category.filteredCharts}
                          theme={theme}
                          onSelectChart={setSelectedChart}
                          onZoomChart={setZoomedChart}
                          chartConfig={chartConfig}
                        />
                      </div>
                    ))
                  ) : (
                    // Show only the selected category
                    chartsByCategory
                      .filter(category => category.id === selectedCategoryId)
                      .map((category) => (
                        <div key={category.id} className="mb-10" id={`section-${category.id}`}>
                          <ChartCategorySection
                            category={category}
                            filteredCharts={category.filteredCharts}
                            theme={theme}
                            onSelectChart={setSelectedChart}
                            onZoomChart={setZoomedChart}
                            chartConfig={chartConfig}
                          />
                        </div>
                      ))
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Chart details panel */}
          {selectedChart && (
            <ChartDetailPanel
              chart={selectedChart}
              theme={theme}
              onClose={() => setSelectedChart(null)}
              onThemeChange={handleThemeChange}
              onZoom={setZoomedChart}
              chartConfig={chartConfig}
              onConfigChange={handleConfigChange}
              onOpenInStudio={handleOpenInStudio}
            />
          )}
          
          {/* Zoom modal for full-screen preview */}
          {zoomedChart && (
            <ZoomModal
              chart={zoomedChart}
              theme={theme}
              onClose={() => setZoomedChart(null)}
              chartConfig={chartConfig}
            />
          )}
        </>
      )}
    </div>
  );
}; 

export default VisualizationGallery; 