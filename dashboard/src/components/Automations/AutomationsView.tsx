import React, { useState } from 'react';
import { 
  Workflow,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  Trash2,
  Play,
  Pause,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  Users,
  DollarSign,
  Box,
  BarChart2,
  History,
  ExternalLink,
  Activity
} from 'lucide-react';

interface AutomationFlow {
  id: number;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'draft' | 'paused' | 'error';
  lastRun: string;
  schedule: string;
  integrations: string[];
  steps: {
    type: string;
    description: string;
  }[];
  metrics: {
    runsToday: number;
    successRate: number;
    avgTime: string;
    lastError?: string;
  };
}

const automationCategories = [
  { 
    id: 'communication', 
    name: 'Communication', 
    icon: MessageSquare,
    description: 'Email, chat, and notification automations'
  },
  { 
    id: 'crm', 
    name: 'CRM & Sales', 
    icon: Users,
    description: 'Lead and customer relationship automations'
  },
  { 
    id: 'documents', 
    name: 'Documents', 
    icon: FileText,
    description: 'Document processing and management'
  },
  { 
    id: 'calendar', 
    name: 'Calendar', 
    icon: Calendar,
    description: 'Meeting and event scheduling'
  },
  { 
    id: 'finance', 
    name: 'Finance', 
    icon: DollarSign,
    description: 'Billing and payment processing'
  },
  { 
    id: 'data', 
    name: 'Data Sync', 
    icon: Box,
    description: 'Data synchronization between systems'
  },
  { 
    id: 'reporting', 
    name: 'Reporting', 
    icon: BarChart2,
    description: 'Automated report generation and distribution'
  }
];

const automationFlows: AutomationFlow[] = [
  {
    id: 1,
    name: 'Customer Welcome Sequence',
    description: 'Automated onboarding emails and resource sharing for new customers',
    category: 'communication',
    status: 'active',
    lastRun: '5 mins ago',
    schedule: 'On new customer signup',
    integrations: ['Gmail', 'HubSpot', 'Google Drive'],
    steps: [
      { type: 'trigger', description: 'New customer added to HubSpot' },
      { type: 'delay', description: 'Wait 1 hour' },
      { type: 'email', description: 'Send welcome email' },
      { type: 'condition', description: 'Check if resources accessed' },
      { type: 'action', description: 'Add to onboarding sequence' }
    ],
    metrics: {
      runsToday: 1250,
      successRate: 1200,
      avgTime: '1.5m'
    }
  },
  {
    id: 2,
    name: 'Weekly Sales Report',
    description: 'Generate and distribute weekly sales performance reports',
    category: 'reporting',
    status: 'active',
    lastRun: '2 days ago',
    schedule: 'Every Monday at 6am',
    integrations: ['Salesforce', 'Slack', 'Google Sheets'],
    steps: [
      { type: 'schedule', description: 'Monday 6am trigger' },
      { type: 'data', description: 'Pull Salesforce data' },
      { type: 'process', description: 'Generate report' },
      { type: 'action', description: 'Save to Google Sheets' },
      { type: 'notification', description: 'Send Slack notification' }
    ],
    metrics: {
      runsToday: 52,
      successRate: 50,
      avgTime: '3.2m'
    }
  },
  {
    id: 3,
    name: 'Invoice Processing',
    description: 'Automated invoice processing and payment tracking',
    category: 'finance',
    status: 'error',
    lastRun: '1 hour ago',
    schedule: 'Every 15 minutes',
    integrations: ['QuickBooks', 'Bank API', 'Gmail'],
    steps: [
      { type: 'trigger', description: 'New invoice email received' },
      { type: 'process', description: 'Extract invoice data' },
      { type: 'action', description: 'Create QuickBooks entry' },
      { type: 'payment', description: 'Schedule payment' },
      { type: 'email', description: 'Send confirmation' }
    ],
    metrics: {
      runsToday: 5000,
      successRate: 4980,
      avgTime: '45s',
      lastError: 'QuickBooks API timeout'
    }
  },
  {
    id: 4,
    name: 'Meeting Scheduler',
    description: 'Automated meeting scheduling and reminder system',
    category: 'calendar',
    status: 'active',
    lastRun: '10 mins ago',
    schedule: 'On calendar event creation',
    integrations: ['Google Calendar', 'Zoom', 'Slack'],
    steps: [
      { type: 'trigger', description: 'Calendar event created' },
      { type: 'action', description: 'Create Zoom meeting' },
      { type: 'email', description: 'Send invitations' },
      { type: 'delay', description: 'Wait until 1 hour before' },
      { type: 'notification', description: 'Send reminders' }
    ],
    metrics: {
      runsToday: 850,
      successRate: 848,
      avgTime: '30s'
    }
  }
];

export const AutomationsView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlow, setSelectedFlow] = useState<AutomationFlow | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredFlows = automationFlows.filter(flow => 
    (!activeCategory || activeCategory === 'all' || flow.category === activeCategory) &&
    flow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'draft':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-orange-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'draft':
        return 'bg-yellow-100 text-yellow-700';
      case 'paused':
        return 'bg-orange-100 text-orange-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Automations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Build and manage automated workflows</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn-secondary dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Execution History</span>
          </button>
          <button className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Automation</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search automations..."
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

      {/* Categories */}
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {automationCategories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              activeCategory === category.id
                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Automations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFlows.map(flow => (
          <div
            key={flow.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <Workflow className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{flow.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{flow.description}</p>
                  </div>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  flow.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Runs Today</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {flow.metrics.runsToday}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {flow.metrics.successRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Time</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {flow.metrics.avgTime}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between">
                <button className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                  View Details
                </button>
                <div className="flex items-center space-x-2">
                  {flow.status === 'active' ? (
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

        {/* Add New Automation Card */}
        <button
          className="h-full min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
        >
          <div className="text-center">
            <Plus className="w-8 h-8 text-gray-400 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 mx-auto mb-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-300">
              Create New Automation
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}; 