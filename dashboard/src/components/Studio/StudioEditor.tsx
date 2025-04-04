import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Database,
  Save,
  Share2,
  Users,
  Plus,
  Grid
} from 'lucide-react';
import { allCharts } from '../Gallery/data/chartConfigs';
import { useTheme } from '../../contexts/ThemeContext';
import { useWorkspaces } from '../../contexts/WorkspacesContext';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DataSourceType, DataSourceStatus } from '../DataSources/types';
import { useDataSources } from '../../contexts/DataSourcesContext';
import { 
  initCollaboration, 
  updateCursorPosition, 
  CollaborationUser,
  CollaborationSession,
  onCollaborationEvent,
  MessageType,
  addQueryExecution,
  Comment
} from '../../services/collaborationService';
import { ChartContainer } from './ChartContainer';
import { ChartType } from './Chart';
import { QdrantVisualizationGenerator } from './QdrantVisualizationGenerator';

// Define data source interface that adapts the app DataSource to what we need here
interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  connected: boolean;
  status: DataSourceStatus;
  schema?: {
    tables?: string[];
    columns?: Record<string, { name: string; type: string }[]>;
  };
}

// Define workspace interface
interface StudioWorkspaceData {
  id: string;
  name: string;
  description: string;
  charts: ChartTemplateInstance[];
  dataSources: DataSource[];
  lastModified: Date;
  layout?: Layout[];
}

// Define chart template instance (chart in a workspace)
interface ChartTemplateInstance {
  id: string;
  templateId: string;
  name: string;
  size: 'small' | 'medium' | 'large' | 'full';
  config: any;
  dataSourceId: string | null;
  dataTransformations: any[];
  query?: string;
  queryResult?: any;
  style?: {
    left?: number | string;
    top?: number | string;
    width?: number | string;
    height?: number | string;
    zIndex?: number;
  };
}

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StudioEditorProps {
  workspaceId?: string;
  initialChartTemplateId?: string;
  workspaceName?: string;
  workspaceDescription?: string;
  onClose?: () => void;
}

// Define and add chart positions to state
interface ChartPosition {
  x: number;
  y: number;
}

// Add a new interface for chart dimensions
interface ChartDimensions {
  width: number;
  height: number;
}

// Fix the ChartWithPosition interface
interface ChartWithPosition extends Omit<ChartTemplateInstance, 'style'> {
  style?: React.CSSProperties;
}

// Add this helper function to determine the next size in rotation
const getNextSize = (currentSize: ChartTemplateInstance['size']): ChartTemplateInstance['size'] => {
  const sizes: ChartTemplateInstance['size'][] = ['small', 'medium', 'large', 'full'];
  const currentIndex = sizes.indexOf(currentSize);
  return sizes[(currentIndex + 1) % sizes.length];
};

// Add resize directions type
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Execute a query against a data source
 */
const executeQuery = async (
  dataSourceId: string, 
  sql: string, 
  parameters?: Record<string, any>,
  options?: {
    maxRows?: number;
    timeout?: number;
    includeMetadata?: boolean;
  }
) => {
  // Use window.__EXECUTE_QUERY__ if available (added by the app)
  if (typeof window !== 'undefined' && (window as any).__APP_EXECUTE_QUERY__) {
    return (window as any).__APP_EXECUTE_QUERY__(dataSourceId, sql, parameters, options);
  }
  
  // Fallback to mock data
  return {
    columns: [{ name: 'value', type: 'number' }],
    rows: Array(10).fill(0).map(() => ({ value: Math.floor(Math.random() * 100) })),
    rowCount: 10,
    executionTime: 100,
    truncated: false
  };
};

