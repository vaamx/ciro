import React, { useState } from 'react';
import { 
  MessageSquare,
  Plus,
  Search,
  Filter,
  Settings,
  Trash2,
  Play,
  Pause,
  Phone,
  History,
  BarChart2
} from 'lucide-react';

interface Tab {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
}

const tabs: Tab[] = [
  { id: 'chat', name: 'Chat Agents', icon: MessageSquare },
  { id: 'voice', name: 'Voice Agents', icon: Phone },
  { id: 'analytics', name: 'Analytics', icon: BarChart2 }
];

interface Agent {
  id: number;
  name: string;
  description: string;
  type: 'chatbot' | 'voice';
  status: 'online' | 'offline';
  metrics: {
    activeChats: number;
    responseRate: number;
    avgResponse: string;
  };
}

const agents: Agent[] = [
  {
    id: 1,
    name: 'Customer Support Bot',
    description: 'Handles general customer inquiries and support tickets',
    type: 'chatbot',
    status: 'online',
    metrics: {
      activeChats: 24,
      responseRate: 95,
      avgResponse: '30s'
    }
  },
  {
    id: 2,
    name: 'Sales Assistant',
    description: 'Helps with product recommendations and sales inquiries',
    type: 'chatbot',
    status: 'online',
    metrics: {
      activeChats: 18,
      responseRate: 92,
      avgResponse: '45s'
    }
  },
  {
    id: 3,
    name: 'Technical Support',
    description: 'Provides technical troubleshooting and assistance',
    type: 'voice',
    status: 'offline',
    metrics: {
      activeChats: 0,
      responseRate: 88,
      avgResponse: '1m'
    }
  }
];

export const CommunicationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Communications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage chat and voice agents</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn-secondary dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Chat History</span>
          </button>
          <button className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Agent</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 relative ${
                activeTab === tab.id
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center space-x-2">
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.name}</span>
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 dark:bg-purple-400" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex space-x-2">
          <button className="btn-secondary dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    {agent.type === 'chatbot' ? (
                      <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Phone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{agent.description}</p>
                  </div>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  agent.status === 'online'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active Chats</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {agent.metrics.activeChats}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Response Rate</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {agent.metrics.responseRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Response</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {agent.metrics.avgResponse}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between">
                <button className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                  View Details
                </button>
                <div className="flex items-center space-x-2">
                  {agent.status === 'online' ? (
                    <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
                      <Pause className="w-5 h-5" />
                    </button>
                  ) : (
                    <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors">
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                  <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                  <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Agent Card */}
        <button
          className="h-full min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
        >
          <div className="text-center">
            <Plus className="w-8 h-8 text-gray-400 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 mx-auto mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-300">
              Create New Agent
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}; 