import React, { useState } from 'react';
import { 
  Brain, 
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
  Code,
  Database,
  Zap,
  ArrowRight,
  History,
  Activity
} from 'lucide-react';

interface DecisionRule {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'paused' | 'archived';
  lastModified: string;
  type: string;
  triggers: string[];
  conditions: string[];
  actions: string[];
  performance: {
    executed: number;
    successful: number;
    failed: number;
    avgResponseTime: string;
  };
}

const decisionCategories = [
  { id: 'all', name: 'All Rules' },
  { id: 'active', name: 'Active Rules' },
  { id: 'draft', name: 'Drafts' },
  { id: 'paused', name: 'Paused' },
  { id: 'archived', name: 'Archived' }
];

const decisionRules: DecisionRule[] = [
  { 
    id: 1,
    name: 'Lead Scoring',
    description: 'Automatically score and qualify leads based on behavior and demographics',
    status: 'active',
    lastModified: '2 hours ago',
    type: 'Scoring',
    triggers: ['New Lead Created', 'Lead Activity Updated'],
    conditions: [
      'Website visits > 3 in last 7 days',
      'Downloaded whitepaper',
      'Company size > 100 employees'
    ],
    actions: [
      'Update lead score',
      'Assign to sales rep if score > 80',
      'Send personalized email'
    ],
    performance: {
      executed: 1250,
      successful: 1180,
      failed: 70,
      avgResponseTime: '1.2s'
    }
  },
  { 
    id: 2,
    name: 'Dynamic Pricing',
    description: 'Adjust product prices based on market demand and inventory levels',
    status: 'active',
    lastModified: '5 hours ago',
    type: 'Pricing',
    triggers: ['Inventory Update', 'Competitor Price Change'],
    conditions: [
      'Stock level < 20%',
      'Competitor price changed by >5%',
      'Peak shopping hours'
    ],
    actions: [
      'Calculate optimal price',
      'Update product pricing',
      'Notify management if >20% change'
    ],
    performance: {
      executed: 3500,
      successful: 3450,
      failed: 50,
      avgResponseTime: '0.8s'
    }
  },
  { 
    id: 3,
    name: 'Risk Assessment',
    description: 'Evaluate transaction risk levels for fraud prevention',
    status: 'paused',
    lastModified: '1 day ago',
    type: 'Security',
    triggers: ['New Transaction', 'User Login'],
    conditions: [
      'Transaction amount > $1000',
      'New device or location',
      'Multiple failed attempts'
    ],
    actions: [
      'Calculate risk score',
      'Flag for review if score > 0.7',
      'Request 2FA verification'
    ],
    performance: {
      executed: 8900,
      successful: 8800,
      failed: 100,
      avgResponseTime: '0.5s'
    }
  }
];

export const DecisionsView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRule, setSelectedRule] = useState<DecisionRule | null>(null);

  const filteredRules = decisionRules.filter(rule => 
    (activeCategory === 'all' || rule.status === activeCategory) &&
    rule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />;
      case 'draft':
        return <Clock className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-orange-500 dark:text-orange-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'draft':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'paused':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Decision Rules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create and manage automated business decision rules</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn-secondary dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Execution History</span>
          </button>
          <button className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600 flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Rule</span>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search decision rules..."
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
        {decisionCategories.map(category => (
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

      {/* Rules List */}
      <div className="space-y-4">
        {filteredRules.map(rule => (
          <div
            key={rule.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(rule.status)}`}>
                      {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rule.description}</p>

                  {/* Conditions */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conditions</h4>
                    <div className="space-y-2">
                      {rule.conditions.map((condition, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <div className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full" />
                          <span>{condition}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Actions</h4>
                    <div className="space-y-2">
                      {rule.actions.map((action, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <div className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full" />
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Executions</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {rule.performance.executed.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {((rule.performance.successful / rule.performance.executed) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Time</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {rule.performance.avgResponseTime}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {rule.status === 'active' ? (
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
        ))}
      </div>
    </div>
  );
}; 