// Define the DataSourceSelector component to handle string|null and string|undefined types correctly
const DataSourceSelector = ({ 
  availableSources, 
  selectedSourceId,
  onSelect,
  chartType,
  isDisabled
}: { 
  availableSources: DataSource[];
  selectedSourceId?: string | null; // Accept both null and undefined
  onSelect: (sourceId: string) => void;
  chartType?: string;
  isDisabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedSource = availableSources.find(s => s.id === selectedSourceId);
  
  // Filter sources by relevance to chart type
  const getRelevantSources = () => {
    if (!chartType) return availableSources.filter(s => s.connected);
    
    return availableSources
      .filter(s => s.connected)
      .sort((a, b) => {
        // Prioritize sources with names that match the chart type
        const aRelevance = getSourceRelevance(a, chartType);
        const bRelevance = getSourceRelevance(b, chartType);
        return bRelevance - aRelevance;
      });
  };
  
  const getSourceRelevance = (source: DataSource, chartType: string): number => {
    const name = source.name.toLowerCase();
    let relevance = 0;
    
    // Time series and trends
    if ((chartType.includes('line') || chartType.includes('area')) && 
        (name.includes('time') || name.includes('trend') || name.includes('series'))) {
      relevance += 10;
    }
    
    // Pie charts and distributions
    if ((chartType.includes('pie') || chartType.includes('donut')) && 
        (name.includes('distribution') || name.includes('category'))) {
      relevance += 10;
    }
    
    // Bar charts and comparisons
    if (chartType.includes('bar') && 
        (name.includes('comparison') || name.includes('metrics'))) {
      relevance += 10;
    }
    
    // Waterfall or bridge charts
    if ((chartType.includes('waterfall') || chartType.includes('bridge')) && 
        (name.includes('variance') || name.includes('change'))) {
      relevance += 10;
    }
    
    return relevance;
  };
  
  const relevantSources = getRelevantSources();
  
  return (
    <div className="relative">
      <button
        className={`px-3 py-2 flex items-center justify-between gap-2 rounded border ${
          selectedSource 
            ? 'border-blue-500 bg-blue-500/10 text-blue-400' 
            : 'border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-700/80'
        } w-full transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Database className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            {selectedSource ? selectedSource.name : 'Select Data Source'}
          </span>
        </div>
        {!isDisabled && <ChevronDown className="w-4 h-4" />}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-gray-800 rounded-md border border-gray-700 shadow-lg z-50">
          <div className="p-1 text-xs text-gray-400 font-medium border-b border-gray-700 bg-gray-800/50">
            Recommended data sources
          </div>
          {relevantSources.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No connected data sources available
            </div>
          ) : (
            relevantSources.map(source => (
              <div 
                key={source.id}
                className={`
                  p-2 flex items-center justify-between cursor-pointer transition-colors
                  ${source.id === selectedSourceId ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-gray-700 text-gray-300'}
                `}
                onClick={() => {
                  onSelect(source.id);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center">
                  <Database className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{source.name}</span>
                </div>
                <span 
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    source.connected ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {source.connected ? 'Ready' : 'Disconnected'}
                </span>
              </div>
            ))
          )}
          
          <div className="p-1 text-xs text-gray-400 font-medium border-t border-b border-gray-700 bg-gray-800/50 mt-1">
            All data sources
          </div>
          {availableSources
            .filter(s => !relevantSources.some(rs => rs.id === s.id))
            .map(source => (
              <div 
                key={source.id}
                className={`
                  p-2 flex items-center justify-between cursor-pointer transition-colors
                  ${source.id === selectedSourceId ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-gray-700 text-gray-300'}
                  ${!source.connected ? 'opacity-50' : ''}
                `}
                onClick={() => {
                  if (source.connected) {
                    onSelect(source.id);
                    setIsOpen(false);
                  }
                }}
              >
                <div className="flex items-center">
                  <Database className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{source.name}</span>
                </div>
                <span 
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    source.connected ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {source.connected ? 'Ready' : 'Disconnected'}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

/**
 * Studio Editor component for creating and editing visualizations with real data
 */
export const StudioEditor = ({ 
  workspaceId,
  workspaceName,
  workspaceDescription,
  onClose 
}: StudioEditorProps): JSX.Element => {
  // Add render count tracking
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  
  // Only log once on mount to reduce console spam
  useEffect(() => {
    console.log('StudioEditor initialized, workspaceId:', workspaceId);
    
    // One-time logging
    return () => {
      console.log('StudioEditor unmounted');
    };
  }, []);
  
  const { isDarkMode } = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  
  // Get data sources from context
  const { 
    dataSources: contextDataSources, 
    isLoading: isLoadingDataSources 
  } = useDataSources();
  
  // Get workspaces context for persistence
  const {
    updateWorkspace, 
    addChart: addChartToWorkspace,
    updateChart,
    deleteChart: deleteWorkspaceChart
  } = useWorkspaces();
  
  // Access workspaces context for fetching
  const { getWorkspaceById } = useWorkspaces();
  
  // State variables
  const [workspace, setWorkspace] = useState<StudioWorkspaceData | null>(null);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableDataSources, setAvailableDataSources] = useState<DataSource[]>([]);
  const [teamComments, setTeamComments] = useState<(Comment & {author?: string, isHighlighted?: boolean, position?: {x: number, y: number}})[]>([]);
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  // Keep track of previous workspace ID to detect changes
  const previousWorkspaceIdRef = useRef<string | undefined>(workspaceId);
  
  // Add effect to update workspace name and description when props change
  useEffect(() => {
    // If workspace name or description props changed, update the workspace object
    if (workspace && (workspaceName || workspaceDescription)) {
      setWorkspace(current => {
        if (!current) return current;
        
        const nameChanged = workspaceName && current.name !== workspaceName;
        const descriptionChanged = workspaceDescription && current.description !== workspaceDescription;
        
        if (nameChanged || descriptionChanged) {
          return {
            ...current,
            name: workspaceName || current.name,
            description: workspaceDescription || current.description
          };
        }
        
        return current;
      });
    }
    
    // If workspace ID changed, reset state to force fresh load
    if (workspaceId !== previousWorkspaceIdRef.current) {
      console.log('Workspace ID changed from', previousWorkspaceIdRef.current, 'to', workspaceId);
      previousWorkspaceIdRef.current = workspaceId;
      
      // Reset workspace to force reload
      setWorkspace(null);
      setActiveChartId(null);
      setIsLoading(true);
      
      // CRITICAL FIX: Force a full page reload to ensure clean initialization
      if (workspaceId) {
        console.log('FORCING NAVIGATION to clean workspace:', workspaceId);
        const url = `/studio?workspace=${workspaceId}`;
        window.location.href = url;
      }
    }
  }, [workspaceId, workspaceName, workspaceDescription, workspace]);
  
  // Chart positioning and dragging state
  const [chartPositions, setChartPositions] = useState<Record<string, ChartPosition>>({});
  const [chartDimensions, setChartDimensions] = useState<Record<string, ChartDimensions>>({});
  const [activelyDraggingChart, setActivelyDraggingChart] = useState<string | null>(null);
  const [activelyResizingChart, setActivelyResizingChart] = useState<string | null>(null);
  const chartDragStartRef = useRef<{x: number, y: number, chartX: number, chartY: number} | null>(null);
  const chartResizeStartRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    direction: ResizeDirection;
    initialX: number;
    initialY: number;
  } | null>(null);
  
  // Collaboration state
  const [collaborationSession, setCollaborationSession] = useState<CollaborationSession | null>(null);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | null>(null);
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);

  // Add zoom controls with smoother transitions
  const [smoothTransition, setSmoothTransition] = useState(true);

  // Inside the StudioEditor component, add this state variable
  const [showGenerateVisualizationModal, setShowGenerateVisualizationModal] = useState(false);

  // Helper to position charts in a grid layout automatically
  const autoArrangeCharts = () => {
    if (!workspace || workspace.charts.length === 0) return;
    
    // Calculate positions in a grid layout
    const grid = {
      cols: Math.ceil(Math.sqrt(workspace.charts.length)),
      spacing: 20
    };
    
    const newPositions: Record<string, ChartPosition> = {};
    
    workspace.charts.forEach((chart, index) => {
      const row = Math.floor(index / grid.cols);
      const col = index % grid.cols;
      
      // Base position for small charts
      let width = 288; // w-72 = 18rem = 288px
      let height = 288; // h-72 = 288px
      
      // Adjust size based on chart size
      if (chart.size === 'medium') {
        width = 384; // w-96 = 24rem = 384px
        height = 320; // h-80 = 320px
      } else if (chart.size === 'large') {
        width = 480; // w-[30rem] = 30rem = 480px 
        height = 384; // h-96 = 24rem = 384px
      }
      
      // Position with spacing
      newPositions[chart.id] = {
        x: col * (width + grid.spacing),
        y: row * (height + grid.spacing)
      };
    });
    
    // Apply positions with a temporary disable of transitions
    setSmoothTransition(false);
    setChartPositions(newPositions);
    
    // Re-enable transitions after a short delay
    setTimeout(() => {
      setSmoothTransition(true);
    }, 50);
    
    // Add system comment if we have a comment function
    if (typeof teamComments !== 'undefined') {
      const systemComment = {
        id: `system-${Date.now()}`,
        userId: 'system',
        text: 'Charts arranged in grid layout',
        timestamp: Date.now(),
        resolved: false,
        author: 'System',
        isHighlighted: true
      };
      
      setTeamComments(prev => [...prev, systemComment]);
    }
  };

  // Initialize collaboration
  useEffect(() => {
    if (!workspaceId) return;
    
    console.log('Setting up Studio Editor environment for workspace:', workspaceId);
    
    // Flag to prevent multiple cleanups
    let isCleaningUp = false;
    
    // Hide Ciro AI button when studio editor is active
    const style = document.createElement('style');
    style.id = 'studio-editor-ciro-ai-style';
    style.innerHTML = `
      /* Target by common attributes */
      [data-testid="ask-ciro-ai-button"],
      button[class*="ask-ciro"],
      div[class*="ask-ciro"],
      .ask-ciro-ai-btn,
      /* Target likely classes for the AI button */
      .ai-assistant-button,
      .ai-chat-button,
      .chat-assistant-button,
      /* Hide all elements with the text "ask ciro ai" */
      [title="Ask Ciro AI"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `;
    document.head.appendChild(style);
    
    // Direct DOM method to find and hide the button
    const hideAskCiroButton = () => {
      // Track if we found and hid any buttons this time
      let hiddenCount = 0;
      
      // Find elements that match the text content and appear to be buttons
      const elements = document.body.querySelectorAll('*');
      elements.forEach(element => {
        if (element instanceof HTMLElement && !element.hasAttribute('data-ciro-hidden-by-studio')) {
          // Check if this is likely the target button based on text content
          const textContent = element.textContent || '';
          const isLikelyAiButton = 
            textContent.toLowerCase().includes('ask ciro') || 
            textContent.toLowerCase().includes('ask ai') ||
            textContent.toLowerCase() === 'ai';
            
          if (isLikelyAiButton && element.tagName === 'BUTTON') {
            element.style.display = 'none';
            element.setAttribute('data-ciro-hidden-by-studio', 'true');
            hiddenCount++;
          }
          
          // Also look for the specific button shown in the screenshot (purple, bottom-right positioned)
          try {
            const computedStyle = window.getComputedStyle(element);
            if (
              (computedStyle.backgroundColor.includes('rgb(147') || computedStyle.backgroundColor.includes('rgb(168')) &&
              computedStyle.position === 'fixed' && 
              parseInt(computedStyle.bottom || '0') < 50 &&
              element.tagName === 'BUTTON'
            ) {
              element.style.display = 'none';
              element.setAttribute('data-ciro-hidden-by-studio', 'true');
              hiddenCount++;
            }
          } catch (e) {
            // Ignore errors when checking styles
          }
        }
      });
      
      // Only log if we actually found and hid buttons
      if (hiddenCount > 0) {
        console.log(`Found and hid ${hiddenCount} AI button(s) in Studio Editor`);
      }
    };
    
    // Run immediately
    hideAskCiroButton();
    
    // Use MutationObserver to catch any dynamically added elements, with debounce
    let debounceTimeout: number | null = null;
    const observer = new MutationObserver((mutations) => {
      // Only check mutations that are likely to be relevant
      const shouldCheck = mutations.some(mutation => {
        // Check for added nodes
        if (mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node instanceof HTMLElement) {
              // Check if this node or its children might contain the AI button
              if (
                node.tagName === 'BUTTON' || 
                node.querySelector('button') ||
                (node.textContent && (
                  node.textContent.toLowerCase().includes('ask') ||
                  node.textContent.toLowerCase().includes('ciro') ||
                  node.textContent.toLowerCase().includes('ai')
                ))
              ) {
                return true;
              }
            }
          }
        }
        return false;
      });
      
      if (shouldCheck) {
        // Clear previous debounce timeout
        if (debounceTimeout !== null) {
          window.clearTimeout(debounceTimeout);
        }
        
        // Set new debounce timeout
        debounceTimeout = window.setTimeout(() => {
          hideAskCiroButton();
        }, 100);
      }
    });
    
    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Clean up function
    return () => {
      // Only execute cleanup once
      if (isCleaningUp) return;
      isCleaningUp = true;
      
      console.log('Cleaning up Studio Editor environment for workspace:', workspaceId);
      
      // Stop observing
      observer.disconnect();
      
      // Clear any pending debounce timeout
      if (debounceTimeout !== null) {
        window.clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
      
      // Remove the styles
      const styleElement = document.getElementById('studio-editor-ciro-ai-style');
      if (styleElement) {
        styleElement.remove();
      }
      
      // Restore any hidden buttons
      const hiddenElements = document.querySelectorAll('[data-ciro-hidden-by-studio="true"]');
      let restoredCount = 0;
      hiddenElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.display = '';
          element.removeAttribute('data-ciro-hidden-by-studio');
          restoredCount++;
        }
      });
      
      // Only log if we actually restored buttons
      if (restoredCount > 0) {
        console.log(`Restored ${restoredCount} previously hidden AI button(s)`);
      }
    };
  }, [workspaceId]);
  
  useEffect(() => {
    if (!workspaceId) return;
    
    const setupCollaboration = async () => {
      try {
        console.log('Setting up collaboration for workspace:', workspaceId);
        const { session, user } = await initCollaboration(workspaceId);
        setCollaborationSession(session);
        setCurrentUser(user);
        
        // Set team members (other users in session)
        const otherUsers = session.users.filter(u => u.id !== user.id);
        setCollaborators(otherUsers);
        
        // Load comments from session
        const formattedComments = session.comments.map(comment => {
          const author = session.users.find(u => u.id === comment.userId)?.name || 'Unknown';
          return {
            ...comment,
            author,
            isHighlighted: false
          };
        });
        
        setTeamComments(formattedComments);
        console.log('Collaboration setup completed successfully');
      } catch (error: any) {
        console.error('Error initializing collaboration:', error);
        
        // Show a system comment about the failure but with a positive message
        let errorMessage = "Working in offline mode. Your changes will be saved locally.";
        
        // Add more specifics if we have error information
        if (error?.message) {
          if (error.message.includes('WebSocket')) {
            errorMessage = "Unable to connect to collaboration server. Working in offline mode.";
          } else if (error.message.includes('timeout')) {
            errorMessage = "Connection timed out. Working in offline mode.";
          }
        }
        
        handleAddSystemComment(errorMessage);
        
        // Set empty collaboration data with just the current user
        const localUser: CollaborationUser = {
          id: `local-user-${Date.now()}`,
          name: 'You',
          color: '#4287f5',
          isActive: true,
          lastActivity: Date.now()
        };
        
        // Create a minimal offline session
        setCurrentUser(localUser);
        setCollaborators([]);
        setCollaborationSession({
          id: `offline-session-${Date.now()}`,
          workspaceId: workspaceId || 'offline',
          users: [localUser],
          comments: [],
          changeHistory: [],
          createdAt: Date.now(),
          lastActive: Date.now()
        });
        
        console.log('Offline collaboration session created');
      }
    };
    
    setupCollaboration();
    
    // Subscribe to collaboration events
    const commentAddedUnsubscribe = onCollaborationEvent(MessageType.COMMENT_ADD, (data) => {
      const { comment } = data;
      const author = collaborationSession?.users.find(u => u.id === comment.userId)?.name || 'Unknown';
      
      setTeamComments(prev => [
        ...prev,
        { 
          ...comment,
          author,
          isHighlighted: true
        }
      ]);
      
      // Scroll to new comment
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    
    return () => {
      commentAddedUnsubscribe();
    };
  }, [workspaceId]);
  
  // Scroll to bottom of comments when new comments arrive
  useEffect(() => {
    if (teamComments.some(c => c.isHighlighted)) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // Reset highlight after a short delay
      const timer = setTimeout(() => {
        setTeamComments(prev => 
          prev.map(comment => ({ ...comment, isHighlighted: false }))
        );
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [teamComments]);

  // Fix the cursor move effect that might be causing issues
  useEffect(() => {
    // Disable cursor tracking entirely to improve performance
    const DISABLE_CURSOR_TRACKING = true;
    
    if (DISABLE_CURSOR_TRACKING || !canvasRef.current || !currentUser) return;
    
    let timeoutId: number | null = null;
    // Track previous position to avoid unnecessary updates
    const lastPosition = {x: 0, y: 0};
    // Minimum distance to trigger an update (pixels)
    const minMovement = 50; // Increased threshold
    // Larger debounce time (milliseconds)
    const debounceTime = 1000; // 1 second
    // Track last update time
    let lastUpdateTime = 0;
    // Minimum time between updates in ms
    const minTimeBetweenUpdates = 2000; // 2 seconds
    
    const handleMouseMove = (e: MouseEvent) => {
      // Skip processing entirely during active interactions
      if (activelyDraggingChart || activelyResizingChart) return;
      
      // Check if enough time has passed since last update
      const now = Date.now();
      if (now - lastUpdateTime < minTimeBetweenUpdates) return;
      
      // Debounce to prevent too many updates
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      
      // Store current position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
      // Check for significant movement
      const deltaX = Math.abs(x - lastPosition.x);
      const deltaY = Math.abs(y - lastPosition.y);
      
      // Only set timeout if significant movement
      if (deltaX > minMovement || deltaY > minMovement) {
        timeoutId = window.setTimeout(() => {
          // Update cursor position and timestamp
          updateCursorPosition(x, y, activeChartId || undefined);
          lastPosition.x = x;
          lastPosition.y = y;
          lastUpdateTime = Date.now();
        }, debounceTime);
        }
    };
    
    // Use passive listener with capture to ensure we get all events
    canvasRef.current.addEventListener('mousemove', handleMouseMove, { passive: true, capture: true });
    
    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousemove', handleMouseMove, { capture: true });
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [canvasRef.current, currentUser, activeChartId, activelyDraggingChart, activelyResizingChart]);

  // Memoize mapped data sources to prevent unnecessary re-renders
  const memoizedDataSources = useMemo(() => {
    return contextDataSources.map(src => ({
      id: src.id || '',
      name: src.name,
      type: src.type as DataSourceType,
      status: src.status as DataSourceStatus,
      // Set all data sources as connected regardless of status for development purposes
      connected: true
    }));
  }, [contextDataSources]);

  // Track if initialization has already occurred
  const initializedRef = useRef(false);
  // Track the last workspace ID that was loaded
  const lastWorkspaceIdRef = useRef<string | null>(null);
  // Add a stable state ref to track loading state
  const isLoadingRef = useRef(isLoading);
  // Guard against multiple initializations even during rapid re-renders
  const initializationInProgressRef = useRef(false);
  // Add a ref to track if URL validation has already been performed
  const urlValidationPerformedRef = useRef(false);

  // Map chart configs to a simpler format for the chart type selector
  const chartTypeOptions = useMemo(() => {
    return allCharts.map(c => ({
      id: c.id,
      name: c.name,
      // Use a default icon name based on the chart type
      icon: c.id.includes('bar') ? 'bar-chart' : 
            c.id.includes('line') ? 'line-chart' :
            c.id.includes('pie') ? 'pie-chart' :
            c.id.includes('table') ? 'table' : 'bar-chart'
    }));
  }, []);

  // Stabilize memoizedDataSources further to prevent frequent rerenders
  const memoizedDataSourcesStable = useMemo(() => {
    if (contextDataSources.length === 0) {
      return [];
    }
    return memoizedDataSources;
  }, [memoizedDataSources, contextDataSources.length]);

  // Stabilize getWorkspaceById reference
  const stableGetWorkspaceById = useCallback((id: string) => {
    return getWorkspaceById(id);
  }, [getWorkspaceById]);

  // Update the component when props change
  useEffect(() => {
    // Log workspace ID during component updates
    console.log('StudioEditor received workspaceId prop:', workspaceId);
    
    // Update local state when props change
    if (workspaceId) {
      // CRITICAL FIX: Compare with current stored workspace to see if there's a mismatch
      const currentStoredId = lastWorkspaceIdRef.current;
      if (currentStoredId && currentStoredId !== workspaceId) {
        console.warn('IMPORTANT: Workspace ID mismatch detected!', 
          { current: currentStoredId, new: workspaceId });
      }
      
      // Always update the ref with the latest prop value
      lastWorkspaceIdRef.current = workspaceId;
    }
    
    // No need to manually set these as they're passed as props
  }, [workspaceId, workspaceName, workspaceDescription]);

  // Initialize workspace with optimized approach
  useEffect(() => {
    // Skip if data sources are still loading
    if (isLoadingDataSources) return;
    
    // Skip if no workspace ID is provided
    if (!workspaceId) {
      console.warn('No workspace ID provided, cannot initialize workspace');
      return;
    }
    
    // CRITICAL FIX: Only perform URL validation once per component lifecycle
    if (!urlValidationPerformedRef.current) {
      const queryParams = new URLSearchParams(window.location.search);
      const urlWorkspaceId = queryParams.get('workspace');
      
      // Log details for debugging without adding a separate useEffect
      console.log('StudioEditor workspace ID validation:');
      console.log('- URL workspace ID:', urlWorkspaceId);
      console.log('- Props workspace ID:', workspaceId);
      
      // If URL and prop IDs don't match, force the URL workspace ID to be used
      if (urlWorkspaceId && workspaceId && urlWorkspaceId !== workspaceId) {
        console.warn('WORKSPACE ID MISMATCH - Force reload to match URL workspace ID');
        
        // Update localStorage with the URL ID
        localStorage.setItem('studio_last_workspace_id', urlWorkspaceId);
        
        // Force hard reload to resolve the mismatch
        window.location.href = `/studio?workspace=${urlWorkspaceId}`;
        return;
      }
      
      // Mark URL validation as performed so we don't do it again
      urlValidationPerformedRef.current = true;
    }

    // CRITICAL FIX: If we've already initialized once with this exact workspaceId, don't reinitialize
    if (initializedRef.current && lastWorkspaceIdRef.current === workspaceId) {
      console.log('Workspace already initialized with ID:', workspaceId, '- Skipping reinitialization');
      return;
    }

    // Check if incoming ID is a valid UUID
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId);
    const isTemporary = workspaceId.startsWith('workspace-');
    
    console.log('INITIALIZING WORKSPACE with properties:', {
      id: workspaceId,
      isValidUuid,
      isTemporary,
      alreadyInitialized: initializedRef.current,
      initializationInProgress: initializationInProgressRef.current
    });
     
    // Prevent concurrent initialization attempts
    if (initializationInProgressRef.current) {
      console.log('Initialization already in progress for workspace ID:', workspaceId);
      return;
    }
    
    // Set the initialization flag to prevent concurrent calls
    initializationInProgressRef.current = true;
    
    const initializeWorkspace = async () => {
      isLoadingRef.current = true;
      setIsLoading(true);
      
      try {
        // CRITICAL FIX: Always use the exact ID from props and never change it
        console.log('Loading workspace with explicit ID:', workspaceId);
         
        // Remember this workspace ID to prevent reloading - MUST be set before any async operations
        lastWorkspaceIdRef.current = workspaceId;
         
        // CRITICAL FIX: Immediately set a minimal workspace to prevent UI flickering
        const initialWorkspace = {
          id: workspaceId,
          name: workspaceName || 'Loading...',
          description: workspaceDescription || '',
          charts: [],
          dataSources: [],
          lastModified: new Date()
        };
         
        // Only set workspace if it's not already set with the same ID
        setWorkspace(prev => {
          if (!prev || prev.id !== workspaceId) {
            return initialWorkspace;
          }
          return prev;
        });
         
        // Use memoized data sources without causing a re-render
        const availableSources = memoizedDataSourcesStable;
         
        // For persistent workspaces, fetch from the API
        if (isValidUuid) {
          console.log('Loading PERSISTENT workspace from database with ID:', workspaceId);
          
          try {
            // CRITICAL FIX: Use the exact workspaceId to fetch data
            const workspaceData = await stableGetWorkspaceById(workspaceId);
             
            // We've already set lastWorkspaceIdRef above, so if this changed in the meantime
            // it means this initialization is stale, and we should abort.
            if (lastWorkspaceIdRef.current !== workspaceId) {
              console.log('Workspace ID changed during async loading - aborting initialization');
              return;
            }
           
            if (workspaceData) {
              console.log('SUCCESSFULLY loaded workspace data from API:', 
                { title: workspaceData.workspace.title, 
                  id: workspaceData.workspace.id, 
                  charts: workspaceData.charts.length });
             
              // Convert persistent charts to our chart format
              const convertedCharts: ChartTemplateInstance[] = workspaceData.charts.map(persistentChart => {
                // Parse config and position from stored JSON
                const config = persistentChart.config || {};
                const position = persistentChart.position || {};
               
                // Store the chart position for later use
                const chartPosition = {
                  x: position.x || 0,
                  y: position.y || 0
                };
                 
                // Also store chart dimensions
                const chartDimension = {
                  width: position.w || 400, 
                  height: position.h || 300
                };
                 
                // Update our chart positions and dimensions state
                setChartPositions(prev => ({
                  ...prev,
                  [persistentChart.id]: chartPosition
                }));
                 
                setChartDimensions(prev => ({
                  ...prev,
                  [persistentChart.id]: chartDimension
                }));
               
                return {
                  id: persistentChart.id,
                  templateId: persistentChart.chart_type || 'basic-bar',
                  name: persistentChart.title || 'Visualization',
                  size: 'medium',
                  config,
                  dataSourceId: persistentChart.data_source_id || null,
                  dataTransformations: [],
                  style: {
                    left: position.x || 0,
                    top: position.y || 0,
                    width: position.w || '100%',
                    height: position.h || '100%',
                    zIndex: 1
                  },
                  query: config.query || '',
                  queryResult: config.data || undefined
                };
              });
             
              // Set workspace state with the loaded data
              setWorkspace({
                id: workspaceId, // CRITICAL: Always use the exact ID from props
                name: workspaceData.workspace.title || workspaceName || 'Untitled Workspace',
                description: workspaceData.workspace.description || workspaceDescription || '',
                charts: convertedCharts,
                dataSources: availableSources,
                lastModified: new Date(workspaceData.workspace.updated_at || new Date())
              });
             
              // Set the first chart as active if any exist
              if (convertedCharts.length > 0) {
                setActiveChartId(convertedCharts[0].id);
              }
               
              // Save this workspace ID as the last used one for persistence
              try {
                localStorage.setItem('studio_last_workspace_id', workspaceId);
              } catch (e) {
                console.error('Error saving workspace ID to localStorage:', e);
              }
            } else {
              console.warn('No workspace data found in database for ID:', workspaceId);
              // Create a new empty persistent workspace with this ID
              setWorkspace({
                id: workspaceId, // CRITICAL: Always use the exact ID from props
                name: workspaceName || 'Untitled Workspace',
                description: workspaceDescription || '',
                charts: [],
                dataSources: availableSources,
                lastModified: new Date()
              });
            }
          } catch (error: any) {
            console.error('Error fetching workspace from API:', error);
            
            // If API fails, still create a workspace with the exact ID from props
            setWorkspace({
              id: workspaceId, // CRITICAL: Always use the exact ID from props
              name: workspaceName || 'Untitled Workspace',
              description: workspaceDescription || '',
              charts: [],
              dataSources: availableSources,
              lastModified: new Date()
            });
          }
        } else {
          // Handle temporary workspace (starts with 'workspace-')
          console.warn('WARNING: Using a temporary workspace that will not persist charts!');
          
          setWorkspace({
            id: workspaceId,
            name: workspaceName || 'Temporary Workspace',
            description: workspaceDescription || 'This is a temporary workspace. Charts will not be saved.',
            charts: [],
            dataSources: availableSources,
            lastModified: new Date()
          });
        }
        
        // Finally, set available data sources 
        setAvailableDataSources(availableSources);
      } catch (error) {
        console.error('Error initializing workspace:', error);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
        initializedRef.current = true;
        // Reset the initialization in progress flag
        initializationInProgressRef.current = false;
        console.log('Workspace initialization completed for ID:', workspaceId);
      }
    };
    
    initializeWorkspace();
    
    // Return statement to fix linter error
    return () => {
      console.log('Cleaning up workspace initialization');
    };
  // CRITICAL FIX: Optimize dependency array to prevent frequent re-renders
  // Only include essential dependencies that should trigger re-initialization
  }, [
    workspaceId,
    isLoadingDataSources,
    // Include stable references but NOT internal state variables that change frequently
    memoizedDataSourcesStable,
    stableGetWorkspaceById
  ]);
  
  // ...
  
  const initializeWorkspace = useCallback(async (id: string) => {
    console.log('initializeWorkspace called with ID:', id);
    // ... rest of function unchanged
  }, []);

  // Helper function to get chart name from template ID
  const getChartNameFromTemplateId = (templateId: string): string => {
    const chartConfig = allCharts.find(c => c.id === templateId);
    
    if (chartConfig) {
      return chartConfig.name;
    }
    
    // Fallback: format the template ID as a readable name
    return templateId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Handle data source selection
  const handleDataSourceSelect = async (chartId: string, dataSourceId: string) => {
    if (!workspace) return;
    
    setIsExecutingQuery(true);
    setQueryError(null);
    
    try {
      // Update chart with new data source
      setWorkspace(prev => {
        if (!prev) return prev;
        
        const updatedCharts = prev.charts.map(chart => {
          if (chart.id === chartId) {
            return { 
              ...chart, 
              dataSourceId
            };
          }
          return chart;
        });
        
        // Add data source to workspace if not already there
        const dataSource = availableDataSources.find(ds => ds.id === dataSourceId);
        let updatedDataSources = [...prev.dataSources];
        
        if (dataSource && !updatedDataSources.some(ds => ds.id === dataSourceId)) {
          updatedDataSources.push(dataSource);
        }
        
        return {
          ...prev,
          charts: updatedCharts,
          dataSources: updatedDataSources,
          lastModified: new Date()
        };
      });
      
      // Get the active chart
      const activeChart = workspace.charts.find(chart => chart.id === chartId);
      if (!activeChart) return;
      
      // Get the data source information
      const dataSource = availableDataSources.find(ds => ds.id === dataSourceId);
      
      // Create a smarter query based on chart type
      let smartQuery = `Show ${activeChart.name.toLowerCase()}`;
      
      // Create more specific queries based on chart type
      if (activeChart.templateId.includes('bar')) {
        smartQuery = `Show ${activeChart.name.toLowerCase()} with top 10 values`;
      } else if (activeChart.templateId.includes('line') || activeChart.templateId.includes('area')) {
        smartQuery = `Show ${activeChart.name.toLowerCase()} trend over time`;
      } else if (activeChart.templateId.includes('pie') || activeChart.templateId.includes('donut')) {
        smartQuery = `Show ${activeChart.name.toLowerCase()} distribution breakdown`;
      } else if (activeChart.templateId.includes('waterfall') || activeChart.templateId.includes('bridge')) {
        smartQuery = `Show ${activeChart.name.toLowerCase()} with changes between initial and final values`;
      }
      
      // Add data source name if available
      if (dataSource) {
        smartQuery += ` from ${dataSource.name}`;
      }
      
      // Execute the query
      const results = await executeQuery(dataSourceId, smartQuery);
      
      // Update chart with query and results
      setWorkspace(prev => {
        if (!prev) return prev;
        
        const updatedCharts = prev.charts.map(chart => {
          if (chart.id === chartId) {
            return { 
              ...chart, 
              dataSourceId,
              query: smartQuery,
              queryResult: results.rows
            };
          }
          return chart;
        });
        
        return {
          ...prev,
          charts: updatedCharts,
          lastModified: new Date()
        };
      });
      
      // Add a team comment about the data connection
      handleAddSystemComment(`Connected chart to ${dataSource?.name || 'data source'}`);
      
      // Record in collaboration history
      if (currentUser && dataSourceId) {
        addQueryExecution(chartId, smartQuery);
      }
    } catch (error) {
      console.error('Error connecting to data source:', error);
      setQueryError('Failed to connect to data source. Please try again.');
      
      // Add error message to comments
      handleAddSystemComment('Error connecting to data source. Please try again or select a different source.');
    } finally {
      setIsExecutingQuery(false);
    }
  };

  // Handle query execution
  const handleRunQuery = async (chartId: string) => {
    if (!workspace) return;
    
    // Find the chart
    const chart = workspace.charts.find(c => c.id === chartId);
    if (!chart || !chart.dataSourceId || !chart.query) {
      setQueryError('No query or data source selected for this chart.');
      handleAddSystemComment('Please select a data source and enter a query before running.');
      return;
    }
    
    // Set loading state
    setIsExecutingQuery(true);
    setQueryError(null);
    
    try {
      // Execute the query
      const results = await executeQuery(chart.dataSourceId, chart.query);
      
      // Update chart with results
      setWorkspace(prev => {
        if (!prev) return prev;
        
        const updatedCharts = prev.charts.map(c => {
          if (c.id === chartId) {
            return { 
              ...c, 
              queryResult: results.rows
            };
          }
          return c;
        });
        
        return {
          ...prev,
          charts: updatedCharts,
          lastModified: new Date()
        };
      });
      
      // Add system comment
      const dataSourceName = availableDataSources.find(ds => ds.id === chart.dataSourceId)?.name || 'database';
      handleAddSystemComment(`Query executed on ${dataSourceName}`);
      
      // Record in collaboration history
      if (currentUser && chart.dataSourceId) {
        try {
          addQueryExecution(chartId, chart.query);
        } catch (error) {
          console.error('Error recording query execution:', error);
          // Non-critical error, don't need to show to user
        }
      }
    } catch (error) {
      console.error('Error executing query:', error);
      
      // Determine more specific error message if possible
      let errorMessage = 'Failed to execute query. Please check the query syntax and try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('syntax')) {
          errorMessage = 'SQL syntax error. Please check your query.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Query execution timed out. Try simplifying your query.';
        } else if (error.message.includes('permission') || error.message.includes('access')) {
          errorMessage = 'Permission denied. You may not have access to this data.';
        } else if (error.message.includes('connect')) {
          errorMessage = 'Failed to connect to data source. It may be offline.';
        }
      }
      
      setQueryError(errorMessage);
      
      // Add error message to comments with a helpful suggestion
      handleAddSystemComment(`${errorMessage} Please try again or contact support if the issue persists.`);
      
      // Clear any existing results to indicate the error state properly
      setWorkspace(prev => {
        if (!prev) return prev;
        
        const updatedCharts = prev.charts.map(c => {
          if (c.id === chartId) {
            return { 
              ...c, 
              queryResult: undefined // Clear the result to show the error state
            };
          }
          return c;
        });
        
        return {
          ...prev,
          charts: updatedCharts,
          lastModified: new Date()
        };
      });
    } finally {
      setIsExecutingQuery(false);
    }
  };

  // Enhanced add chart function with smart chart type selection
  const handleAddChart = () => {
    if (!workspace) return;
    
    // Get available data sources that are connected
    const connectedDataSources = availableDataSources.filter(ds => ds.connected);
    const hasConnectedDataSources = connectedDataSources.length > 0;
    
    // Select a primary data source if available
    const primaryDataSource = hasConnectedDataSources ? connectedDataSources[0] : null;
    
    // Get a chart type that makes sense for the data source
    let newTemplateId = 'basic-bar'; // Default to bar chart
    
    if (primaryDataSource) {
      // Recommend chart type based on data source name
      if (primaryDataSource.name.toLowerCase().includes('time') || 
          primaryDataSource.name.toLowerCase().includes('trend') || 
          primaryDataSource.name.toLowerCase().includes('series')) {
        newTemplateId = 'enhanced-area-chart';
      } else if (primaryDataSource.name.toLowerCase().includes('distribution') || 
                 primaryDataSource.name.toLowerCase().includes('percentage')) {
        newTemplateId = 'basic-pie';
      } else if (primaryDataSource.name.toLowerCase().includes('comparison')) {
        newTemplateId = 'yoy-comparison-bar-chart';
      } else if (primaryDataSource.name.toLowerCase().includes('variance') || 
                 primaryDataSource.name.toLowerCase().includes('bridge')) {
        newTemplateId = 'bridge-chart';
      }
    } else {
      // If no connected data source, choose a chart type that doesn't already exist
      const existingTemplateIds = workspace.charts.map(chart => chart.templateId);
      
      for (const chart of allCharts) {
        if (!existingTemplateIds.includes(chart.id)) {
          newTemplateId = chart.id;
          break;
        }
      }
    }
    
    const chartId = `chart-${Date.now()}`;
    const chartName = getChartNameFromTemplateId(newTemplateId);
    
    // Create the new chart
    const newChart: ChartTemplateInstance = {
      id: chartId,
      templateId: newTemplateId,
      name: chartName,
      size: 'medium',
      config: {},
      dataSourceId: primaryDataSource ? primaryDataSource.id : null,
      dataTransformations: [],
      style: {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: 1
      }
    };
    
    // Update workspace
    setWorkspace(prevWorkspace => {
      if (!prevWorkspace) return prevWorkspace;
      return {
        ...prevWorkspace,
        charts: [...prevWorkspace.charts, newChart],
        lastModified: new Date()
      };
    });
    
    // Set as active chart
    setActiveChartId(chartId);
    
    // Add system comment
    const message = primaryDataSource 
      ? `Added new ${chartName} chart connected to ${primaryDataSource.name}`
      : `Added new ${chartName} chart`;
    
    handleAddSystemComment(message);
    
    // Auto-save the workspace to persist the new chart
    setTimeout(() => {
      if (workspaceId && !workspaceId.startsWith('workspace-')) {
        console.log('Auto-save timeout triggered. Will save workspace:', workspaceId);
        
        // CRITICAL FIX: Check if workspace ID is different than the one we should be using
        if (workspace.id !== workspaceId) {
          console.log('WARNING: Workspace ID mismatch. UI has', workspace.id, 'but should be using', workspaceId);
          
          // Fix workspace ID before saving
          setWorkspace(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              id: workspaceId // Use the proper ID
            };
          });
          
          // Wait for state update before saving
          setTimeout(() => {
            console.log('Saving after fixing workspace ID');
            handleSaveWorkspace();
          }, 100);
        } else {
        handleSaveWorkspace();
        }
      } else {
        console.log('Auto-save skipped - workspace is temporary:', workspaceId);
        // Alert about temporary workspace
        if (workspace.id.startsWith('workspace-')) {
          console.warn('Cannot save charts to a temporary workspace');
          alert('Warning: You are using a temporary workspace. Charts will not be saved until you create a persistent workspace.');
        }
      }
    }, 500);
    
    // If we have a primary data source, automatically run a query
    if (primaryDataSource) {
      // Use a setTimeout to ensure the chart is fully added before querying
      setTimeout(() => {
        handleDataSourceSelect(chartId, primaryDataSource.id);
      }, 100);
    }
  };

  // Delete a chart
  const handleDeleteChart = async (chartId: string) => {
    if (!workspace) return;
    
    // Get chart name before deleting
    const chartName = workspace.charts.find(c => c.id === chartId)?.name || 'chart';
    
    // Update workspace
    setWorkspace({
      ...workspace,
      charts: workspace.charts.filter(chart => chart.id !== chartId),
      lastModified: new Date()
    });
    
    // Update active chart if the deleted chart was active
    if (activeChartId === chartId) {
      const remainingCharts = workspace.charts.filter(chart => chart.id !== chartId);
      setActiveChartId(remainingCharts.length > 0 ? remainingCharts[0].id : null);
    }
    
    // Add system comment
    handleAddSystemComment(`Removed "${chartName}" chart`);
    
    // If this is a persisted chart (not a temporary one), delete it from the database
    if (!chartId.startsWith('chart-temp-') && workspaceId && !workspaceId.startsWith('workspace-')) {
      try {
        await deleteWorkspaceChart(workspaceId, chartId);
      } catch (error) {
        console.error('Error deleting chart from database:', error);
      }
    }
  };

  // Handle chart resize
  const handleResizeChart = (chartId: string, newSize: ChartTemplateInstance['size']) => {
    if (!workspace) return;
    
    setWorkspace(prevWorkspace => {
      if (!prevWorkspace) return prevWorkspace;
      
      const updatedCharts = prevWorkspace.charts.map(chart => {
        if (chart.id === chartId) {
          return { ...chart, size: newSize };
        }
        return chart;
      });
      
      return {
        ...prevWorkspace,
        charts: updatedCharts,
        lastModified: new Date()
      };
    });
    
    // When maximizing to 'full' size, ensure we reset positioning to center
    if (newSize === 'full') {
      setChartPositions(prev => ({
        ...prev,
        [chartId]: { x: 0, y: 0 }
      }));
      
      // Reset canvas offset to ensure the full chart is visible
      setCanvasOffset({ x: 0, y: 0 });
      setZoomLevel(100);
    }
    
    // Add system comment
    const chart = workspace.charts.find(c => c.id === chartId);
    if (chart) {
      handleAddSystemComment(`Chart "${chart.name}" resized to ${newSize}`);
    }
  };

  // Add wheel event listener for zoom with proper non-passive handling
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Get current scale and mouse position
      const currentScale = zoomLevel / 100;
      
      // Calculate zoom delta (smaller steps for finer control)
      const delta = e.deltaY > 0 ? -3 : 3;
      const newZoomLevel = Math.min(Math.max(zoomLevel + delta, 20), 400);
      
      // Calculate new scale
      const newScale = newZoomLevel / 100;
      
      // Calculate mouse position relative to canvas
      const canvasRect = canvasRef.current!.getBoundingClientRect();
      const mouseXRelativeToCanvas = e.clientX - canvasRect.left;
      const mouseYRelativeToCanvas = e.clientY - canvasRect.top;
      
      // Calculate mouse position relative to content (considering current offset)
      const mouseXRelativeToContent = mouseXRelativeToCanvas / currentScale - canvasOffset.x;
      const mouseYRelativeToContent = mouseYRelativeToCanvas / currentScale - canvasOffset.y;
      
      // Calculate new offsets to zoom toward mouse position
      const newOffsetX = -mouseXRelativeToContent + mouseXRelativeToCanvas / newScale;
      const newOffsetY = -mouseYRelativeToContent + mouseYRelativeToCanvas / newScale;
      
      // Update state with new zoom level and offsets
      setZoomLevel(newZoomLevel);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    };
    
    const canvas = canvasRef.current;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [canvasOffset, zoomLevel]);
  
  // Add a system comment (not from a user)
  const handleAddSystemComment = (text: string) => {
    const systemComment = {
      id: `system-${Date.now()}`,
      userId: 'system',
      text,
      timestamp: Date.now(),
      resolved: false,
      author: 'System',
      isHighlighted: true
    };
    
    setTeamComments(prev => [...prev, systemComment]);
    
    // Scroll to the new comment
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Add chart type change functionality
  const handleChangeChartType = (chartId: string, newTemplateId: string) => {
    if (!workspace) return;
    
    // Update the chart type
    setWorkspace({
      ...workspace,
      charts: workspace.charts.map(chart => {
        if (chart.id === chartId) {
          return { 
            ...chart, 
            templateId: newTemplateId,
            name: getChartNameFromTemplateId(newTemplateId)
          };
        }
        return chart;
      }),
      lastModified: new Date()
    });
    
    // Add system comment
    handleAddSystemComment(`Chart type changed to ${getChartNameFromTemplateId(newTemplateId)}`);
  };

  // Handle chart position change - properly implemented
  const handleMoveChart = (chartId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    if (!workspace) return;
    
    // Get current chart
    const chart = workspace.charts.find(c => c.id === chartId);
    if (!chart) return;
    
    // Get current position or use default
    const currentPosition = chartPositions[chartId] || { x: 0, y: 0 };
    
    // Calculate new position based on direction
    const moveAmount = 20; // pixels
    let newX = currentPosition.x;
    let newY = currentPosition.y;
    
    switch (direction) {
      case 'up':
        newY -= moveAmount;
        break;
      case 'down':
        newY += moveAmount;
        break;
      case 'left':
        newX -= moveAmount;
        break;
      case 'right':
        newX += moveAmount;
        break;
    }
    
    // Update position
    setChartPositions({
      ...chartPositions,
      [chartId]: { x: newX, y: newY }
    });
    
    // Add system comment
    handleAddSystemComment(`Chart "${chart.name}" moved ${direction}`);
  };

  // Handle start of dragging a chart
  const handleChartDragStart = (e: React.MouseEvent, chartId: string) => {
    e.stopPropagation(); // Prevent canvas dragging
    
    // Get current chart position
    const currentPosition = chartPositions[chartId] || { x: 0, y: 0 };
    
    // Set active dragging chart
    setActivelyDraggingChart(chartId);
    
    // Store initial position
    chartDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      chartX: currentPosition.x,
      chartY: currentPosition.y
    };
  };

  // Handle chart dragging - wrap in useCallback to prevent infinite loop
  const handleChartDragMove = useCallback((e: React.MouseEvent) => {
    // Early return if no active chart or start ref is null
    if (!activelyDraggingChart || !chartDragStartRef.current) return;
    
    try {
      // Calculate delta - with additional safety checks
      const startX = chartDragStartRef.current?.x || 0;
      const startY = chartDragStartRef.current?.y || 0;
      const chartX = chartDragStartRef.current?.chartX || 0;
      const chartY = chartDragStartRef.current?.chartY || 0;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Apply delta to chart position with safety checks
      setChartPositions(prevPositions => ({
        ...prevPositions,
        [activelyDraggingChart]: {
          x: chartX + deltaX,
          y: chartY + deltaY
        }
      }));
    } catch (error) {
      // If there's an error, clean up the dragging state
      console.warn('Error during chart drag:', error);
      setActivelyDraggingChart(null);
      chartDragStartRef.current = null;
    }
  }, [activelyDraggingChart, chartDragStartRef]);

  // Handle end of dragging a chart
  const handleChartDragEnd = useCallback(() => {
    // Make sure to clean up the refs and state
    if (activelyDraggingChart) {
      // Add any final position adjustments if needed
      
      // Then clear the state
      setActivelyDraggingChart(null);
    }
    
    // Always clear the ref to prevent stale data
    chartDragStartRef.current = null;
  }, [activelyDraggingChart]);

  // Initialize chart dimensions based on size
  useEffect(() => {
    if (workspace && workspace.charts.length > 0) {
      const updatedDimensions: Record<string, ChartDimensions> = {};
      let needsUpdate = false;
      
      workspace.charts.forEach(chart => {
        // Only set dimensions for charts that don't have them yet
        if (!chartDimensions[chart.id]) {
          needsUpdate = true;
          let width = 288; // w-72 = 18rem = 288px
          let height = 288; // h-72 = 288px
          
          // Adjust size based on chart size
          if (chart.size === 'medium') {
            width = 384; // w-96 = 24rem = 384px
            height = 320; // h-80 = 320px
          } else if (chart.size === 'large') {
            width = 480; // w-[30rem] = 30rem = 480px 
            height = 384; // h-96 = 24rem = 384px
          } else if (chart.size === 'full') {
            width = 800;
            height = 600;
          }
          
          updatedDimensions[chart.id] = { width, height };
        }
      });
      
      // Only update state if there are new dimensions
      if (needsUpdate) {
        setChartDimensions(prev => ({
          ...prev,
          ...updatedDimensions
        }));
      }
    }
  }, [workspace]); // Remove chartDimensions from dependency array

  // Handle start of resizing a chart
  const handleChartResizeStart = (e: React.MouseEvent, chartId: string, direction: ResizeDirection) => {
    e.stopPropagation(); // Prevent canvas dragging
    e.preventDefault();
    
    // Get current chart dimensions
    const currentDimensions = chartDimensions[chartId] || { width: 288, height: 288 };
    
    // Set active resizing chart
    setActivelyResizingChart(chartId);
    
    // Store initial dimensions and direction
    chartResizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: currentDimensions.width,
      height: currentDimensions.height,
      direction: direction,
      initialX: chartPositions[chartId]?.x || 0,
      initialY: chartPositions[chartId]?.y || 0
    };
  };

  // Handle chart resizing - wrap in useCallback
  const handleChartResizeMove = useCallback((e: React.MouseEvent) => {
    if (!activelyResizingChart || !chartResizeStartRef.current) return;
    
    // Calculate delta
    const deltaX = e.clientX - chartResizeStartRef.current.x;
    const deltaY = e.clientY - chartResizeStartRef.current.y;
    const { direction } = chartResizeStartRef.current;
    
    let newWidth = chartResizeStartRef.current.width;
    let newHeight = chartResizeStartRef.current.height;
    let newX = chartResizeStartRef.current.initialX;
    let newY = chartResizeStartRef.current.initialY;
    
    // Handle width changes based on direction
    if (direction.includes('e')) {
      newWidth = Math.max(200, chartResizeStartRef.current.width + deltaX);
    } else if (direction.includes('w')) {
      const widthChange = -deltaX;
      newWidth = Math.max(200, chartResizeStartRef.current.width + widthChange);
      if (newWidth >= 200) {
        newX = chartResizeStartRef.current.initialX + deltaX;
      }
    }
    
    // Handle height changes based on direction
    if (direction.includes('s')) {
      newHeight = Math.max(150, chartResizeStartRef.current.height + deltaY);
    } else if (direction.includes('n')) {
      const heightChange = -deltaY;
      newHeight = Math.max(150, chartResizeStartRef.current.height + heightChange);
      if (newHeight >= 150) {
        newY = chartResizeStartRef.current.initialY + deltaY;
      }
    }
    
    // Update chart dimensions
    setChartDimensions(prevDimensions => ({
      ...prevDimensions,
      [activelyResizingChart]: {
        width: newWidth,
        height: newHeight
      }
    }));
    
    // Update position if resizing from top or left
    if (direction.includes('n') || direction.includes('w')) {
      setChartPositions(prevPositions => ({
        ...prevPositions,
        [activelyResizingChart]: {
          x: newX,
          y: newY
        }
      }));
    }
    
    // Update the chart size category based on new dimensions
    const chart = workspace?.charts.find(c => c.id === activelyResizingChart);
    if (chart) {
      let newSize: ChartTemplateInstance['size'] = 'small';
      
      if (newWidth >= 480 || newHeight >= 384) {
        newSize = 'large';
      } else if (newWidth >= 384 || newHeight >= 320) {
        newSize = 'medium';
      }
      
      // Only update if different from current size
      if (newSize !== chart.size) {
        setWorkspace(prevWorkspace => {
          if (!prevWorkspace) return prevWorkspace;
          
          const updatedCharts = prevWorkspace.charts.map(c => {
            if (c.id === activelyResizingChart) {
              return { ...c, size: newSize };
            }
            return c;
          });
          
          return {
            ...prevWorkspace,
            charts: updatedCharts,
            lastModified: new Date()
          };
        });
      }
    }
  }, [activelyResizingChart, chartResizeStartRef, workspace, setChartDimensions, setChartPositions, setWorkspace]);

  // Handle end of resizing a chart
  const handleChartResizeEnd = () => {
    // Get the chart that was being resized
    if (activelyResizingChart && workspace) {
      const chart = workspace.charts.find(c => c.id === activelyResizingChart);
      if (chart && typeof teamComments !== 'undefined') {
        // Add system comment if we have a comment function
        const systemComment = {
          id: `system-${Date.now()}`,
          userId: 'system',
          text: `Chart "${chart.name}" resized manually`,
          timestamp: Date.now(),
          resolved: false,
          author: 'System',
          isHighlighted: true
        };
        
        setTeamComments(prev => [...prev, systemComment]);
      }
    }
    
    setActivelyResizingChart(null);
    chartResizeStartRef.current = null;
  };

  // Modify ChartContainer to use our new DataSourceSelector
  const renderChartContainerContent = (chart: ChartTemplateInstance) => {
    const chartData = chart.queryResult;
    const error = activeChartId === chart.id ? queryError : null;
    
    // If no data source selected, show selector
    if (!chart.dataSourceId) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium text-gray-200 mb-2">Connect Data Source</h3>
            <p className="text-sm text-gray-400 mb-4">
              Select a data source to visualize in this {chart.name.toLowerCase()}
            </p>
            
            <div className="w-64 mx-auto">
              <DataSourceSelector 
                availableSources={availableDataSources} 
                selectedSourceId={chart.dataSourceId}
                onSelect={(sourceId) => handleDataSourceSelect(chart.id, sourceId)}
                chartType={chart.templateId}
                isDisabled={isExecutingQuery}
              />
            </div>
          </div>
          
          <div className="text-center mt-2">
            <p className="text-xs text-gray-500">
              You can also add sample data or connect later
            </p>
          </div>
        </div>
      );
    }
    
    // If data source selected but no data loaded yet or error
    if (!chartData || error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          {error ? (
            <>
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-medium mt-2">{error}</h3>
              </div>
              <div className="w-64 mx-auto">
                <DataSourceSelector 
                  availableSources={availableDataSources} 
                  selectedSourceId={chart.dataSourceId}
                  onSelect={(sourceId) => handleDataSourceSelect(chart.id, sourceId)}
                  chartType={chart.templateId}
                  isDisabled={isExecutingQuery}
                />
              </div>
              <button 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                onClick={() => handleRunQuery(chart.id)}
                disabled={isExecutingQuery}
              >
                {isExecutingQuery ? 'Processing...' : 'Try Again'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-full mb-4"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                onClick={() => handleRunQuery(chart.id)}
                disabled={isExecutingQuery}
              >
                {isExecutingQuery ? 'Loading data...' : 'Load Data'}
              </button>
            </>
          )}
        </div>
      );
    }
    
    // Regular chart rendering
    return (
      <ChartContainer
        id={chart.id}
        title={chart.name}
        type={chart.templateId as ChartType}
        data={chart.queryResult || undefined}
        sql={chart.query || ''}
        dataSourceId={chart.dataSourceId || undefined}
        dataSourceName={chart.dataSourceId ? availableDataSources.find(ds => ds.id === chart.dataSourceId)?.name : undefined}
        isLoading={isExecutingQuery && activeChartId === chart.id}
        error={activeChartId === chart.id && queryError ? queryError : undefined}
        onDelete={() => handleDeleteChart(chart.id)}
        onResize={() => handleResizeChart(chart.id, getNextSize(chart.size))}
        onChangeType={(newType) => handleChangeChartType(chart.id, newType)}
        onMove={(direction) => handleMoveChart(chart.id, direction)}
        onSqlChange={(newSql) => {
          setWorkspace(prev => {
            if (!prev) return prev;
            
            const updatedCharts = prev.charts.map(c => {
              if (c.id === chart.id) {
                return { ...c, query: newSql };
              }
              return c;
            });
            
            return {
              ...prev,
              charts: updatedCharts,
              lastModified: new Date()
            };
          });
        }}
        onQueryRun={() => handleRunQuery(chart.id)}
        theme={isDarkMode ? "dark" : "light"}
        availableChartTypes={chartTypeOptions}
      />
    );
  };

  // Fix the getChartGridItems function to use our new rendering approach
  const getChartGridItems = useCallback(() => {
    if (!workspace) return [];
    
    // Define the chart grid item type inline
    type ChartGridItem = {
      id: string;
      title?: string;
      size?: 'small' | 'medium' | 'large' | 'full';
      dataSourceId?: string;
      isLoading?: boolean;
      content: JSX.Element;
      style?: React.CSSProperties;
    };
    
    return workspace.charts.map((chart): ChartGridItem => {
      // Get chart dimensions or use defaults based on size
      const dimensions = chartDimensions[chart.id] || {
        width: chart.size === 'small' ? 288 : chart.size === 'medium' ? 384 : chart.size === 'large' ? 480 : 800,
        height: chart.size === 'small' ? 288 : chart.size === 'medium' ? 320 : chart.size === 'large' ? 384 : 600
      };
      
      const chartWithPosition: ChartWithPosition = {
        ...chart,
        style: {
          position: 'absolute',
          left: chartPositions[chart.id] ? `${chartPositions[chart.id].x}px` : '0px',
          top: chartPositions[chart.id] ? `${chartPositions[chart.id].y}px` : '0px',
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`
        }
      };

      return {
        id: chart.id,
        title: chart.name,
        size: chart.size || 'medium',
        dataSourceId: chart.dataSourceId || undefined,
        isLoading: isExecutingQuery && activeChartId === chart.id,
        content: (
          <div 
            className="absolute"
            style={{
              ...chartWithPosition.style,
              transition: smoothTransition ? 'transform 0.3s ease, left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease' : 'none',
              cursor: activelyDraggingChart === chart.id ? 'grabbing' : 'grab',
              zIndex: activelyDraggingChart === chart.id || activelyResizingChart === chart.id ? 10 : chart.size === 'full' ? 50 : 1,
              border: activelyDraggingChart === chart.id ? '2px dashed #3b82f6' : 'none',
              backgroundColor: (activelyDraggingChart === chart.id || activelyResizingChart === chart.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}
            key={chart.id}
            data-chart-id={chart.id}
            onMouseDown={(e) => {
              if (e.button === 0) { // left click only
                handleChartDragStart(e, chart.id);
                e.stopPropagation();
              }
            }}
          >
            <div className="w-full h-full rounded-lg border border-gray-700 bg-gray-800 shadow-lg overflow-hidden">
              {renderChartContainerContent(chart)}
            </div>
            
            {/* Resize handles */}
            {/* Top edge */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 cursor-ns-resize"
              style={{ zIndex: 11 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'n')}
            />

            {/* Right edge */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-full cursor-ew-resize"
              style={{ zIndex: 11 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'e')}
            />

            {/* Bottom edge */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-2 cursor-ns-resize"
              style={{ zIndex: 11 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 's')}
            />

            {/* Left edge */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-full cursor-ew-resize"
              style={{ zIndex: 11 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'w')}
            />

            {/* Top-left corner */}
            <div
              className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize"
              style={{ zIndex: 12 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'nw')}
            />

            {/* Top-right corner */}
            <div
              className="absolute top-0 right-0 w-6 h-6 cursor-nesw-resize"
              style={{ zIndex: 12 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'ne')}
            />

            {/* Bottom-left corner */}
            <div
              className="absolute bottom-0 left-0 w-6 h-6 cursor-nesw-resize"
              style={{ zIndex: 12 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'sw')}
            />

            {/* Bottom-right corner with resize grip */}
            <div
              className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center"
              style={{ zIndex: 12 }}
              onMouseDown={(e) => handleChartResizeStart(e, chart.id, 'se')}
            >
              <svg 
                width="10" 
                height="10" 
                viewBox="0 0 10 10" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none"
              >
                <path 
                  d="M0 10V8H2V10H0ZM4 10V8H6V10H4ZM8 10V8H10V10H8ZM0 6V4H2V6H0ZM8 6V4H10V6H8ZM0 2V0H2V2H0ZM4 2V0H6V2H4ZM8 2V0H10V2H8Z" 
                  fill="#3B82F6" 
                />
              </svg>
            </div>

            {/* Visual resize indicators and dimensions display */}
            {activelyResizingChart === chart.id && (
              <>
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-blue-500 pointer-events-none" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-blue-500 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-blue-500 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-blue-500 pointer-events-none" />
                
                {/* Dimensions indicator */}
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-8 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow pointer-events-none border border-gray-700 z-20">
                  {Math.round(dimensions.width)} × {Math.round(dimensions.height)} px
                </div>
              </>
            )}
          </div>
        )
      };
    });
  }, [
    workspace, 
    chartPositions, 
    chartDimensions,
    smoothTransition, 
    isExecutingQuery, 
    queryError, 
    activeChartId, 
    activelyDraggingChart,
    activelyResizingChart,
    handleDeleteChart, 
    handleResizeChart, 
    handleChangeChartType, 
    handleMoveChart, 
    handleRunQuery, 
    isDarkMode, 
    availableDataSources,
    chartTypeOptions
  ]);

  // Render loading state
  if (isLoading || isLoadingDataSources) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
          <p className="text-gray-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Render error state if no workspace
  if (!workspace) {
    return (
      <div className="p-6 text-center bg-gray-900 text-white h-screen">
        <h2 className="text-xl font-semibold">
          Error Loading Workspace
        </h2>
        <p className="mt-2 text-gray-400">
          There was a problem loading the workspace. Please try again.
        </p>
        <button 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={onClose}
        >
          Return to Gallery
        </button>
      </div>
    );
  }

  // Save the current workspace
  const handleSaveWorkspace = async () => {
    if (!workspace) return;
    
    console.log('Save attempt - Workspace ID:', workspace.id, 'Temporary?', workspace.id.startsWith('workspace-'));
    
    // Don't save temporary workspaces
    if (workspace.id.startsWith('workspace-')) {
      alert('Cannot save a temporary workspace. Please create a persistent workspace first.');
      return;
    }
    
    try {
      console.log(`Saving workspace: ${workspace.id} with ${workspace.charts.length} charts`);
      
      // First update workspace metadata if it has changed
      const workspaceMetadata = {
        title: workspace.name,
        description: workspace.description
      };
      
      console.log('Updating workspace metadata:', workspaceMetadata);
      const updatedWorkspaceMetadata = await updateWorkspace(workspace.id, workspaceMetadata);
      console.log('Workspace metadata updated successfully:', updatedWorkspaceMetadata);
      
      // Log all chart IDs for debugging
      console.log('Charts to save:', workspace.charts.map(c => c.id));
      
      if (workspace.charts.length === 0) {
        console.log('No charts to save');
        handleAddSystemComment('Workspace saved (no charts to save)');
        return;
      }
      
      // Then save each chart - using Promise.all to ensure all promises resolve before continuing
      const savePromises = [];
      
      for (const chart of workspace.charts) {
        console.log(`Processing chart: ${chart.id} (${chart.name})`);
        
        // For new/temporary charts (they have chart-* IDs)
        if (chart.id.startsWith('chart-')) {
          console.log(`Saving new chart: ${chart.id}`);
          
          // Convert chart to database format
          const chartData = {
            title: chart.name,
            chart_type: chart.templateId,
            data_source_id: chart.dataSourceId || undefined, // Convert null to undefined
            config: {
              ...chart.config,
              query: chart.query,
              data: chart.queryResult
            },
            position: {
              x: chartPositions[chart.id]?.x || 0,
              y: chartPositions[chart.id]?.y || 0,
              w: chartDimensions[chart.id]?.width || 400,
              h: chartDimensions[chart.id]?.height || 300
            }
          };
          
          console.log('Chart data to save:', chartData);
          
          // Add chart to workspace
          const savePromise = (async () => {
          try {
              console.log(`Calling addChartToWorkspace for workspace ${workspace.id} with chart ${chart.id}`);
            const savedChart = await addChartToWorkspace(workspace.id, chartData);
            
            if (savedChart) {
                console.log(`Chart saved successfully: ${savedChart.id}`, savedChart);
              
              // Update the chart ID in workspace to the persisted ID
              setWorkspace(prev => {
                if (!prev) return prev;
                
                const updatedCharts = prev.charts.map(c => {
                  if (c.id === chart.id) {
                      console.log(`Updating chart ID from ${c.id} to ${savedChart.id}`);
                    return { ...c, id: savedChart.id };
                  }
                  return c;
                });
                
                return { ...prev, charts: updatedCharts };
              });
                
                return { success: true, originalId: chart.id, newId: savedChart.id };
            } else {
              console.error(`Failed to save chart: ${chart.id} - no response from server`);
                return { success: false, originalId: chart.id, error: 'No response from server' };
            }
          } catch (error) {
            console.error(`Error saving chart ${chart.id}:`, error);
              return { success: false, originalId: chart.id, error };
          }
          })();
          
          savePromises.push(savePromise);
        } else {
          // For existing charts, update them
          console.log(`Updating existing chart: ${chart.id}`);
          
          const chartData = {
            title: chart.name,
            chart_type: chart.templateId,
            data_source_id: chart.dataSourceId || undefined, // Convert null to undefined
            config: {
              ...chart.config,
              query: chart.query,
              data: chart.queryResult
            },
            position: {
              x: chartPositions[chart.id]?.x || 0,
              y: chartPositions[chart.id]?.y || 0,
              w: chartDimensions[chart.id]?.width || 400,
              h: chartDimensions[chart.id]?.height || 300
            }
          };
          
          console.log('Chart data to update:', chartData);
          
          const updatePromise = (async () => {
            try {
              console.log(`Calling updateChart for workspace ${workspace.id} with chart ${chart.id}`);
              const updatedChart = await updateChart(workspace.id, chart.id, chartData);
              console.log(`Chart updated successfully:`, updatedChart);
              return { success: true, chartId: chart.id };
          } catch (error) {
            console.error(`Error updating chart ${chart.id}:`, error);
              return { success: false, chartId: chart.id, error };
            }
          })();
          
          savePromises.push(updatePromise);
        }
      }
      
      // Wait for all save operations to complete
      const results = await Promise.all(savePromises);
      console.log('All chart save operations completed:', results);
      
      // Force refresh the workspace after saving
      if (workspaceId) {
        console.log('Refreshing workspace data after save');
        try {
          const refreshedWorkspace = await getWorkspaceById(workspaceId);
          if (refreshedWorkspace) {
            console.log('Refreshed workspace data:', refreshedWorkspace);
            console.log('Charts in refreshed workspace:', refreshedWorkspace.charts.length);
          }
        } catch (error) {
          console.error('Error refreshing workspace after save:', error);
        }
      }
      
      console.log('Workspace saved successfully!');
      handleAddSystemComment('Workspace saved');
    } catch (error) {
      console.error('Error saving workspace:', error);
      alert('Failed to save workspace. Please try again.');
    }
  };

  // Make sure we have the handleVisualizationGenerated function defined
  const handleVisualizationGenerated = (visualizationConfig: any) => {
    if (!workspace) return;
    
    // Create a new chart from the generated config
    const chartId = `chart-${Date.now()}`;
    
    const newChart: ChartTemplateInstance = {
      id: chartId,
      templateId: visualizationConfig.chartType || 'basic-bar',
      name: visualizationConfig.title || 'Generated Visualization',
      size: 'medium',
      config: visualizationConfig.config || {},
      dataSourceId: visualizationConfig.dataSourceId,
      dataTransformations: visualizationConfig.transformations || [],
      query: visualizationConfig.query || '',
      queryResult: visualizationConfig.data || undefined,
      style: {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: 1
      }
    };
    
    // Update workspace with new chart
    setWorkspace(prevWorkspace => {
      if (!prevWorkspace) return prevWorkspace;
      return {
        ...prevWorkspace,
        charts: [...prevWorkspace.charts, newChart],
        lastModified: new Date()
      };
    });
    
    // Set as active chart
    setActiveChartId(chartId);
    
    // Add system comment
    handleAddSystemComment(`Generated new visualization: ${newChart.name}`);
    
    // Auto-save the workspace to persist the new visualization
    // Use setTimeout to ensure the workspace state is updated before saving
    setTimeout(() => {
      if (workspaceId && !workspaceId.startsWith('workspace-')) {
        handleSaveWorkspace();
      }
    }, 500);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Top toolbar */}
      <div className="flex justify-between items-center bg-gray-900 border-b border-gray-700 p-4 shadow-sm flex-shrink-0">
        <div className="flex items-center">
          <button 
            className="p-2 mr-3 rounded-full hover:bg-gray-800 transition-colors"
            onClick={onClose}
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white">{workspace.name}</h1>
            <p className="text-sm text-gray-400">{workspace.description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Save button */}
          <button
            className="px-3 py-2 bg-green-600 rounded flex items-center hover:bg-green-700 transition-colors"
            onClick={handleSaveWorkspace}
            disabled={!workspaceId || workspaceId.startsWith('workspace-')}
            title={workspaceId && !workspaceId.startsWith('workspace-') 
              ? 'Save workspace' 
              : 'Cannot save temporary workspace'}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </button>
          
          {/* Data sources dropdown */}
          <div className="relative">
            <button
              className="px-3 py-2 bg-gray-800 rounded flex items-center hover:bg-gray-700 transition-colors"
              onClick={() => setShowDataPanel(!showDataPanel)}
            >
              <Database className="w-4 h-4 mr-2" />
              Data
              {showDataPanel ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </button>
            
            {showDataPanel && (
              <div className="absolute top-full right-0 mt-1 w-80 bg-gray-800 rounded-lg shadow-lg z-10 border border-gray-700 overflow-hidden">
                <div className="p-3 border-b border-gray-700">
                  <h3 className="font-medium">Data Sources</h3>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {availableDataSources.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No data sources available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableDataSources.map(source => (
                        <div 
                          key={source.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                          onClick={() => {
                            if (activeChartId) {
                              handleDataSourceSelect(activeChartId, source.id);
                              setShowDataPanel(false);
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <Database className="w-4 h-4 mr-2 text-blue-400" />
                            <span>{source.name}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            source.status === 'connected' 
                              ? 'bg-green-900/50 text-green-400' 
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {source.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-gray-700">
                  <button className="w-full text-center text-sm py-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                    Add New Source
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Collaborators button */}
          <button className="px-3 py-2 bg-gray-800 rounded flex items-center hover:bg-gray-700 transition-colors relative">
            <Users className="w-4 h-4 mr-2" />
            Team
            {collaborators.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs">
                {collaborators.length}
              </span>
            )}
          </button>
          
          {/* Share button */}
          <button className="px-3 py-2 bg-gray-800 rounded flex items-center hover:bg-gray-700 transition-colors">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </button>
          
          {/* Generate from Data button */}
          <button
            className="px-3 py-2 bg-blue-600 rounded flex items-center hover:bg-blue-700 transition-colors ml-2"
            onClick={() => setShowGenerateVisualizationModal(true)}
          >
            <Database className="w-4 h-4 mr-2" />
            Generate from Data
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area - taking full height and width */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Canvas - with panning and navigation */}
          <div 
            ref={canvasRef}
            className="w-full h-full relative bg-gray-900 overflow-hidden cursor-grab"
            style={{
              cursor: isCanvasDragging ? 'grabbing' : (activelyDraggingChart ? 'grabbing' : activelyResizingChart ? 'se-resize' : 'grab'),
              transition: smoothTransition ? 'transform 0.3s ease' : 'none',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }}
            onMouseDown={(e) => {
              // Only trigger canvas dragging when not interacting with charts
              if (e.button === 0 && !activelyDraggingChart && !activelyResizingChart) {
                dragStartRef.current = { x: e.clientX, y: e.clientY };
                setIsCanvasDragging(true);
                e.preventDefault();
              }
            }}
            onMouseMove={(e) => {
              // Handle chart resizing with proper error handling
              if (activelyResizingChart && chartResizeStartRef.current) {
                try {
                  handleChartResizeMove(e);
                } catch (error) {
                  console.warn('Error during chart resize:', error);
                  setActivelyResizingChart(null);
                  chartResizeStartRef.current = null;
                }
                return;
              }
              
              // Handle chart dragging with safe reference checks
              if (activelyDraggingChart && chartDragStartRef.current) {
                try {
                  handleChartDragMove(e);
                } catch (error) {
                  console.warn('Error during chart drag:', error);
                  setActivelyDraggingChart(null);
                  chartDragStartRef.current = null;
                }
                return;
              }
              
              // Handle canvas dragging (only if not handling charts)
              if (isCanvasDragging && dragStartRef.current) {
                try {
                  const dx = e.clientX - dragStartRef.current.x;
                  const dy = e.clientY - dragStartRef.current.y;
                  
                  setCanvasOffset(prev => ({
                    x: prev.x + dx,
                    y: prev.y + dy
                  }));
                  
                  // Update reference point for next move
                  dragStartRef.current = { x: e.clientX, y: e.clientY };
                } catch (error) {
                  console.warn('Error during canvas drag:', error);
                  setIsCanvasDragging(false);
                  dragStartRef.current = null;
                }
              }
            }}
            onMouseUp={() => {
              // Safely clean up all interactions
              try {
                // First check resize state
                if (activelyResizingChart) {
                  handleChartResizeEnd();
                }
                
                // Then check drag state
                if (activelyDraggingChart) {
                  handleChartDragEnd();
                }
                
                // Finally, reset canvas drag state
                setIsCanvasDragging(false);
                dragStartRef.current = null;
              } catch (error) {
                console.warn('Error during interaction cleanup:', error);
                // Ensure all state is reset
                setActivelyResizingChart(null);
                setActivelyDraggingChart(null);
                setIsCanvasDragging(false);
                chartResizeStartRef.current = null;
                chartDragStartRef.current = null;
                dragStartRef.current = null;
              }
            }}
            onMouseLeave={() => {
              // Same cleanup logic as onMouseUp
              try {
                if (activelyResizingChart) {
                  handleChartResizeEnd();
                }
                
                if (activelyDraggingChart) {
                  handleChartDragEnd();
                }
                
                setIsCanvasDragging(false);
                dragStartRef.current = null;
              } catch (error) {
                console.warn('Error during interaction cleanup on leave:', error);
                // Ensure all state is reset
                setActivelyResizingChart(null);
                setActivelyDraggingChart(null);
                setIsCanvasDragging(false);
                chartResizeStartRef.current = null;
                chartDragStartRef.current = null;
                dragStartRef.current = null;
              }
            }}
            onClick={() => {
              // Handle clicks only if not dragging
              if (!isCanvasDragging && !activelyDraggingChart && !activelyResizingChart) {
                // Logic for clicks if needed
              }
            }}
            onWheel={(e) => {
              // Zoom with mouse wheel + Ctrl key
              if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.01;
                setZoomLevel(prev => Math.min(Math.max(20, prev + delta * 10), 400));
              }
            }}
          >
            <div
              className="transition-transform duration-200 relative min-h-full"
              style={{ 
                transform: `scale(${zoomLevel / 100}) translate(${canvasOffset.x}px, ${canvasOffset.y}px)`, 
                transformOrigin: 'top left' 
              }}
            >
              {workspace.charts.length > 0 ? (
                <div className="h-full w-full relative">
                  {activelyDraggingChart && (
                    <div className="absolute inset-0 bg-blue-500/5 border-2 border-dashed border-blue-500/30 rounded-md pointer-events-none z-0"></div>
                  )}
                  {getChartGridItems().map(chart => (
                    <div
                      key={chart.id}
                      className={`absolute ${chart.size === 'small' ? 'w-72 h-72' : 
                                            chart.size === 'medium' ? 'w-96 h-80' : 
                                            chart.size === 'large' ? 'w-[30rem] h-96' : 
                                            'w-[calc(100%-4rem)] h-[calc(100%-4rem)] left-8 top-8'}`}
                      style={chart.style}
                    >
                      {chart.content}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="text-center p-8 border-2 border-dashed border-gray-700 rounded-lg bg-gray-900/40 backdrop-blur-sm max-w-md mx-auto">
                    <Grid className="w-12 h-12 mx-auto text-blue-500 mb-3 opacity-80" />
                    <h3 className="text-xl font-medium text-gray-200 mb-2">
                      No Charts Added
                    </h3>
                    <p className="text-gray-400 mb-4 text-sm">
                      Create your first chart to start visualizing your data.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center">
                    <button 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center"
                      onClick={handleAddChart}
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                      Add Chart
                    </button>
                      <button 
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-md flex items-center"
                        onClick={() => setShowDataPanel(true)}
                      >
                        <Database className="w-4 h-4 mr-1.5" />
                        Connect Data
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show collaborator cursors and active chart outline */}
              {collaborators.map(user => (
                user.cursor && (
                  <div 
                    key={user.id}
                    className="absolute pointer-events-none z-50 transition-all duration-200 ease-out"
                    style={{ 
                      left: `${user.cursor.x}px`, 
                      top: `${user.cursor.y}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {/* Cursor */}
                    <div className="relative">
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none"
                        style={{ color: user.color }}
                      >
                        <path 
                          d="M6 2L18 12L13 14L16 22L14 23L11 15L6 20L6 2Z" 
                          fill="currentColor" 
                          stroke="white" 
                          strokeWidth="1"
                        />
                      </svg>
                      
                      {/* User label */}
                      <div 
                        className="absolute left-5 top-0 px-2 py-1 text-xs text-white rounded whitespace-nowrap"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name}
                      </div>
                    </div>
                  </div>
                )
              ))}
          </div>
          
            {/* Reset view button */}
            <div className="absolute top-4 left-4 bg-gray-800 rounded-lg shadow-lg z-10 p-1">
              <div className="flex items-center space-x-1">
                <button 
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setCanvasOffset({ x: 0, y: 0 });
                    setZoomLevel(100);
                  }}
                  title="Reset View"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10M9 5.5l3-3 3 3" />
                  </svg>
                </button>
                <div className="border-l border-gray-600 h-4 mx-1"></div>
                <button
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  onClick={() => setZoomLevel(prev => Math.max(prev - 10, 20))}
                  title="Zoom Out"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-xs px-1 text-gray-300 min-w-[40px] text-center">{zoomLevel}%</span>
                <button
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  onClick={() => setZoomLevel(prev => Math.min(prev + 10, 400))}
                  title="Zoom In"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <select
                  className="ml-1 bg-gray-700 text-xs rounded p-1 text-gray-300 border-0"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  title="Zoom Level"
                >
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                  <option value="150">150%</option>
                  <option value="200">200%</option>
                  <option value="300">300%</option>
                  <option value="400">400%</option>
                </select>
                <div className="border-l border-gray-600 h-4 mx-1"></div>
                <button
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors"
                  onClick={autoArrangeCharts}
                  title="Auto-arrange Charts"
                  disabled={!workspace || workspace.charts.length === 0}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                        </div>
            </div>
            
            {/* Floating action button for adding charts */}
            <div className="absolute bottom-6 right-6 z-20">
              <button
                className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center group"
                onClick={handleAddChart}
                title="Add Chart"
              >
                <Plus className="w-7 h-7 text-white" />
                <span className="absolute right-full mr-3 bg-gray-800 text-white px-3 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Add Chart
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Generate Visualization Modal */}
      {showGenerateVisualizationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <QdrantVisualizationGenerator
            onVisualizationGenerated={handleVisualizationGenerated}
            onClose={() => setShowGenerateVisualizationModal(false)}
          />
        </div>
      )}
    </div>
  );
};