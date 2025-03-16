import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { type MessageMetadata } from '../types';
import { Copy } from 'lucide-react';

// Fix lazy loading to handle named exports
const TableVisualization = lazy(() => 
  import('../../../Visualization/tables/TableVisualization')
    .then(module => ({ default: module.TableVisualization }))
);

interface MessageMarkdownProps {
  content: string;
  metadata?: MessageMetadata;
}

// Define components for ReactMarkdown
const markdownComponents = {
  // Code component - using function declaration to avoid TypeScript issues
  code: function (props: any) {
    const { className, children } = props;
    // We don't need to extract the match here since we're not using it
    
    // Check if it's an inline code block based on node type
    const isInlineCode = !className;
    
    if (isInlineCode) {
      return <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm" {...props}>{children}</code>;
    }
    
    // For code blocks, we'll handle them in the parent component
    return (
      <pre className={className}>
        <code {...props}>{children}</code>
      </pre>
    );
  },
  
  // Table components
  table: function (props: any) {
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-200" {...props} />
      </div>
    );
  },
  
  // Other components
  th: function (props: any) {
    return (
      <th
        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800/90
          text-gray-900 dark:text-gray-100 sticky top-0"
        {...props}
      />
    );
  },
  
  td: function (props: any) {
    return (
      <td
        className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 
          border-t border-gray-200 dark:border-gray-700"
        {...props}
      />
    );
  },
  
  // Enhance headings for better contrast
  h1: function (props: any) {
    return <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4 mt-6" {...props} />;
  },
  
  h2: function (props: any) {
    return <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 mt-5 pb-2 border-b border-gray-200 dark:border-gray-700" {...props} />;
  },
  
  h3: function (props: any) {
    return <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 mb-2 mt-4" {...props} />;
  },
  
  // Enhance paragraphs for better readability
  p: function (props: any) {
    return <p className="text-gray-700 dark:text-gray-200 mb-4 leading-relaxed" {...props} />;
  },
  
  // Style list items for better readability
  li: function (props: any) {
    return <li className="text-gray-700 dark:text-gray-200 mb-1 leading-relaxed" {...props} />;
  },
  
  // Enhance strong text elements
  strong: function (props: any) {
    return <strong className="font-semibold text-gray-900 dark:text-white" {...props} />;
  },
  
  // Enhance emphasis elements
  em: function (props: any) {
    return <em className="text-gray-800 dark:text-gray-100 italic" {...props} />;
  },
  
  // Enhance inline html for custom elements
  span: function (props: any) {
    // Check for class names indicating special handling
    if (props.className?.includes('dark:inline')) {
      return <span className={props.className || "text-gray-600 dark:text-gray-300"} {...props} />;
    }
    return <span className="text-gray-700 dark:text-gray-300" {...props} />;
  },
  
  // Better blockquote styling
  blockquote: function (props: any) {
    return (
      <blockquote 
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-4"
        {...props}
      />
    );
  },
  
  // Enhance horizontal rule
  hr: function (props: any) {
    return <hr className="border-t border-gray-200 dark:border-gray-700 my-5 opacity-60" {...props} />;
  },
  
  // Enhance lists
  ul: function (props: any) {
    return <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-200 space-y-2" {...props} />;
  },
  
  ol: function (props: any) {
    return <ol className="list-decimal pl-6 mb-4 text-gray-700 dark:text-gray-200 space-y-2" {...props} />;
  },
  
  // Add div component for custom containers
  div: function (props: any) {
    if (props.className?.includes('data-table-container')) {
      return (
        <div 
          className={`${props.className} overflow-hidden rounded-lg shadow-sm`}
          style={{ backdropFilter: 'blur(4px)' }} 
          {...props} 
        />
      );
    }
    return <div {...props} />;
  }
};

