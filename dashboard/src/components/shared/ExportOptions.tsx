import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Icons
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
  </svg>
);

const PdfIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  </svg>
);

const CsvIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

interface ExportOptionsProps {
  onExport: (format: 'png' | 'jpg' | 'pdf' | 'csv' | 'svg') => void;
  availableFormats?: Array<'png' | 'jpg' | 'pdf' | 'csv' | 'svg'>;
  theme?: 'light' | 'dark';
  className?: string;
  buttonText?: string;
  iconOnly?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  onExport,
  availableFormats = ['png', 'jpg', 'pdf', 'csv'],
  theme = 'light',
  className = '',
  buttonText = 'Export',
  iconOnly = false,
  position = 'bottom',
  disabled = false
}) => {
  const [showOptions, setShowOptions] = useState(false);
  
  const handleExport = (format: 'png' | 'jpg' | 'pdf' | 'csv' | 'svg') => {
    onExport(format);
    setShowOptions(false);
  };
  
  // Position styles for the dropdown
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2';
      case 'bottom':
        return 'top-full mt-2';
      case 'left':
        return 'right-full mr-2';
      case 'right':
        return 'left-full ml-2';
      default:
        return 'top-full mt-2';
    }
  };
  
  // Format labels and icons
  const formatInfo = {
    png: { label: 'PNG Image', icon: <ImageIcon /> },
    jpg: { label: 'JPG Image', icon: <ImageIcon /> },
    pdf: { label: 'PDF Document', icon: <PdfIcon /> },
    csv: { label: 'CSV Data', icon: <CsvIcon /> },
    svg: { label: 'SVG Vector', icon: <ImageIcon /> }
  };
  
  return (
    <div className={`export-options relative ${className}`}>
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled}
        className={`export-button flex items-center gap-1 px-3 py-1.5 rounded transition-colors ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-opacity-80'
        } ${
          theme === 'light'
            ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
        }`}
      >
        <DownloadIcon />
        {!iconOnly && <span>{buttonText}</span>}
      </button>
      
      {showOptions && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className={`export-dropdown absolute z-10 ${getPositionStyles()} min-w-[150px] rounded-md shadow-lg ${
            theme === 'light' 
              ? 'bg-white border border-gray-200' 
              : 'bg-gray-800 border border-gray-700'
          }`}
        >
          <div className="py-1">
            {availableFormats.map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                  theme === 'light'
                    ? 'hover:bg-gray-100 text-gray-700'
                    : 'hover:bg-gray-700 text-gray-200'
                }`}
              >
                {formatInfo[format].icon}
                <span>{formatInfo[format].label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Visualization export utility
interface ExportVisualizationProps {
  targetRef: React.RefObject<HTMLElement>;
  filename?: string;
  theme?: 'light' | 'dark';
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const ExportVisualization: React.FC<ExportVisualizationProps> = ({
  targetRef,
  filename = 'visualization',
  theme = 'light',
  className = '',
  position = 'top'
}) => {
  const [exporting, setExporting] = useState(false);
  
  const handleExport = async (format: 'png' | 'jpg' | 'pdf' | 'csv' | 'svg') => {
    if (!targetRef.current) return;
    
    setExporting(true);
    
    try {
      // This is a placeholder - in a real implementation, you would:
      // 1. Use html2canvas or dom-to-image for PNG/JPG
      // 2. Use jsPDF for PDF
      // 3. Use a CSV library for CSV export
      // 4. For SVG, you might need to extract the SVG content
      
      // Example with html2canvas (you would need to import it)
      // const canvas = await html2canvas(targetRef.current);
      // const dataUrl = canvas.toDataURL(`image/${format}`);
      
      // Create a download link
      // const link = document.createElement('a');
      // link.download = `${filename}.${format}`;
      // link.href = dataUrl;
      // link.click();
      
      // For demonstration purposes
      console.log(`Exporting ${filename} as ${format}...`);
      alert(`Visualization "${filename}" would be exported as ${format.toUpperCase()}`);
      
    } catch (error) {
      console.error('Error exporting visualization:', error);
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <div className={`export-visualization ${className}`}>
      <ExportOptions
        onExport={handleExport}
        theme={theme}
        position={position}
        disabled={exporting}
        iconOnly
      />
      
      {exporting && (
        <div className={`export-overlay absolute inset-0 flex items-center justify-center ${
          theme === 'light' ? 'bg-white bg-opacity-70' : 'bg-gray-900 bg-opacity-70'
        }`}>
          <div className="loading-spinner animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}; 