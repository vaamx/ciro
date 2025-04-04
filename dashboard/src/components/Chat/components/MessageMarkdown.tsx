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

// Type definition for component props
type ReactMarkdownComponentProps = {
  node?: any;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
};

// Define components for ReactMarkdown
const markdownComponents = {
  // Code component - using function declaration to avoid TypeScript issues
  code: function (props: any) {
    const { className, children } = props;
    // We don't need to extract the match here since we're not using it
    
    // Check if it's an inline code block based on node type
    const isInlineCode = !className;
    
    if (isInlineCode) {
      return <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 py-0.5 rounded text-sm" {...props}>{children}</code>;
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
      <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-200" {...props} />
      </div>
    );
  },
  
  // Other components
  th: function (props: any) {
    return (
      <th
        className="px-3 py-2 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800/90
          text-gray-900 dark:text-gray-100 sticky top-0"
        {...props}
      />
    );
  },
  
  td: function (props: any) {
    return (
      <td
        className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 
          border-t border-gray-200 dark:border-gray-700"
        {...props}
      />
    );
  },
  
  // Enhance headings for better contrast
  h1: function (props: any) {
    return <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-3 mt-4" {...props} />;
  },
  
  h2: function (props: any) {
    return <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 mt-4 pb-1 border-b border-gray-200 dark:border-gray-700" {...props} />;
  },
  
  h3: function (props: any) {
    return <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2 mt-3" {...props} />;
  },
  
  h4: function (props: any) {
    return <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 mt-3" {...props} />;
  },
  
  h5: function (props: any) {
    return <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 mt-2" {...props} />;
  },
  
  h6: function (props: any) {
    return <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 mt-2" {...props} />;
  },
  
  // Enhance paragraphs for better readability
  p: function (props: any) {
    return <p className="mb-2 leading-relaxed text-gray-800 dark:text-gray-200" {...props} />;
  },
  
  // Style list items for better readability
  li: function (props: any) {
    return <li className="mb-1" {...props} />;
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
        className="pl-3 py-1 mb-3 mt-2 border-l-2 border-gray-300 dark:border-gray-600 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-r-md" 
        {...props} 
      />
    );
  },
  
  // Enhance horizontal rule
  hr: function (props: any) {
    return <hr className="border-gray-200 dark:border-gray-700 my-3" {...props} />;
  },
  
  // Enhance lists
  ul: function (props: any) {
    return <ul className="list-disc pl-5 mb-3 mt-2 space-y-1 text-gray-700 dark:text-gray-200" {...props} />;
  },
  
  ol: function (props: any) {
    return <ol className="list-decimal pl-5 mb-3 mt-2 space-y-1 text-gray-700 dark:text-gray-200" {...props} />;
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
  // Extract and process code blocks
  const [codeBlocks, setCodeBlocks] = useState<Array<{ language: string; value: string }>>([]);
  // Track which code blocks have been copied for UI feedback
  const [copiedStates, setCopiedStates] = useState<boolean[]>([]);
  
  // Split content to detect and extract code blocks
  useEffect(() => {
    try {
      const extractedBlocks: Array<{ language: string; value: string }> = [];
      const codeBlockRegex = /```([a-zA-Z0-9_]*)\n([\s\S]*?)```/g;
      
      let match;
      while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        extractedBlocks.push({ language, value: code });
      }
      
      setCodeBlocks(extractedBlocks);
      setCopiedStates(new Array(extractedBlocks.length).fill(false));
    } catch (error) {
      console.error('Error extracting code blocks:', error);
    }
  }, [content]);
  
  // Remove code blocks from content for separate rendering
  const contentWithoutCodeBlocks = useMemo(() => {
    try {
      return content.replace(/```[a-zA-Z0-9_]*\n[\s\S]*?```/g, (match, offset) => {
        // Replace each code block with a placeholder that will be replaced with the actual rendered code block
        const index = codeBlocks.findIndex(block => content.indexOf(`\`\`\`${block.language}\n${block.value}\`\`\``, offset) === offset);
        if (index !== -1) {
          return `\nCODE_BLOCK_${index}\n`;
        }
        return match; // Keep original if not found
      });
    } catch (error) {
      console.error('Error removing code blocks:', error);
      return content;
    }
  }, [content, codeBlocks]);
  
  const handleCopyClick = (index: number, code: string) => {
    try {
      navigator.clipboard.writeText(code).then(
        () => {
          const newCopiedStates = [...copiedStates];
          newCopiedStates[index] = true;
          setCopiedStates(newCopiedStates);
          
          // Reset the copied state after 2 seconds
          setTimeout(() => {
            const resetCopiedStates = [...copiedStates];
            resetCopiedStates[index] = false;
            setCopiedStates(resetCopiedStates);
          }, 2000);
        },
        (err) => {
          console.error('Could not copy text: ', err);
        }
      );
    } catch (error) {
      console.error('Error copying code:', error);
    }
  };
  
  const CodeBlock = ({ language, value, index }: { language: string; value: string; index: number }) => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    return (
      <div className="relative group my-2 text-sm">
        <div className="absolute -top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
          <button
            onClick={() => handleCopyClick(index, value)}
            className="p-1 bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm transition-colors"
            aria-label="Copy code"
            title="Copy code"
          >
            {copiedStates[index] ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="rounded-md overflow-hidden">
          <SyntaxHighlighter
            language={language || 'text'}
            style={{
              'hljs': {
                display: 'block',
                overflowX: 'auto',
                padding: '0.8em',
                color: isDarkMode ? '#c0caf5' : '#383a42',
                background: isDarkMode ? '#1a1b26' : '#f8f8f8',
              },
              'hljs-comment': { color: '#a0a1a7', fontStyle: 'italic' },
              'hljs-quote': { color: '#a0a1a7', fontStyle: 'italic' },
              'hljs-doctag': { color: '#a626a4' },
              'hljs-keyword': { color: '#a626a4' },
              'hljs-formula': { color: '#a626a4' },
              'hljs-section': { color: '#e45649' },
              'hljs-name': { color: '#e45649' },
              'hljs-selector-tag': { color: '#e45649' },
              'hljs-deletion': { color: '#e45649' },
              'hljs-subst': { color: '#e45649' },
              'hljs-literal': { color: '#0184bb' },
              'hljs-string': { color: '#50a14f' },
              'hljs-regexp': { color: '#50a14f' },
              'hljs-addition': { color: '#50a14f' },
              'hljs-attribute': { color: '#50a14f' },
              'hljs-meta-string': { color: '#50a14f' },
              'hljs-built_in': { color: '#c18401' },
              'hljs-class .hljs-title': { color: '#c18401' },
              'hljs-attr': { color: '#986801' },
              'hljs-variable': { color: '#986801' },
              'hljs-template-variable': { color: '#986801' },
              'hljs-type': { color: '#986801' },
              'hljs-selector-class': { color: '#986801' },
              'hljs-selector-attr': { color: '#986801' },
              'hljs-selector-pseudo': { color: '#986801' },
              'hljs-number': { color: '#986801' },
              'hljs-symbol': { color: '#4078f2' },
              'hljs-bullet': { color: '#4078f2' },
              'hljs-link': { color: '#4078f2', textDecoration: 'underline' },
              'hljs-meta': { color: '#4078f2' },
              'hljs-selector-id': { color: '#4078f2' },
              'hljs-title': { color: '#4078f2' },
              'hljs-emphasis': { fontStyle: 'italic' },
              'hljs-strong': { fontWeight: 'bold' },
            }}
            customStyle={{
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              margin: 0
            }}
          >
            {value}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  return (
    <div className="message-markdown relative p-2.5">
      {contentWithoutCodeBlocks.includes('CODE_BLOCK_') ? (
        <div
          className="markdown-html prose prose-sm dark:prose-invert max-w-none 
            prose-p:my-2 prose-p:leading-relaxed
            prose-pre:my-0 prose-pre:p-0 
            prose-code:text-sm prose-code:font-normal
            prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5
            prose-li:my-0.5 prose-li:pl-0.5
            prose-table:my-2 prose-table:border-collapse
            prose-headings:font-semibold prose-h2:text-lg prose-h3:text-base 
            prose-h2:mt-4 prose-h2:mb-3 prose-h3:mt-3 prose-h3:mb-2
            prose-hr:my-4"
        >
          {contentWithoutCodeBlocks.split(/CODE_BLOCK_(\d+)/).map((part, i) => {
            // Every odd index is a code block reference
            if (i % 2 === 1) {
              const blockIndex = parseInt(part, 10);
              const codeBlock = codeBlocks[blockIndex];
              return codeBlock ? 
                <CodeBlock 
                  key={`code-${blockIndex}`} 
                  language={codeBlock.language} 
                  value={codeBlock.value} 
                  index={blockIndex} 
                /> : null;
            }
            // Even indices are regular text
            return part ? <ReactMarkdown 
              key={`text-${i}`}
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {part}
            </ReactMarkdown> : null;
          })}
        </div>
      ) : (
        <ReactMarkdown
          components={{
            ...markdownComponents,
            code(props: ReactMarkdownComponentProps) {
              const { className, children } = props;
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';
              
              // For code blocks with language, use our CodeBlock component
              if (className && match) {
                const currentIndex = codeBlocks.findIndex(block => block.language === language);
                return (
                  <CodeBlock
                    language={language}
                    value={String(children).replace(/\n$/, '')}
                    index={currentIndex}
                    {...props}
                  />
                );
              }
              
              // For inline code, use the code component from markdownComponents
              return markdownComponents.code(props);
            }
          }}
          remarkPlugins={[remarkGfm]}
          className="markdown-content"
        >
          {contentWithoutCodeBlocks}
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

export const AnalysisStepsSection: React.FC = () => {
  // Always return null to hide the analysis steps section
  return null;
  
  // if (!steps.length) return null;
  // 
  // return (
  //   <details className="mt-4 border rounded-md">
  //     <summary className="px-3 py-2 bg-gray-50 cursor-pointer font-medium">
  //       Step-by-Step Analysis
  //     </summary>
  //     <div className="px-4 py-2">
  //       <ol className="list-decimal pl-5 space-y-2">
  //         {steps.map((step, i) => (
  //           <li key={`analysis-step-${i}`} className="text-gray-700">{step}</li>
  //         ))}
  //       </ol>
  //     </div>
  //   </details>
  // );
}; 