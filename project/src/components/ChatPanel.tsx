import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { 
  Send, Bot, Plus, X
} from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  attachments?: Array<{
    type: 'image' | 'document';
    url: string;
    name: string;
  }>;
}

interface DataSource {
  id: string;
  name: string;
  icon: string;
  type: 'internal' | 'customer';
  description?: string;
}

const dataSources: { [key: string]: DataSource[] } = {
  internal: [
    { id: 'all-data', name: 'All Data Sources', icon: '🎯', type: 'internal', description: 'Query across all data sources' },
    { id: '***REMOVED***', name: 'PostgreSQL', icon: '🐘', type: 'internal', description: 'Production and analytics databases' },
    { id: 'supabase', name: 'Supabase', icon: '⚡', type: 'internal', description: 'Real-time and edge databases' },
    { id: 'bigquery', name: 'BigQuery', icon: '📊', type: 'internal', description: 'Data warehouse and analytics' },
    { id: 'snowflake', name: 'Snowflake', icon: '❄️', type: 'internal', description: 'Enterprise data warehouse' },
    { id: 'hubspot', name: 'HubSpot', icon: '🎯', type: 'internal', description: 'CRM and marketing data' },
    { id: 'gdrive', name: 'Google Drive', icon: '📁', type: 'internal', description: 'Documents and spreadsheets' },
    { id: 'notion', name: 'Notion', icon: '📝', type: 'internal', description: 'Team documentation and notes' },
    { id: 'metabase', name: 'Metabase', icon: '📈', type: 'internal', description: 'BI dashboards and reports' },
    { id: 'looker', name: 'Looker', icon: '👀', type: 'internal', description: 'Business intelligence platform' }
  ],
  customer: [
    { id: 'help-center', name: 'Help Center', icon: '💡', type: 'customer', description: 'Customer documentation and guides' },
    { id: 'api-docs', name: 'API Reference', icon: '🔌', type: 'customer', description: 'API documentation and examples' },
    { id: 'tutorials', name: 'Tutorials', icon: '📚', type: 'customer', description: 'Step-by-step guides and tutorials' },
    { id: 'faqs', name: 'FAQs', icon: '❓', type: 'customer', description: 'Frequently asked questions' },
    { id: 'community', name: 'Community', icon: '👥', type: 'customer', description: 'Community discussions and solutions' }
  ]
};

const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => (
  <SyntaxHighlighter
    language={language}
    style={atomOneDark}
    customStyle={{ 
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem 0',
      fontSize: '0.875rem'
    }}
  >
    {value}
  </SyntaxHighlighter>
);

// Animation variants
const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

const loadingVariants = {
  start: {
    opacity: 0.5,
    scale: 0.98,
  },
  loading: {
    opacity: [0.5, 1, 0.5],
    scale: [0.98, 1, 0.98],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }): JSX.Element => {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    type: 'assistant',
    content: "Hi! I'm your AI assistant. How can I help you today?",
    timestamp: new Date()
  }]);
  const [inputValue, setInputValue] = useState('');
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setIsSourceDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderMessageContent = (message: Message) => {
    const components: Components = {
      code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
          <CodeBlock 
            language={match[1]} 
            value={String(children).replace(/\n$/, '')} 
          />
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      table(props: React.ComponentPropsWithoutRef<'table'>) {
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y" {...props} />
          </div>
        );
      },
      th(props: React.ComponentPropsWithoutRef<'th'>) {
        return <th className="px-4 py-2 text-left bg-gray-50" {...props} />;
      },
      td(props: React.ComponentPropsWithoutRef<'td'>) {
        return <td className="px-4 py-2 border-t" {...props} />;
      }
    };

    return (
      <Markdown
        components={components}
        className="prose-sm max-w-none"
      >
        {message.content}
      </Markdown>
    );
  };

  const handleSendMessage = async (message?: string) => {
    const textToSend = message || inputValue;
    if (!textToSend.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: textToSend,
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const responseMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `I understand you're asking about "${textToSend}". Let me help you with that...`,
        timestamp: new Date(),
        status: 'sent'
      };

      setMessages(prev => [...prev, responseMessage]);
    }, 2000);
  };

  return (
    <>
      {/* Chat Button with enhanced animation */}
      <motion.button
        onClick={onClose}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 z-50 md:bottom-8 md:right-8"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open chat"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium">Ask Ciro AI</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 right-0 w-full h-[100dvh] md:bottom-24 md:right-6 md:w-[650px] md:h-[600px] bg-white dark:bg-gray-800 rounded-none md:rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
              <div className="flex items-center space-x-3">
                {/* Logo/Avatar */}
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-lg font-semibold text-gray-800 dark:text-white">Ask Ciro AI</h1>
                </div>

                {/* Add Data Source Button */}
                <div className="relative" ref={sourceDropdownRef}>
                  <motion.button
                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                    <span className="text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white text-sm">Add Source</span>
                  </motion.button>

                  <AnimatePresence>
                    {isSourceDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-1 w-[280px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 z-50"
                        style={{ maxHeight: '400px', overflowY: 'auto' }}
                      >
                        {Object.entries(dataSources).map(([category, sources]) => (
                          <div key={category} className="py-1">
                            <div className="sticky top-0 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                              {category === 'internal' ? 'Internal Sources' : 'Customer-Facing'}
                            </div>
                            {sources.map((source) => (
                              <button
                                key={source.id}
                                onClick={() => {
                                  setIsSourceDropdownOpen(false);
                                  handleSendMessage(`Tell me about ${source.name}`);
                                }}
                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                <span className="text-lg mr-2">{source.icon}</span>
                                <div className="flex flex-col items-start">
                                  <span>{source.name}</span>
                                  {source.description && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{source.description}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <motion.button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </motion.button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              <div className="min-h-full flex flex-col">
                {messages.length === 1 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 flex flex-col items-center justify-center p-6 space-y-6"
                  >
                    {/* Large Logo */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Bot className="w-10 h-10 text-white" />
                    </div>

                    {/* Welcome Message */}
                    <div className="text-center space-y-2">
                      <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Welcome to Ciro AI</h2>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm">Ask me anything about your data or get help with our products</p>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                      <button
                        onClick={() => handleSendMessage("Show me our key metrics")}
                        className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">📊</span>
                          <span className="font-medium text-gray-800 dark:text-white">Analytics</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Query your data and metrics</p>
                      </button>
                      <button
                        onClick={() => handleSendMessage("Help me with integration")}
                        className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg">🔌</span>
                          <span className="font-medium text-gray-800 dark:text-white">Integration</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Get integration help</p>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-1 p-6 space-y-6">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        variants={messageVariants}
                        initial="hidden"
                        animate={message.status === 'sending' ? "loading" : "visible"}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.type === 'assistant' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mr-3 shadow-sm"
                          >
                            <Bot className="w-6 h-6 text-white" />
                          </motion.div>
                        )}
                        <motion.div
                          variants={loadingVariants}
                          className={`max-w-[70%] ${
                            message.type === 'user'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                          } rounded-2xl p-4 shadow-sm`}
                          whileHover={{ scale: 1.01 }}
                        >
                          <div className={message.type === 'assistant' ? 'text-gray-800 dark:text-white' : ''}>
                            {renderMessageContent(message)}
                          </div>
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="w-full pl-4 pr-12 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                />
                <button
                  onClick={() => handleSendMessage(inputValue)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Simplified Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline">Powered by</span>
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Ciro AI</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};