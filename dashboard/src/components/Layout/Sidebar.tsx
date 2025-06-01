import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  MessageSquare,
  HelpCircle,
  Building2,
  ChevronRight,
  Briefcase,
  Palette,
  Lightbulb,
  Wrench,
  Phone,
  MessageCircle
} from 'lucide-react';
import darkLogo from '../../styles/logos/darklogo.png';
import lightLogo from '../../styles/logos/lightlogo.png';

interface SidebarProps {
  onHelpClick: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  isDarkMode?: boolean;
  isMobile?: boolean;
}

// Define section headings for groups of navigation items
const sectionHeadings = {
  overview: "Overview",
  toolsAnalytics: "Tools & Analytics",
  communications: "Communications",
  management: "Management"
};

const navItems = [
  // Overview Section
  { 
    name: 'Dashboard', 
    icon: LayoutDashboard, 
    section: 'overview', 
    path: '/overview', 
    comingSoon: false,
    group: 'overview'
  },
  { 
    name: 'Data Sources', 
    icon: Database, 
    section: 'data', 
    path: '/data-sources', 
    comingSoon: false,
    group: 'overview'
  },
  { 
    name: 'Studio', 
    icon: Briefcase, 
    section: 'studio', 
    path: '/studio', 
    comingSoon: false,
    group: 'overview'
  },
  { 
    name: 'Gallery', 
    icon: Palette, 
    section: 'gallery', 
    path: '/gallery', 
    comingSoon: false,
    group: 'overview'
  },
  
  // Tools & Analytics Section
  { 
    name: 'Insights', 
    icon: Lightbulb, 
    section: 'insights', 
    path: '/insights', 
    comingSoon: false,
    group: 'toolsAnalytics'
  },
  { 
    name: 'Toolkit', 
    icon: Wrench, 
    section: 'toolkit', 
    path: '/toolkit', 
    comingSoon: false,
    group: 'toolsAnalytics'
  },
  
  // Communications Section
  { 
    name: 'Threads', 
    icon: MessageCircle, 
    section: 'threads', 
    path: '/threads', 
    comingSoon: false,
    group: 'communications'
  },
  { 
    name: 'Chatbot', 
    icon: MessageSquare, 
    section: 'chatbot', 
    path: '/communications/chatbot', 
    comingSoon: true,
    group: 'communications'
  },
  { 
    name: 'Voice', 
    icon: Phone, 
    section: 'voice', 
    path: '/communications/voice', 
    comingSoon: true,
    group: 'communications'
  },
  
  // Management Section
  { 
    name: 'Organizations', 
    icon: Building2, 
    section: 'organizations', 
    path: '/organizations', 
    comingSoon: false,
    group: 'management'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  onHelpClick, 
  activeSection,
  onSectionChange,
  isDarkMode = false,
  isMobile = false
}) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(isMobile);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNavigation = (item: typeof navItems[0]) => {
    // Allow navigation even if comingSoon is true
    onSectionChange(item.section);
    navigate(item.path);
  };

  // For mobile, sidebar should always be expanded when visible
  const sidebarWidth = isMobile ? 'w-72' : (isSidebarOpen ? 'w-64' : 'w-16');
  
  // Group navigation items by their group property
  const groupedNavItems: Record<string, typeof navItems> = {};
  navItems.forEach(item => {
    if (!groupedNavItems[item.group]) {
      groupedNavItems[item.group] = [];
    }
    groupedNavItems[item.group].push(item);
  });
  
  // Get all unique groups in the order they appear in navItems
  const groups = [...new Set(navItems.map(item => item.group))];
  
  return (
    <>
      {/* Sidebar spacer - only for desktop */}
      {!isMobile && (
        <div className={`
          flex-shrink-0
          transition-all duration-300 ease-in-out
          ${sidebarWidth}
        `} />
      )}

      {/* Sidebar container */}
      <div 
        className={`h-full ${isMobile ? 'w-72' : ''}`}
        onMouseEnter={() => !isMobile && setIsSidebarOpen(true)}
        onMouseLeave={() => !isMobile && setIsSidebarOpen(false)}
      >
        <aside className={`
          h-full
          bg-white dark:bg-gray-900 
          border-r border-gray-100/50 dark:border-gray-800/50
          shadow-lg shadow-gray-100/20 dark:shadow-gray-900/30
          flex flex-col
          transition-all duration-300 ease-in-out
          backdrop-blur-xl backdrop-saturate-150
          ${isMobile ? 'w-72' : sidebarWidth}
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
                ${!isSidebarOpen && !isMobile ? 'w-10' : 'flex-shrink-0'}
              `}>
                <img 
                  src={isDarkMode ? darkLogo : lightLogo} 
                  alt="Ciro AI" 
                  className="w-7 h-7 object-contain"
                />
              </div>
              {(isSidebarOpen || isMobile) && (
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
              {groups.map((group) => (
                <div key={group} className="mb-3">
                  {/* Section Header - only display when sidebar is open */}
                  {(isSidebarOpen || isMobile) && (
                    <div className="pl-3 pb-1 pt-3">
                      <h3 className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                        {sectionHeadings[group as keyof typeof sectionHeadings]}
                      </h3>
                    </div>
                  )}
                  
                  {/* Section Divider - only display when sidebar is collapsed */}
                  {!isSidebarOpen && !isMobile && group !== groups[0] && (
                    <div className="mx-2 my-3 border-t border-gray-100/50 dark:border-gray-800/50"></div>
                  )}
                  
                  {/* Group Items */}
                  {groupedNavItems[group].map((item) => (
                    <div key={item.section} className="relative group/item">
                      {/* Tooltip - only show on desktop collapsed state */}
                      {!isSidebarOpen && !isMobile && hoveredItem === item.section && (
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
                          cursor-pointer
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
                          {(isSidebarOpen || isMobile) && (
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
              {(isSidebarOpen || isMobile) && (
                <span className="ml-3 font-medium text-sm">Help</span>
              )}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}; 