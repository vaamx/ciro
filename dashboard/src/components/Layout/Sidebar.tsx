import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  Brain, 
  Workflow, 
  MessageSquare,
  HelpCircle,
  Building2,
  ChevronRight
} from 'lucide-react';
import darkLogo from '../../styles/logos/darklogo.png';
import lightLogo from '../../styles/logos/lightlogo.png';

interface SidebarProps {
  onHelpClick: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  isDarkMode?: boolean;
}

const navItems = [
  { 
    name: 'Overview', 
    icon: LayoutDashboard, 
    section: 'overview', 
    path: '/overview', 
    comingSoon: false
  },
  { 
    name: 'Data Sources', 
    icon: Database, 
    section: 'data', 
    path: '/data-sources', 
    comingSoon: false
  },
  { 
    name: 'Decisions', 
    icon: Brain, 
    section: 'decisions', 
    path: '/decisions', 
    comingSoon: true
  },
  { 
    name: 'Automations', 
    icon: Workflow, 
    section: 'automations', 
    path: '/automations', 
    comingSoon: true
  },
  { 
    name: 'Communications', 
    icon: MessageSquare, 
    section: 'communications', 
    path: '/communications', 
    comingSoon: true
  },
  { 
    name: 'Organizations', 
    icon: Building2, 
    section: 'organizations', 
    path: '/organizations', 
    comingSoon: false
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  onHelpClick, 
  activeSection,
  onSectionChange,
  isDarkMode = false
}) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNavigation = (item: typeof navItems[0]) => {
    if (item.comingSoon) {
      return;
    }
    onSectionChange(item.section);
    navigate(item.path);
  };

  return (
    <>
      {/* Sidebar spacer */}
      <div className={`
        flex-shrink-0
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-64' : 'w-16'}
      `} />

      {/* Sidebar container */}
      <div 
        className="fixed top-0 bottom-0 left-0 z-30"
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => {
          setIsSidebarOpen(false);
          setHoveredItem(null);
        }}
      >
        <aside className={`
          h-full
          bg-white dark:bg-gray-900 
          border-r border-gray-100/50 dark:border-gray-800/50
          shadow-lg shadow-gray-100/20 dark:shadow-gray-900/30
          flex flex-col
          transition-all duration-300 ease-in-out
          backdrop-blur-xl backdrop-saturate-150
          ${isSidebarOpen ? 'w-64' : 'w-16'}
        `}>
          {/* Top spacer for header alignment */}
          <div className="h-8 flex-shrink-0" />

          {/* Logo section */}
          <div className="flex-shrink-0 px-3 mb-2">
            <div className="flex items-center h-12 relative">
              <div className={`
                w-10 h-10 flex items-center justify-center
                bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-400/10 dark:to-purple-500/10
                rounded-xl
                transition-all duration-200 hover:scale-105
                ${!isSidebarOpen ? 'w-10' : 'flex-shrink-0'}
              `}>
                <img 
                  src={isDarkMode ? darkLogo : lightLogo} 
                  alt="Ciro AI" 
                  className="w-7 h-7 object-contain"
                />
              </div>
              {isSidebarOpen && (
                <div className="ml-3 overflow-hidden">
                  <h1 className="text-base font-semibold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Ciro AI
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate opacity-75">From Data to Action</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation section */}
          <nav className="flex-1 pt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <div className="px-2 space-y-0.5">
              {navItems.map((item) => (
                <div key={item.section} className="relative group/item">
                  {/* Tooltip */}
                  {!isSidebarOpen && hoveredItem === item.section && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50">
                      <div className="px-2 py-1">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-900/50 p-3 
                          border border-gray-100/50 dark:border-gray-700/50 backdrop-blur-lg
                          animate-fade-in whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-white mb-1">{item.name}</div>
                          {item.comingSoon && (
                            <div className="flex items-center mt-2 space-x-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse"></div>
                              <span className="text-xs text-purple-600 dark:text-purple-400">Coming Soon</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation item */}
                  <button
                    onClick={() => handleNavigation(item)}
                    onMouseEnter={() => setHoveredItem(item.section)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`
                      w-full rounded-lg px-3 py-2.5
                      transition-all duration-200 ease-in-out
                      group relative
                      ${activeSection === item.section
                        ? 'bg-gradient-to-r from-purple-50 to-purple-50/50 dark:from-purple-900/20 dark:to-purple-900/10 text-purple-600 dark:text-purple-400'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                      }
                      ${item.comingSoon 
                        ? 'opacity-50 hover:opacity-75 cursor-not-allowed' 
                        : 'hover:text-purple-600 dark:hover:text-purple-400'
                      }
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      {/* Icon */}
                      <div className={`
                        flex-shrink-0 
                        transition-all duration-200
                        rounded-lg p-1.5
                        ${activeSection === item.section
                          ? 'text-purple-600 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-900/30'
                          : 'text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                        }
                      `}>
                        <item.icon className="w-[18px] h-[18px]" />
                      </div>

                      {/* Text content */}
                      {isSidebarOpen && (
                        <div className="ml-3 flex-1 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center min-w-0 flex-1">
                              <span className="font-medium truncate text-sm">
                                {item.name}
                              </span>
                              {item.comingSoon && (
                                <div className="ml-2 px-1.5 py-0.5 flex items-center space-x-1 bg-purple-50 dark:bg-purple-900/30 rounded-full ring-1 ring-purple-100/50 dark:ring-purple-800/50">
                                  <div className="w-1 h-1 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse"></div>
                                  <span className="text-[10px] font-medium text-purple-700 dark:text-purple-400 truncate">
                                    Soon
                                  </span>
                                </div>
                              )}
                            </div>
                            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-200
                              ${activeSection === item.section 
                                ? 'opacity-100 text-purple-400' 
                                : 'opacity-0 group-hover:opacity-100'
                              }`} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </nav>

          {/* Help section */}
          <div className="flex-shrink-0 p-2 border-t border-gray-100/50 dark:border-gray-800/50">
            <button 
              onClick={onHelpClick}
              className="
                w-full flex items-center
                px-3 py-2.5 rounded-lg
                text-gray-600 dark:text-gray-400 
                hover:text-purple-600 dark:hover:text-purple-400
                hover:bg-gray-50 dark:hover:bg-gray-800/50
                transition-all duration-200 ease-in-out
                group/help
              "
            >
              <div className="p-1.5 rounded-lg transition-all duration-200 group-hover/help:bg-purple-100/50 dark:group-hover/help:bg-purple-900/30">
                <HelpCircle className="w-[18px] h-[18px]" />
              </div>
              {isSidebarOpen && (
                <span className="ml-3 font-medium truncate text-sm">Help & Resources</span>
              )}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}; 