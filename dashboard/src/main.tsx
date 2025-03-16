import React from 'react';
import ReactDOM from 'react-dom/client';
// Import our API configuration override first
import './api-config';
import App from './App';
import './index.css';
import './styles/globals.css';
// Import favicon for Vite to include it in the build
import './assets/icons/favicon.png';
import { logger, LogLevel } from './utils/logger';
import { silenceConsole } from './utils/consoleSilencer';
import initDebugHelpers from './utils/debugHelper';
import { LocalFileService } from './services/LocalFileService';

// Initialize logger settings based on environment
const initializeLogger = () => {
  // For production builds, ensure logs are completely disabled for users
  if (process.env.NODE_ENV === 'production') {
    // Set global log level to NONE to disable all logging
    logger.setLevel(LogLevel.NONE);
    
    // Only allow errors from critical components
    logger.setComponentLevel('api', LogLevel.ERROR);
    
    // Remove the global logger control from window object if somehow present
    if (typeof window !== 'undefined' && (window as any).loggerControl) {
      delete (window as any).loggerControl;
    }
    
    // Silence console completely except for errors
    silenceConsole(['error']);
  } else {
    // In development mode, initialize debug helpers
    initDebugHelpers();
    
    // Set default log level to ERROR to reduce noise
    logger.setLevel(LogLevel.ERROR);
    
    // Disable verbose logging for noisy components
    logger.setComponentLevel('Visualization', LogLevel.ERROR);
    logger.setComponentLevel('DataSourceCard', LogLevel.ERROR);
  }
};

// Initialize logger before rendering the app
initializeLogger();

// Preload the LocalFileService to improve file browser performance
LocalFileService.preload();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
