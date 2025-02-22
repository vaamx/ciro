import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  Brain, 
  Workflow, 
  MessageSquare,
  HelpCircle,
  Building2
} from 'lucide-react';

interface SidebarProps {
  onHelpClick: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { name: 'Overview', icon: LayoutDashboard, section: 'overview', path: '/overview', description: 'Dashboard overview and insights' },
  { name: 'Data Sources', icon: Database, section: 'data', path: '/data-sources', description: 'Connect and analyze your data sources' },
  { name: 'Decisions', icon: Brain, section: 'decisions', path: '/decisions', description: 'Create and manage decision rules' },
  { name: 'Automations', icon: Workflow, section: 'automations', path: '/automations', description: 'Build automated workflows' },
  { name: 'Communications', icon: MessageSquare, section: 'communications', path: '/communications', description: 'Manage chat and voice agents' },
  { name: 'Organizations', icon: Building2, section: 'organizations', path: '/organizations', description: 'Manage organizations and teams' }
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  onHelpClick, 
  activeSection,
  onSectionChange 
}) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleNavigation = (item: typeof navItems[0]) => {
    onSectionChange(item.section);
    navigate(item.path);
  };

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsSidebarOpen(true)}
      onMouseLeave={() => setIsSidebarOpen(false)}
    >
      <aside className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full sidebar-transition ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <LayoutDashboard className="w-8 h-8 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            {isSidebarOpen && (
              <div className="animate-fade-in">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Ciro AI</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">From Data to Action</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.section}
              onClick={() => handleNavigation(item)}
              className={`nav-item ${
                activeSection === item.section
                  ? 'nav-item-active dark:bg-purple-900/50 dark:text-purple-300'
                  : 'nav-item-inactive dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <div className="has-tooltip">
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isSidebarOpen && (
                  <span className="tooltip left-14 dark:bg-gray-800 dark:text-gray-100">{item.name}</span>
                )}
              </div>
              {isSidebarOpen && (
                <div className="ml-3 flex-1 text-left animate-fade-in">
                  <span>{item.name}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={onHelpClick}
            className="has-tooltip flex items-center space-x-2 text-gray-600 hover:text-purple-600 transition-colors duration-200"
          >
            <HelpCircle className="w-5 h-5" />
            {!isSidebarOpen && (
              <span className="tooltip left-14">Help & Resources</span>
            )}
            {isSidebarOpen && <span className="animate-fade-in">Help & Resources</span>}
          </button>
        </div>
      </aside>
    </div>
  );
}; 