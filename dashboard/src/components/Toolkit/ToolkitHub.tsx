import React, { useState } from 'react';
import { 
  Wrench, 
  Share2, 
  Download, 
  Upload, 
  Filter,
  Sliders,
  Settings,
  FileText,
  Code,
  Palette,
  Database,
  Key
} from 'lucide-react';

interface ToolCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: 'visualization' | 'data' | 'export' | 'settings';
}

const sampleTools: ToolCard[] = [
  {
    id: "tool-1",
    title: "Chart Customizer",
    description: "Fine-tune visualization appearance and behavior",
    icon: Palette,
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400",
    category: "visualization"
  },
  {
    id: "tool-2",
    title: "Data Transformer",
    description: "Apply transformations to your datasets",
    icon: Sliders,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
    category: "data"
  },
  {
    id: "tool-3",
    title: "Export Manager",
    description: "Export visualizations and data in various formats",
    icon: Download,
    color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
    category: "export"
  },
  {
    id: "tool-4",
    title: "Data Filter",
    description: "Create complex filters for your dashboard data",
    icon: Filter,
    color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
    category: "data"
  },
  {
    id: "tool-5",
    title: "Theme Editor",
    description: "Customize colors, fonts, and styling across visualizations",
    icon: Palette,
    color: "text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400",
    category: "visualization"
  },
  {
    id: "tool-6",
    title: "Data Import",
    description: "Import data from various sources and formats",
    icon: Upload,
    color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400",
    category: "data"
  },
  {
    id: "tool-7",
    title: "PDF Export",
    description: "Generate high-quality PDF reports from your dashboard",
    icon: FileText,
    color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
    category: "export"
  },
  {
    id: "tool-8",
    title: "SQL Query Editor",
    description: "Write custom SQL queries to extract specific data",
    icon: Code,
    color: "text-gray-600 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-400",
    category: "data"
  },
  {
    id: "tool-9",
    title: "API Connector",
    description: "Connect to external APIs for data integration",
    icon: Key,
    color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400",
    category: "data"
  },
  {
    id: "tool-10",
    title: "Schema Manager",
    description: "View and edit data schemas for optimal visualization",
    icon: Database,
    color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400",
    category: "data"
  },
  {
    id: "tool-11",
    title: "Global Settings",
    description: "Configure dashboard-wide settings and preferences",
    icon: Settings,
    color: "text-gray-800 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300",
    category: "settings"
  },
  {
    id: "tool-12",
    title: "Sharing Center",
    description: "Manage sharing settings and permissions",
    icon: Share2,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
    category: "settings"
  }
];

type ToolCategory = 'all' | 'visualization' | 'data' | 'export' | 'settings';

export const ToolkitHub: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  
  const filteredTools = sampleTools.filter(tool => {
    // Filter by search term
    const matchesSearch = tool.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by category
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Toolkit</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Tools and utilities to enhance your dashboard experience
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search tools..."
            className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-1 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {(['all', 'visualization', 'data', 'export', 'settings'] as const).map((category) => (
            <button
              key={category}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                activeCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map(tool => (
          <div 
            key={tool.id} 
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 flex cursor-pointer"
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${tool.color.split(' ').slice(1).join(' ')}`}>
              {React.createElement(tool.icon, { className: `w-6 h-6 ${tool.color.split(' ')[0]}` })}
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{tool.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{tool.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No tools found</h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Try adjusting your search or filter to find what you're looking for.
          </p>
        </div>
      )}
      
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">About Toolkit</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          The Toolkit tab provides access to a variety of utilities designed to enhance your dashboard experience. 
          Customize visualizations, transform data, export to different formats, and more with these powerful tools.
        </p>
      </div>
    </div>
  );
}; 