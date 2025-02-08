import React from 'react';
import { 
  Database, 
  Bot, 
  Workflow, 
  MessageSquare,
  Eye,
  Edit,
  Filter
} from 'lucide-react';

interface Activity {
  id: number;
  type: 'data' | 'automation' | 'agent' | 'integration';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
  icon: React.ElementType;
}

const activities: Activity[] = [
  {
    id: 1,
    type: 'data',
    title: 'Salesforce CRM data sync completed',
    description: 'Successfully synced 2,500 records',
    timestamp: '2 mins ago',
    status: 'success',
    icon: Database
  },
  {
    id: 2,
    type: 'automation',
    title: 'Lead scoring automation triggered',
    description: 'Processing 150 new leads',
    timestamp: '15 mins ago',
    status: 'info',
    icon: Workflow
  },
  {
    id: 3,
    type: 'agent',
    title: 'Customer service bot updated',
    description: 'New response patterns added',
    timestamp: '1 hour ago',
    status: 'success',
    icon: Bot
  },
  {
    id: 4,
    type: 'data',
    title: 'Failed to connect to PostgreSQL database',
    description: 'Connection timeout after 30s',
    timestamp: '2 hours ago',
    status: 'error',
    icon: Database
  },
  {
    id: 5,
    type: 'integration',
    title: 'New Slack integration deployed',
    description: 'Notifications enabled for high-priority events',
    timestamp: '3 hours ago',
    status: 'success',
    icon: MessageSquare
  }
];

const filterTabs = [
  { id: 'all', label: 'All Activities' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'automations', label: 'Automations' },
  { id: 'agents', label: 'Agents' },
  { id: 'errors', label: 'Errors' }
];

export const ActivityTimeline: React.FC = () => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500 dark:bg-green-400';
      case 'error':
        return 'bg-red-500 dark:bg-red-400';
      case 'warning':
        return 'bg-yellow-500 dark:bg-yellow-400';
      case 'info':
        return 'bg-blue-500 dark:bg-blue-400';
      default:
        return 'bg-gray-500 dark:bg-gray-400';
    }
  };

  const getIconBackground = (type: string) => {
    switch (type) {
      case 'data':
        return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
      case 'automation':
        return 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
      case 'agent':
        return 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400';
      case 'integration':
        return 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
      default:
        return 'bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2 overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              className="px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap
                bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700
                transition-colors duration-150"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
        
        <div className="space-y-6">
          {activities.map((activity) => (
            <div key={activity.id} className="relative flex items-start ml-8">
              {/* Status Dot */}
              <div className={`absolute -left-[25px] mt-2 w-3 h-3 rounded-full ${getStatusColor(activity.status)}`} />
              
              {/* Activity Card */}
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${getIconBackground(activity.type)}`}>
                    <activity.icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {activity.title}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                        {activity.timestamp}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {activity.description}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 