export const MessageMarkdown: React.FC<MessageMarkdownProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Process content to handle both markdown and HTML content
  const processedContent = useMemo(() => {
    // Safety check for null or undefined content
    if (!content) {
      return {
        isHtml: false,
        content: ''
      };
    }
    
    // Check if content contains HTML elements
    const hasHtmlContent = 
      content.includes('<div') || 
      content.includes('<span') || 
      content.includes('<p') || 
      content.includes('<h') || 
      content.includes('<table') || 
      content.includes('<strong') || 
      content.includes('<em') || 
      content.includes('<ul') || 
      content.includes('<ol') || 
      content.includes('<li') || 
      content.includes('<br');
    
    // If content has HTML, return it as HTML
    if (hasHtmlContent) {
      return {
        isHtml: true,
        content
      };
    }
    
    // Check for data tables that need special formatting for dark mode
    if (content.includes('Data Table') || content.includes('data table')) {
      let enhancedContent = content;
      
      // Add styling for data table titles
      enhancedContent = enhancedContent.replace(
        /(Data Table|data table)/g, 
        '<div class="data-table-title font-medium text-gray-900 dark:text-gray-100">$1</div>'
      );
      
      return {
        isHtml: true,
        content: enhancedContent
      };
    }
    
    // Return the content as markdown
    return {
      isHtml: false,
      content
    };
  }, [content]);
  
  // Handle copy button click for code blocks
  const handleCopyClick = (index: number, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  // Reset copied state when content changes
  useEffect(() => {
    setCopiedIndex(null);
  }, [processedContent.content]);

  // Custom component for code blocks with copy button
  const CodeBlock = ({ language, value, index }: { language: string; value: string; index: number }) => {
    return (
      <div className="relative group">
        <button
          onClick={() => handleCopyClick(index, value)}
          className="absolute right-2 top-2 p-1.5 rounded bg-gray-700/50 hover:bg-gray-700/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Copy code"
        >
          {copiedIndex === index ? <CheckIcon className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <SyntaxHighlighter
          language={language || 'text'}
          PreTag="div"
          className="rounded-md p-4 bg-gray-800 text-gray-200 text-sm overflow-auto"
        >
          {value}
        </SyntaxHighlighter>
      </div>
    );
  };
  
  // Counter for code blocks to track which one was copied
  let codeBlockIndex = 0;

  return (
    <div className="message-markdown relative">
      {processedContent.isHtml ? (
        <div
          className="markdown-html prose prose-sm dark:prose-invert max-w-none 
                     prose-headings:text-gray-800 dark:prose-headings:text-gray-100 
                     prose-p:text-gray-700 dark:prose-p:text-gray-200 
                     text-gray-800 dark:text-gray-200 
                     prose-headings:font-semibold prose-h2:text-lg prose-h3:text-base 
                     prose-h2:mt-6 prose-h2:mb-4 prose-h3:mt-4 prose-h3:mb-2"
          dangerouslySetInnerHTML={{ __html: processedContent.content }}
        />
      ) : (
        <ReactMarkdown
          components={{
            ...markdownComponents,
            // Override the code component to handle code blocks with syntax highlighting
            code: (props: any) => {
              const { className, children } = props;
              const match = /language-(\w+)/.exec(className || '');
              
              // Check if it's an inline code block (no language class)
              if (!className) {
                return <code {...props}>{children}</code>;
              }
              
              // For code blocks with language, use our CodeBlock component
              const currentIndex = codeBlockIndex++;
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  value={String(children).replace(/\n$/, '')}
                  index={currentIndex}
                />
              );
            }
          }}
          remarkPlugins={[remarkGfm]}
          className="markdown-content"
        >
          {processedContent.content}
        </ReactMarkdown>
      )}
      
      {/* Add custom styling for data tables and HTML content */}
      <style dangerouslySetInnerHTML={{ __html: `
        .data-table-container table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 1rem 0;
        }
        
        .data-table-container th {
          background-color: rgba(243, 244, 246, 0.8);
          color: #111827;
          font-weight: 600;
          text-align: left;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .dark .data-table-container th {
          background-color: rgba(31, 41, 55, 0.8);
          color: #f3f4f6;
          border-bottom: 1px solid #374151;
        }
        
        .data-table-container td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .dark .data-table-container td {
          border-bottom: 1px solid #374151;
        }
        
        .data-table-container tr:last-child td {
          border-bottom: none;
        }
        
        .data-table-container tr:nth-child(even) {
          background-color: rgba(249, 250, 251, 0.5);
        }
        
        .dark .data-table-container tr:nth-child(even) {
          background-color: rgba(31, 41, 55, 0.3);
        }
        
        .markdown-content h2 {
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .dark .markdown-content h2 {
          border-bottom: 1px solid #374151;
        }
        
        .markdown-content h3 {
          margin-top: 1.5rem;
        }
        
        /* Styling for HTML content */
        .markdown-html h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .dark .markdown-html h2 {
          border-bottom: 1px solid #374151;
        }
        
        .markdown-html h3 {
          font-size: 1rem;
          font-weight: 500;
          margin-top: 1.25rem;
          margin-bottom: 0.75rem;
        }
        
        .markdown-html p {
          margin-bottom: 1.25rem;
          line-height: 1.5;
        }
        
        .markdown-html div.my-3 {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }
        
        .markdown-html table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 1rem 0;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          overflow: hidden;
        }
        
        .dark .markdown-html table {
          border-color: #374151;
        }
        
        .markdown-html table th,
        .markdown-html table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
        }
        
        .dark .markdown-html table th,
        .dark .markdown-html table td {
          border-bottom: 1px solid #374151;
        }
        
        .markdown-html table th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        
        .dark .markdown-html table th {
          background-color: #1f2937;
        }
        
        .markdown-html table tr:last-child td {
          border-bottom: none;
        }
        
        .markdown-html table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .dark .markdown-html table tr:nth-child(even) {
          background-color: rgba(31, 41, 55, 0.3);
        }
      `}} />
    </div>
  );
};

