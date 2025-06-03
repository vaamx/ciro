import React, { useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CreditCard,
  Settings,
  FileText,
  ChevronRight,
  Building2,
  Wallet,
  History,
  BarChart3
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface SidebarProps {
  isDarkMode?: boolean;
  isMobile?: boolean;
  onSectionChange?: (section: string) => void;
}

// Define section headings for groups of navigation items
const sectionHeadings = {
  overview: "Resumen",
  financial: "Financiero",
  account: "Cuenta"
};

const navItems = [
  // Overview Section
  { 
    name: 'Panel de Control', 
    icon: LayoutDashboard, 
    path: '/dashboard', 
    section: 'dashboard',
    group: 'overview'
  },
  { 
    name: 'Análisis de Uso', 
    icon: BarChart3, 
    path: '/analytics', 
    section: 'analytics',
    group: 'overview'
  },
  
  // Financial Section
  { 
    name: 'Facturación', 
    icon: CreditCard, 
    path: '/billing', 
    section: 'billing',
    group: 'financial'
  },
  { 
    name: 'Historial de Pagos', 
    icon: History, 
    path: '/payment-history', 
    section: 'payment-history',
    group: 'financial'
  },
  
  // Account Section
  { 
    name: 'Configuración de Cuenta', 
    icon: Settings, 
    path: '/settings', 
    section: 'settings',
    group: 'account'
  },
  { 
    name: 'Documentos', 
    icon: FileText, 
    path: '/documents', 
    section: 'documents',
    group: 'account'
  },
  { 
    name: 'Organización', 
    icon: Building2, 
    path: '/organization', 
    section: 'organization',
    group: 'account'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  isDarkMode = false,
  isMobile = false,
  onSectionChange
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Fixed state management: start collapsed on desktop, expanded on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(isMobile);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  // Debounce hover events to prevent rapid toggling
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleNavigation = (item: typeof navItems[0]) => {
    onSectionChange?.(item.section);
    navigate(item.path);
  };

  // Debounced hover handlers to prevent rapid state changes
  const handleMouseEnter = useCallback(() => {
    if (isMobile) return; // Don't handle hover on mobile
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setIsSidebarOpen(true);
    }, 100); // Small delay to prevent immediate triggering
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return; // Don't handle hover on mobile
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    hoverTimeoutRef.current = setTimeout(() => {
      setIsSidebarOpen(false);
    }, 300); // Longer delay before closing to prevent flicker
  }, [isMobile]);

  // Update sidebar state when isMobile prop changes
  React.useEffect(() => {
    setIsSidebarOpen(isMobile);
  }, [isMobile]);

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
      {/* Sidebar container */}
      <div 
        className={`h-full ${isMobile ? 'w-72' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
          fixed lg:sticky top-0 z-30
        `}>
          {/* Top spacer for header alignment */}
          <div className="h-16 flex-shrink-0" />

          {/* Navigation sections */}
          <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {groups.map((group) => (
              <div key={group} className="mb-6">
                {/* Section heading - only show when sidebar is open */}
                {(isSidebarOpen || isMobile) && (
                  <h3 className="px-4 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {sectionHeadings[group as keyof typeof sectionHeadings]}
                  </h3>
                )}

                {/* Navigation items */}
                <div className="space-y-1">
                  {groupedNavItems[group].map((item) => {
                    const isActive = location.pathname === item.path;
                    const isHovered = hoveredItem === item.path;

                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigation(item)}
                        onMouseEnter={() => setHoveredItem(item.path)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={cn(
                          'w-full group flex items-center gap-x-3 px-4 py-2.5 text-sm font-medium rounded-xl',
                          'transition-all duration-200 relative',
                          isActive
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                          (isActive || isHovered) && 'bg-purple-50/50 dark:bg-purple-900/20'
                        )}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 
                            bg-gradient-to-b from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 
                            rounded-full shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30" 
                          />
                        )}

                        <div className={cn(
                          'flex items-center justify-center',
                          isActive
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                        )}>
                          <item.icon size={20} />
                        </div>

                        {/* Item text - only show when sidebar is open */}
                        {(isSidebarOpen || isMobile) && (
                          <span className="opacity-100 transition-opacity duration-200">
                            {item.name}
                          </span>
                        )}

                        {/* Hover indicator */}
                        {!isActive && isHovered && (isSidebarOpen || isMobile) && (
                          <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight size={16} className="text-gray-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}; 