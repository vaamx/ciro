import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'framer-motion';
import { type MessageMetadata } from '../types';
import { Visualization } from '../../Visualization';
import { ClipboardIcon, CheckIcon, ChevronDownIcon } from './icons';
import type { Components } from 'react-markdown';

interface MessageMarkdownProps {
  content: string;
  metadata?: MessageMetadata;
}

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lines = value.split('\n').length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {lines > 15 && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 
              text-gray-300 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand code' : 'Collapse code'}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 180 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="w-4 h-4" />
            </motion.div>
          </button>
        )}
        <motion.button
          onClick={handleCopy}
          className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 
            text-gray-300 hover:text-white transition-colors"
          title={isCopied ? 'Copied!' : 'Copy code'}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isCopied ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <CheckIcon className="w-4 h-4 text-green-500" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <ClipboardIcon className="w-4 h-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      <div className="rounded-t-lg bg-gray-800 px-4 py-2 text-sm text-gray-400 flex items-center justify-between">
        <span>{language}</span>
        <span className="text-gray-500">{lines} lines</span>
      </div>
      <motion.div
        animate={{ height: isCollapsed ? 200 : 'auto' }}
        transition={{ duration: 0.2 }}
        className={`relative ${isCollapsed ? 'overflow-hidden' : ''}`}
      >
        <SyntaxHighlighter
          language={language}
          style={atomDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '0.5rem',
            borderBottomRightRadius: '0.5rem',
          }}
          codeTagProps={{
            className: 'text-sm font-mono'
          }}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#6B7280',
            textAlign: 'right',
            userSelect: 'none',
          }}
        >
          {value}
        </SyntaxHighlighter>
        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
        )}
      </motion.div>
    </div>
  );
};

export const MessageMarkdown: React.FC<MessageMarkdownProps> = ({ content, metadata }) => {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const value = String(children).replace(/\n$/, '');
      
      if (!className) {
        return (
          <code className={className} {...props}>
            {value}
          </code>
        );
      }

      return match ? (
        <CodeBlock
          language={match[1]}
          value={value}
        />
      ) : (
        <code className={className} {...props}>
          {value}
        </code>
      );
    },
    // Enhance link rendering
    a({ children, href, ...props }) {
      const isExternal = href?.startsWith('http');
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-1"
          {...props}
        >
          {children}
          {isExternal && (
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          )}
        </a>
      );
    },
    // Enhance table rendering
    table({ children, ...props }) {
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...props}>
            {children}
          </table>
        </div>
      );
    },
    th({ children, ...props }) {
      return (
        <th
          className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800
            text-gray-900 dark:text-white sticky top-0"
          {...props}
        >
          {children}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td
          className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 
            border-t border-gray-200 dark:border-gray-700"
          {...props}
        >
          {children}
        </td>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="border-l-4 border-indigo-500/30 dark:border-indigo-400/30 
            bg-indigo-50 dark:bg-indigo-900/20 pl-4 py-2 my-2 rounded-r-lg"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
  };

  return (
    <>
      <div className="prose dark:prose-invert max-w-none prose-pre:p-0 
        prose-headings:mb-3 prose-headings:mt-6 first:prose-headings:mt-0
        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
        prose-p:my-3 prose-p:leading-relaxed
        prose-a:text-indigo-600 dark:prose-a:text-indigo-400 
        prose-a:no-underline hover:prose-a:underline
        prose-code:before:content-none prose-code:after:content-none
        prose-code:bg-gray-100 dark:prose-code:bg-gray-800 
        prose-code:rounded prose-code:px-1.5 prose-code:py-0.5
        prose-code:text-sm prose-code:font-medium
        prose-ul:my-3 prose-li:my-1
        prose-img:rounded-lg prose-img:shadow-md
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>

      {metadata?.visualization && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 
            p-4 bg-white dark:bg-gray-800 shadow-sm"
        >
          <Visualization
            type={metadata.visualization.type}
            config={metadata.visualization.config}
          />
        </motion.div>
      )}
    </>
  );
}; 