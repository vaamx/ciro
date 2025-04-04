import React, { createContext, useContext, useEffect, useState } from 'react';

export interface ThemeContextType {
  isDarkMode: boolean;
  setIsDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      // Check local storage for saved theme preference
      const saved = localStorage.getItem('theme');
      // Check system preference if no saved preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = saved ? saved === 'dark' : prefersDark;
      console.log('Initial theme from localStorage or system preference:', shouldBeDark ? 'dark' : 'light');
      return shouldBeDark;
    } catch (error) {
      console.error('Error reading initial theme:', error);
      return false;
    }
  });

  // Apply theme change immediately when component mounts
  useEffect(() => {
    // Force update based on the initial state
    applyTheme(isDarkMode);
    
    // Listen for system theme changes
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        // Only apply system theme if no user preference is stored
        if (!localStorage.getItem('theme')) {
          console.log('System theme changed to:', e.matches ? 'dark' : 'light');
          setIsDarkMode(e.matches);
        }
      };
      
      // Add event listener with proper compatibility check
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Legacy browsers
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    } catch (error) {
      console.error('Error setting up media query listener:', error);
    }
  }, []);

  // Apply theme whenever isDarkMode changes
  useEffect(() => {
    applyTheme(isDarkMode);
  }, [isDarkMode]);

  // Function to apply theme changes consistently
  const applyTheme = (darkMode: boolean) => {
    console.log(`Applying theme: ${darkMode ? 'dark' : 'light'}`);
    
    // Update document class - ensure we're using documentElement
    try {
      // First, get the HTML element
      const htmlElement = document.documentElement;
      
      // Apply or remove the class
      if (darkMode) {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark');
      }
      
      console.log('After applying theme, document.documentElement.classList:', htmlElement.classList);
    } catch (error) {
      console.error('Error updating document classes:', error);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light');
      console.log('Updated localStorage theme to:', localStorage.getItem('theme'));
    } catch (error) {
      console.error('Error updating localStorage:', error);
    }
    
    // Force meta theme-color update for mobile browsers
    try {
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', darkMode ? '#1f2937' : '#ffffff');
      }
    } catch (error) {
      console.error('Error updating meta theme color:', error);
    }
  };

  const toggleDarkMode = () => {
    console.log('Theme toggle clicked, current mode:', isDarkMode);
    console.log('Before toggle, document.documentElement.classList contains "dark":', document.documentElement.classList.contains('dark'));
    console.log('LocalStorage theme value before toggle:', localStorage.getItem('theme'));
    
    // Try clearing localStorage theme first
    try {
      localStorage.removeItem('theme');
      console.log('Cleared localStorage theme');
    } catch (e) {
      console.error('Failed to clear localStorage theme:', e);
    }
    
    setIsDarkMode(prev => {
      console.log('Setting isDarkMode to:', !prev);
      return !prev;
    });
    
    // Log after state update is scheduled (but not necessarily applied yet)
    console.log('Toggle function completed, state update scheduled');
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 