// Helper icon for the copy button
const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Export these components for potential use elsewhere
export {
  CheckIcon
};

// These components are defined but not currently used in this file
// They are exported for potential use in other files
export const TableRenderer: React.FC<{table: {title: string, content: string, data: any[]}}> = 
  ({table}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleExpandTable = () => {
    setIsExpanded(prev => !prev);
  };
  
  return (
    <div className="my-4 border rounded-md overflow-hidden">
      <div className="flex justify-between items-center p-2 bg-gray-50 border-b">
        <h3 className="font-medium">{table.title}</h3>
        <button 
          className="px-2 py-1 text-sm bg-transparent hover:bg-gray-100 rounded"
          onClick={toggleExpandTable}
        >
          {isExpanded ? 'Simple View' : 'Enhanced View'}
        </button>
      </div>
      
      {isExpanded ? (
        <div className="p-2">
          <Suspense fallback={<div className="p-4 text-center">Loading table visualization...</div>}>
            <TableVisualization 
              data={table.data} 
              title={table.title} 
              pagination={true}
              pageSize={10}
            />
          </Suspense>
        </div>
      ) : (
        <div className="markdown-table-container">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {table.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export const InsightsSection: React.FC<{insights: string[]}> = ({insights}) => {
  if (!insights.length) return null;
  
  return (
    <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
      <h3 className="font-semibold text-blue-800 mb-2">Key Insights</h3>
      <ul className="list-disc pl-5 space-y-1">
        {insights.map((insight, i) => (
          <li key={`insight-${i}`} className="text-blue-600">{insight}</li>
        ))}
      </ul>
    </div>
  );
};

export const NextStepsSection: React.FC<{steps: string[]}> = ({steps}) => {
  if (!steps.length) return null;
  
  return (
    <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-100">
      <h3 className="font-semibold text-green-800 mb-2">Suggested Next Steps</h3>
      <ul className="list-disc pl-5 space-y-1">
        {steps.map((step, i) => (
          <li key={`next-step-${i}`} className="text-green-600">{step}</li>
        ))}
      </ul>
    </div>
  );
};

export const AnalysisStepsSection: React.FC<{steps: string[]}> = ({steps}) => {
  if (!steps.length) return null;
  
  return (
    <details className="mt-4 border rounded-md">
      <summary className="px-3 py-2 bg-gray-50 cursor-pointer font-medium">
        Step-by-Step Analysis
      </summary>
      <div className="px-4 py-2">
        <ol className="list-decimal pl-5 space-y-2">
          {steps.map((step, i) => (
            <li key={`analysis-step-${i}`} className="text-gray-700">{step}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}; 