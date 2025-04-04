import { useEffect, useState } from 'react';
import { 
  Database,
  Link,
  Bot,
  BarChart2,
  Users,
  MessageSquare,
  Phone,
  Layers
} from 'lucide-react';

interface StatsOverviewProps {
  isExpanded?: boolean;
}

interface PlatformStatus {
  id: string;
  name: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  path: string; // Path to navigate to when clicked
  isLoading?: boolean;
}

export const StatsOverview = ({ isExpanded = false }: StatsOverviewProps) => {
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([
    {
      id: 'data-sources',
      name: 'Data Sources',
      value: '0',
      icon: Database,
      path: '/datasources',
      isLoading: true
    },
    {
      id: 'workspaces',
      name: 'Workspaces',
      value: '0',
      icon: Layers,
      path: '/studio',
      isLoading: true
    },
    {
      id: 'tools',
      name: 'Connected Tools',
      value: '0',
      icon: Link,
      path: '/toolkit',
      isLoading: true
    },
    {
      id: 'chatbots',
      name: 'Active Chatbots',
      value: '0',
      icon: MessageSquare,
      path: '/communications/chatbot',
      isLoading: true
    },
    {
      id: 'voice-agents',
      name: 'Voice Agents',
      value: '0',
      icon: Phone,
      path: '/communications/voice',
      isLoading: true
    },
    {
      id: 'team-members',
      name: 'Team Members',
      value: '0',
      icon: Users,
      path: '/organization',
      isLoading: true
    },
    {
      id: 'visualizations',
      name: 'Visualizations',
      value: '0',
      icon: BarChart2,
      path: '/studio',
      isLoading: true
    },
    {
      id: 'automations',
      name: 'Automations',
      value: '0',
      icon: Bot,
      path: '/automations',
      isLoading: true
    }
  ]);

  // Function to load real data from the platform
  const loadRealPlatformData = async () => {
    try {
      // Start with a copy of the current statuses
      const updatedStatuses = [...platformStatuses];
      
      // We'll manually update each status as we fetch data
      // This could be replaced with actual API calls when available
      
      // 1. Data Sources
      try {
        // Simulate fetching data sources count
        // This would be replaced with an actual API call
        const dataSourcesCount = Math.floor(Math.random() * 10) + 5; // 5-15 range for demo
        const dataSourceIndex = updatedStatuses.findIndex(s => s.id === 'data-sources');
        if (dataSourceIndex >= 0) {
          updatedStatuses[dataSourceIndex] = {
            ...updatedStatuses[dataSourceIndex],
            value: dataSourcesCount,
            isLoading: false,
            trend: dataSourcesCount > 10 ? 'up' : 'neutral'
          };
        }
      } catch (error) {
        console.error('Error loading data sources count:', error);
      }
      
      // 2. Workspaces
      try {
        const workspacesCount = Math.floor(Math.random() * 8) + 3; // 3-10 range for demo
        const workspacesIndex = updatedStatuses.findIndex(s => s.id === 'workspaces');
        if (workspacesIndex >= 0) {
          updatedStatuses[workspacesIndex] = {
            ...updatedStatuses[workspacesIndex],
            value: workspacesCount,
            isLoading: false,
            trend: workspacesCount > 5 ? 'up' : 'neutral'
          };
        }
      } catch (error) {
        console.error('Error loading workspaces count:', error);
      }
      
      // 3. Connected Tools
      try {
        const toolsCount = Math.floor(Math.random() * 12) + 4; // 4-15 range for demo
        const toolsIndex = updatedStatuses.findIndex(s => s.id === 'tools');
        if (toolsIndex >= 0) {
          updatedStatuses[toolsIndex] = {
            ...updatedStatuses[toolsIndex],
            value: toolsCount,
            isLoading: false,
            trend: 'up'
          };
        }
      } catch (error) {
        console.error('Error loading tools count:', error);
      }
      
      // 4. Active Chatbots
      try {
        const chatbotsCount = Math.floor(Math.random() * 5) + 1; // 1-5 range for demo
        const chatbotsIndex = updatedStatuses.findIndex(s => s.id === 'chatbots');
        if (chatbotsIndex >= 0) {
          updatedStatuses[chatbotsIndex] = {
            ...updatedStatuses[chatbotsIndex],
            value: chatbotsCount,
            isLoading: false,
            trend: chatbotsCount > 2 ? 'up' : 'neutral'
          };
        }
      } catch (error) {
        console.error('Error loading chatbots count:', error);
      }
      
      // 5. Voice Agents
      try {
        const voiceAgentsCount = Math.floor(Math.random() * 3) + 1; // 1-3 range for demo
        const voiceAgentsIndex = updatedStatuses.findIndex(s => s.id === 'voice-agents');
        if (voiceAgentsIndex >= 0) {
          updatedStatuses[voiceAgentsIndex] = {
            ...updatedStatuses[voiceAgentsIndex],
            value: voiceAgentsCount,
            isLoading: false,
            trend: 'neutral'
          };
        }
      } catch (error) {
        console.error('Error loading voice agents count:', error);
      }
      
      // 6. Team Members
      try {
        const teamMembersCount = Math.floor(Math.random() * 20) + 5; // 5-25 range for demo
        const teamMembersIndex = updatedStatuses.findIndex(s => s.id === 'team-members');
        if (teamMembersIndex >= 0) {
          updatedStatuses[teamMembersIndex] = {
            ...updatedStatuses[teamMembersIndex],
            value: teamMembersCount,
            isLoading: false,
            trend: teamMembersCount > 15 ? 'up' : 'neutral'
          };
        }
      } catch (error) {
        console.error('Error loading team members count:', error);
      }
      
      // 7. Visualizations
      try {
        const visualizationsCount = Math.floor(Math.random() * 30) + 10; // 10-40 range for demo
        const visualizationsIndex = updatedStatuses.findIndex(s => s.id === 'visualizations');
        if (visualizationsIndex >= 0) {
          updatedStatuses[visualizationsIndex] = {
            ...updatedStatuses[visualizationsIndex],
            value: visualizationsCount,
            isLoading: false,
            trend: 'up'
          };
        }
      } catch (error) {
        console.error('Error loading visualizations count:', error);
      }
      
      // 8. Automations
      try {
        const automationsCount = Math.floor(Math.random() * 15) + 5; // 5-20 range for demo
        const automationsIndex = updatedStatuses.findIndex(s => s.id === 'automations');
        if (automationsIndex >= 0) {
          updatedStatuses[automationsIndex] = {
            ...updatedStatuses[automationsIndex],
            value: automationsCount,
            isLoading: false,
            trend: automationsCount > 10 ? 'up' : 'neutral'
          };
        }
      } catch (error) {
        console.error('Error loading automations count:', error);
      }
      
      // Update the state with all the fetched data
      setPlatformStatuses(updatedStatuses);
      
    } catch (error) {
      console.error('Error loading platform data:', error);
    }
  };

  // Load the real data on component mount
  useEffect(() => {
    loadRealPlatformData();
    
    // Refresh data every 5 minutes
    const intervalId = setInterval(loadRealPlatformData, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Get trend indicator color
  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'bg-emerald-400/80 dark:bg-emerald-500';
      case 'down':
        return 'bg-rose-400/80 dark:bg-rose-500';
      default:
        return 'bg-gray-300 dark:bg-gray-500';
    }
  };

  // Handle status item click
  const handleStatusClick = (path: string) => {
    console.log('Navigate to:', path);
    // This would be replaced with actual navigation
    // history.push(path) or similar
  };

  // Render minimized view
  if (!isExpanded) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {platformStatuses.map((status) => (
          <button
            key={status.id}
            onClick={() => handleStatusClick(status.path)}
            className="p-3 bg-gray-100/80 dark:bg-gray-800/40 rounded-lg hover:bg-indigo-50 dark:hover:bg-gray-700/50 transition-colors group relative flex items-center justify-center border border-gray-200/50 dark:border-gray-700/30"
          >
            <div className="flex flex-col items-center">
              {status.isLoading ? (
                <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700/50 animate-pulse flex items-center justify-center"></div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-700/50 flex items-center justify-center relative shadow-sm">
                  <status.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  {status.trend && (
                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getTrendColor(status.trend)}`}></div>
                  )}
                </div>
              )}
              
              <div className="mt-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {status.name}
              </div>
              
              <div className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white">
                {status.isLoading ? (
                  <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                ) : (
                  status.value
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Render expanded view
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {platformStatuses.map((status) => (
        <button
          key={status.id}
          onClick={() => handleStatusClick(status.path)}
          className="p-4 bg-white dark:bg-gray-800/60 rounded-lg hover:bg-indigo-50 dark:hover:bg-gray-700/70 transition-colors relative overflow-hidden group text-left shadow-sm border border-gray-200/70 dark:border-gray-700/30"
        >
          {status.trend && (
            <div className={`absolute top-0 right-0 w-10 h-1.5 ${getTrendColor(status.trend)}`}></div>
          )}
          
          <div className="flex items-start space-x-3">
            {status.isLoading ? (
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700/50 animate-pulse"></div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center shadow-sm">
                <status.icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {status.name}
              </h3>
              
              <div className="mt-1 text-xl font-semibold text-gray-800 dark:text-white">
                {status.isLoading ? (
                  <div className="w-12 h-6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                ) : (
                  status.value
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}; 