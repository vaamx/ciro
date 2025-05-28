import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Code2, 
  FileText, 
  BarChart3, 
  Image, 
  Download, 
  ExternalLink, 
  Copy, 
  Eye, 
  EyeOff,
  Maximize2,
  Minimize2,
  AlertTriangle
} from 'lucide-react';
import { VisualizationRenderer, type VisualizationConfig } from './visualization/VisualizationRenderer';
import { DocumentRenderer } from './DocumentRenderer';
import { MessageMarkdown } from './MessageMarkdown';
import { TableVisualization } from '../../../Visualization/tables/TableVisualization';

// Get file extension based on artifact type
const getFileExtension = (type: string): string => {
  const extensions: Record<string, string> = {
    'html': 'html',
    'code': 'txt',
    'json': 'json',
    'csv': 'csv',
    'text': 'txt',
    'chart': 'json',
    'table': 'csv',
    'image': 'png',
    'file': 'bin'
  };
  return extensions[type] || 'txt';
};

interface Artifact {
  type: 'html' | 'code' | 'chart' | 'table' | 'file' | 'image' | 'text' | 'json' | 'csv';
  title?: string;
  content: string;
  language?: string; // For code artifacts
  data?: any[]; // For chart/table artifacts
  config?: any; // For visualization configuration
  metadata?: Record<string, any>;
  id?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
}

interface ArtifactRendererProps {
  artifacts: Artifact[];
  onAddToDashboard?: (config: VisualizationConfig) => void;
  className?: string;
}

// Sandbox iframe for HTML content
const HTMLSandbox: React.FC<{ content: string; height?: number }> = ({ content, height = 400 }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      iframe.src = url;
      iframe.onload = () => setIsLoaded(true);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [content]);

  return (
    <div className="relative">
      <iframe
        ref={iframeRef}
        className={`w-full border border-gray-200 dark:border-gray-700 rounded-lg ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
        style={{ height: `${height}px` }}
        sandbox="allow-scripts allow-same-origin"
        title="HTML Artifact"
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
};

// Code block with syntax highlighting
const CodeBlock: React.FC<{ 
  content: string; 
  language?: string; 
  filename?: string; 
}> = ({ content, language = 'text', filename }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="relative">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{filename}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <code className={`language-${language} text-sm`}>{content}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <span className="text-green-500 text-xs">✓</span>
          ) : (
            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>
    </div>
  );
};

// Individual artifact renderer
const ArtifactItem: React.FC<{
  artifact: Artifact;
  onAddToDashboard?: (config: VisualizationConfig) => void;
}> = ({ artifact, onAddToDashboard }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Get artifact icon
  const getArtifactIcon = () => {
    switch (artifact.type) {
      case 'html':
        return <ExternalLink className="w-5 h-5 text-orange-500" />;
      case 'code':
        return <Code2 className="w-5 h-5 text-blue-500" />;
      case 'chart':
      case 'table':
        return <BarChart3 className="w-5 h-5 text-green-500" />;
      case 'image':
        return <Image className="w-5 h-5 text-purple-500" />;
      case 'file':
        return <FileText className="w-5 h-5 text-gray-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  // Render artifact content
  const renderContent = () => {
    if (!showPreview) return null;

    const height = isExpanded ? 600 : 300;

    switch (artifact.type) {
      case 'html':
        if (!artifact.content) return null;
        return <HTMLSandbox content={artifact.content} height={height} />;

      case 'code':
        if (!artifact.content) return null;
        return (
          <CodeBlock
            content={artifact.content}
            language={artifact.language || artifact.metadata?.language}
            filename={artifact.title}
          />
        );

      case 'chart':
      case 'table':
        if (artifact.data && Array.isArray(artifact.data)) {
          if (artifact.type === 'table') {
            return (
              <TableVisualization
                data={artifact.data}
                title={artifact.title}
                darkMode={document.documentElement.classList.contains('dark')}
                className="max-h-96"
              />
            );
          } else {
            // Chart visualization
            const visualizationConfig: VisualizationConfig = {
              type: artifact.config?.type || 'bar',
              data: artifact.data,
              config: artifact.config || {},
              options: artifact.metadata || {}
            };

            return (
              <div className="space-y-4">
                <VisualizationRenderer
                  visualizationConfig={visualizationConfig}
                  height={height}
                  showControls={true}
                  onAddToDashboard={onAddToDashboard}
                />
              </div>
            );
          }
        }
        return (
          <div className="p-4 text-center text-gray-500">
            No data available for {artifact.type}
          </div>
        );

      case 'image':
        if (artifact.content) {
          return (
            <img
              src={artifact.content}
              alt={artifact.title || 'Artifact image'}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: `${height}px`, objectFit: 'contain' }}
            />
          );
        }
        return null;

      case 'file':
        if (artifact.content) {
          // Try to render as document
          const fileExt = artifact.filename?.split('.').pop()?.toLowerCase();
          return (
            <DocumentRenderer
              content={artifact.content}
              type={fileExt || 'text'}
              messageId={`artifact-${artifact.filename}`}
            />
          );
        }
        return null;

      case 'json':
        return (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg">
            <pre className="p-4 overflow-x-auto text-sm">
              <code className="language-json">
                {JSON.stringify(JSON.parse(artifact.content), null, 2)}
              </code>
            </pre>
          </div>
        );

      case 'csv':
        // Parse CSV and render as table
        try {
          const lines = artifact.content.split('\n');
          const headers = lines[0]?.split(',') || [];
          const rows = lines.slice(1).map(line => line.split(','));
          
          return (
            <TableVisualization
              data={rows.map(row => {
                const obj: Record<string, any> = {};
                headers.forEach((header, index) => {
                  obj[header.trim()] = row[index]?.trim() || '';
                });
                return obj;
              })}
              title={artifact.title || 'CSV Data'}
              darkMode={document.documentElement.classList.contains('dark')}
              className="max-h-96"
            />
          );
        } catch (error) {
          return (
            <div className="p-4 text-red-500">
              Failed to parse CSV: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          );
        }

      case 'text':
      default:
        if (artifact.content) {
          return <MessageMarkdown content={artifact.content} />;
        }
        return null;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          {getArtifactIcon()}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{artifact.title || artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1)}</h4>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="uppercase">{artifact.type}</span>
              {artifact.size && <span>• {formatFileSize(artifact.size)}</span>}
              {artifact.mimeType && <span>• {artifact.mimeType}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {showPreview && renderContent() && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {artifact.content && (
            <button
              onClick={() => {
                const blob = new Blob([artifact.content], { 
                  type: artifact.mimeType || 'text/plain' 
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = artifact.filename || `artifact-${artifact.type}.${getFileExtension(artifact.type)}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {renderContent() || (
                <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  No preview available for this artifact
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Main ArtifactRenderer component
export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({
  artifacts,
  onAddToDashboard,
  className = ''
}) => {
  if (!artifacts || artifacts.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`} data-message-id={artifacts[0].id}>
      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <FileText className="w-4 h-4" />
        <span>
          {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''} generated
        </span>
      </div>

      <div className="space-y-3">
        {artifacts.map((artifact, index) => (
          <ArtifactItem
            key={`${artifacts[0].id}-artifact-${index}`}
            artifact={artifact}
            onAddToDashboard={onAddToDashboard}
          />
        ))}
      </div>
    </div>
  );
};

export default ArtifactRenderer; 