import React from 'react';
import { 
  BarChart3, 
  Brain, 
  Workflow, 
  MessageSquare, 
  Database,
  ArrowUpRight,
  Activity,
  Link,
  Cloud
} from 'lucide-react';

// Mock data for the overview dashboard
const overviewData = [
  { title: 'Active Data Sources', value: '12', trend: '+2.5%', timeframe: 'vs last month', icon: Database },
  { title: 'Connected Apps', value: '8', trend: '+1.2%', timeframe: 'vs last month', icon: Link },
  { title: 'Active Automations', value: '15', trend: '+3.8%', timeframe: 'vs last month', icon: Workflow },
  { title: 'AI Agents', value: '5', trend: '+1', timeframe: 'New this month', icon: Brain }
];

const recentActivity = [
  { type: 'data', message: 'New Salesforce CRM connected', time: '2 mins ago', icon: Database },
  { type: 'automation', message: 'Lead scoring automation triggered', time: '15 mins ago', icon: Workflow },
  { type: 'agent', message: 'Customer service bot updated', time: '1 hour ago', icon: MessageSquare },
  { type: 'integration', message: 'Slack integration activated', time: '2 hours ago', icon: Link }
];

const connectedResources = [
  { name: 'Salesforce', type: 'CRM', status: 'Active', lastSync: '5 mins ago' },
  { name: 'HubSpot', type: 'Marketing', status: 'Active', lastSync: '10 mins ago' },
  { name: 'Slack', type: 'Communication', status: 'Active', lastSync: '2 mins ago' },
  { name: 'Google Drive', type: 'Storage', status: 'Active', lastSync: '15 mins ago' }
];

export const Overview: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewData.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <stat.icon className="w-6 h-6 text-purple-600" />
              </div>
              <span className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                {stat.trend}
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </span>
            </div>
            <h3 className="text-gray-500 text-sm">{stat.title}</h3>
            <p className="text-2xl font-semibold mt-1">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.timeframe}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
              <p className="text-sm text-gray-500">Real-time updates across your workspace</p>
            </div>
            <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="p-2 bg-purple-50 rounded">
                  <activity.icon className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{activity.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connected Resources */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Connected Resources</h2>
              <p className="text-sm text-gray-500">Active integrations and services</p>
            </div>
            <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
              Manage
            </button>
          </div>
          <div className="space-y-4">
            {connectedResources.map((resource, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-50 rounded">
                    <Cloud className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{resource.name}</p>
                    <p className="text-xs text-gray-500">{resource.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-600">{resource.status}</p>
                  <p className="text-xs text-gray-500">Last sync: {resource.lastSync}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 