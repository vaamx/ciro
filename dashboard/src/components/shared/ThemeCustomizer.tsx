import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Color palette presets
const COLOR_PALETTES = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'],
  pastel: ['#a8e6cf', '#dcedc1', '#ffd3b6', '#ffaaa5', '#ff8b94', '#eea990', '#bdcebe', '#d6eadf'],
  vibrant: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
  monochrome: ['#0d0887', '#41049d', '#6a00a8', '#8f0da4', '#b12a90', '#cf4f6c', '#ed7953', '#fdb42f'],
  contrast: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'],
  corporate: ['#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600']
};

// Chart style presets
const CHART_STYLES = {
  default: {
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 12,
    borderRadius: 0,
    animation: true
  },
  minimal: {
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 10,
    borderRadius: 0,
    animation: false
  },
  rounded: {
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 12,
    borderRadius: 8,
    animation: true
  },
  print: {
    backgroundColor: 'white',
    fontFamily: 'serif',
    fontSize: 11,
    borderRadius: 0,
    animation: false
  }
};

interface ThemeCustomizerProps {
  onColorPaletteChange: (colors: string[]) => void;
  onStyleChange: (style: any) => void;
  initialPalette?: string;
  initialStyle?: string;
  theme?: 'light' | 'dark';
  className?: string;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  onColorPaletteChange,
  onStyleChange,
  initialPalette = 'default',
  initialStyle = 'default',
  theme = 'light',
  className = ''
}) => {
  const [selectedPalette, setSelectedPalette] = useState(initialPalette);
  const [selectedStyle, setSelectedStyle] = useState(initialStyle);
  const [customColors, setCustomColors] = useState<string[]>([...COLOR_PALETTES.default]);
  const [showCustomColorEditor, setShowCustomColorEditor] = useState(false);
  
  // Handle palette selection
  const handlePaletteChange = (palette: string) => {
    setSelectedPalette(palette);
    
    if (palette === 'custom') {
      onColorPaletteChange(customColors);
      setShowCustomColorEditor(true);
    } else {
      onColorPaletteChange(COLOR_PALETTES[palette as keyof typeof COLOR_PALETTES]);
      setShowCustomColorEditor(false);
    }
  };
  
  // Handle style selection
  const handleStyleChange = (style: string) => {
    setSelectedStyle(style);
    onStyleChange(CHART_STYLES[style as keyof typeof CHART_STYLES]);
  };
  
  // Handle custom color change
  const handleCustomColorChange = (index: number, color: string) => {
    const newColors = [...customColors];
    newColors[index] = color;
    setCustomColors(newColors);
    onColorPaletteChange(newColors);
  };
  
  return (
    <div className={`theme-customizer ${className} ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">Color Palette</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(COLOR_PALETTES).map((palette) => (
            <button
              key={palette}
              onClick={() => handlePaletteChange(palette)}
              className={`p-2 rounded border transition-colors ${
                selectedPalette === palette 
                  ? theme === 'light' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-blue-500 bg-blue-900 bg-opacity-20'
                  : theme === 'light'
                  ? 'border-gray-200 hover:bg-gray-50'
                  : 'border-gray-700 hover:bg-gray-800'
              }`}
            >
              <div className="flex mb-1">
                {COLOR_PALETTES[palette as keyof typeof COLOR_PALETTES].slice(0, 8).map((color, index) => (
                  <div
                    key={index}
                    className="w-3 h-3 mr-0.5 last:mr-0"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="text-xs capitalize">{palette}</div>
            </button>
          ))}
          
          <button
            onClick={() => handlePaletteChange('custom')}
            className={`p-2 rounded border transition-colors ${
              selectedPalette === 'custom' 
                ? theme === 'light' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-blue-500 bg-blue-900 bg-opacity-20'
                : theme === 'light'
                ? 'border-gray-200 hover:bg-gray-50'
                : 'border-gray-700 hover:bg-gray-800'
            }`}
          >
            <div className="flex mb-1">
              {customColors.slice(0, 8).map((color, index) => (
                <div
                  key={index}
                  className="w-3 h-3 mr-0.5 last:mr-0"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="text-xs">Custom</div>
          </button>
        </div>
      </div>
      
      {showCustomColorEditor && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="custom-color-editor mb-4"
        >
          <h4 className="text-xs font-medium mb-2">Custom Colors</h4>
          <div className="grid grid-cols-4 gap-2">
            {customColors.map((color, index) => (
              <div key={index} className="color-picker-item">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleCustomColorChange(index, e.target.value)}
                  className="w-full h-6 cursor-pointer rounded overflow-hidden"
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}
      
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">Chart Style</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(CHART_STYLES).map((style) => (
            <button
              key={style}
              onClick={() => handleStyleChange(style)}
              className={`p-2 rounded border transition-colors ${
                selectedStyle === style 
                  ? theme === 'light' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-blue-500 bg-blue-900 bg-opacity-20'
                  : theme === 'light'
                  ? 'border-gray-200 hover:bg-gray-50'
                  : 'border-gray-700 hover:bg-gray-800'
              }`}
            >
              <div 
                className="h-6 mb-1 flex items-center justify-center text-xs"
                style={{ 
                  borderRadius: CHART_STYLES[style as keyof typeof CHART_STYLES].borderRadius,
                  backgroundColor: theme === 'light' ? '#f3f4f6' : '#374151'
                }}
              >
                {CHART_STYLES[style as keyof typeof CHART_STYLES].animation ? 'Animated' : 'Static'}
              </div>
              <div className="text-xs capitalize">{style}</div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="chart-preview p-2 rounded border mb-4">
        <h3 className="text-xs font-medium mb-2">Preview</h3>
        <div 
          className="h-20 rounded overflow-hidden"
          style={{ 
            backgroundColor: CHART_STYLES[selectedStyle as keyof typeof CHART_STYLES].backgroundColor || (theme === 'light' ? 'white' : '#1f2937'),
            borderRadius: CHART_STYLES[selectedStyle as keyof typeof CHART_STYLES].borderRadius
          }}
        >
          <div className="flex h-full items-end px-2 pb-2">
            {(selectedPalette === 'custom' ? customColors : COLOR_PALETTES[selectedPalette as keyof typeof COLOR_PALETTES]).slice(0, 6).map((color, index) => (
              <div 
                key={index}
                className="flex-1 mx-0.5 rounded-t transition-all duration-500"
                style={{ 
                  backgroundColor: color,
                  height: `${30 + (index * 10)}%`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Theme context and provider
interface ThemeContextType {
  colors: string[];
  chartStyle: any;
  setColors: (colors: string[]) => void;
  setChartStyle: (style: any) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const ThemeContext = React.createContext<ThemeContextType>({
  colors: COLOR_PALETTES.default,
  chartStyle: CHART_STYLES.default,
  setColors: () => {},
  setChartStyle: () => {},
  isDarkMode: false,
  toggleDarkMode: () => {}
});

interface ThemeProviderProps {
  children: React.ReactNode;
  initialDarkMode?: boolean;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialDarkMode = false
}) => {
  const [colors, setColors] = useState<string[]>(COLOR_PALETTES.default);
  const [chartStyle, setChartStyle] = useState(CHART_STYLES.default);
  const [isDarkMode, setIsDarkMode] = useState(initialDarkMode);
  
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };
  
  return (
    <ThemeContext.Provider
      value={{
        colors,
        chartStyle,
        setColors,
        setChartStyle,
        isDarkMode,
        toggleDarkMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}; 