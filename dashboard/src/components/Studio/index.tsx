import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StudioWorkspace } from './StudioWorkspace';
import { StudioEditor } from './StudioEditor';
import { useStudio } from '../../contexts/StudioContext';
import { DataSourcesProvider } from '../../contexts/DataSourcesContext';
import { useWorkspaces } from '../../contexts/WorkspacesContext';
import { disableStudioDebugLogs } from '../../utils/debugHelper';
import './studio.css';

// Add local storage key for last workspace
const LAST_WORKSPACE_KEY = 'studio_last_workspace_id';

// Initialize by disabling excessive debug logs
disableStudioDebugLogs();

interface StudioProps {
  workspaceId?: string;
  chartTemplateId?: string;
  onClose?: () => void;
  isFullPage?: boolean;
}

/**
 * Main Studio component that handles routing between workspace listing and editor
 */
export const Studio: React.FC<StudioProps> = ({ 
  workspaceId, 
  chartTemplateId, 
  onClose,
  isFullPage = false
}) => {
  // Add render count tracking
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  
  // Only log once on mount to reduce console spam
  useEffect(() => {
    console.log('Studio component initialized, workspaceId:', workspaceId);
    
    // Add popstate event listener to handle navigation without page reload
    const handlePopState = (event: PopStateEvent) => {
      console.log('Navigation state change detected:', event.state);
      
      // If we have a workspace ID in the state, load it
      if (event.state && event.state.workspaceId) {
        console.log('Loading workspace from popstate event:', event.state.workspaceId);
        setActiveWorkspaceId(event.state.workspaceId);
        setActiveView('editor');
        setIsEditorReady(true);
        
        // Also save to localStorage for persistence
        saveLastWorkspaceId(event.state.workspaceId);
      }
    };
    
    // Add the event listener
    window.addEventListener('popstate', handlePopState);
    
    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
  
  // Use the Studio context
  const {
    activeWorkspaceId: contextWorkspaceId,
    setActiveWorkspaceId,
    activeChartTemplateId: contextChartTemplateId, 
    setActiveChartTemplateId,
    workspaceName: contextWorkspaceName,
    setWorkspaceName,
    workspaceDescription: contextWorkspaceDescription,
    setWorkspaceDescription,
    setIsEditMode
  } = useStudio();
  
  // Use workspaces context for persistence
  const { 
    createWorkspace: apiCreateWorkspace
  } = useWorkspaces();
  
  // Maintain a reference to the initial load state
  const hasInitialized = useRef(false);
  // Add a state to track if we're ready to show the StudioEditor
  const [isEditorReady, setIsEditorReady] = useState(false);
  
  // Try to load last workspace ID from local storage if needed
  const getLastWorkspaceId = useCallback(() => {
    try {
      return localStorage.getItem(LAST_WORKSPACE_KEY);
    } catch (e) {
      console.error('Error accessing local storage:', e);
      return null;
    }
  }, []);

  // Save workspace ID to local storage
  const saveLastWorkspaceId = useCallback((id: string) => {
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, id);
    } catch (e) {
      console.error('Error saving to local storage:', e);
    }
  }, []);
  
  // Prioritize props over context, but use context as fallback
  // Also try localStorage as a last resort for persistence
  const getEffectiveWorkspaceId = useCallback(() => {
    if (workspaceId) return workspaceId;
    if (contextWorkspaceId) return contextWorkspaceId;
    if (!hasInitialized.current) {
      const savedId = getLastWorkspaceId();
      if (savedId) return savedId;
    }
    return undefined;
  }, [workspaceId, contextWorkspaceId, getLastWorkspaceId]);

  // Stabilize the workspace ID to prevent constant rerenders
  const effectiveWorkspaceId = useMemo(() => {
    return getEffectiveWorkspaceId();
  }, [getEffectiveWorkspaceId]);
  
  const effectiveChartTemplateId = chartTemplateId || contextChartTemplateId || undefined;
  
  // Additionally, track if the tab has changed to avoid reloads when the user switches tabs
  const [tabChangeCount, setTabChangeCount] = useState(0);
  
  const [activeView, setActiveView] = useState<'workspace-list' | 'editor'>(
    effectiveWorkspaceId ? 'editor' : 'workspace-list'
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Directly check URL parameters on initial load 
  useEffect(() => {
    console.log('Studio component initializing or URL parameters changed');
    
    // Parse query parameters from the URL
    const queryParams = new URLSearchParams(window.location.search);
    const urlWorkspaceId = queryParams.get('workspace');
    
    // CRITICAL FIX: Always prioritize the URL workspace ID
    if (urlWorkspaceId) {
      console.log('URL contains workspace ID:', urlWorkspaceId);
      
      // If we have a valid workspace ID in the URL, use it
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlWorkspaceId)) {
        // Reset the editor state
        setIsEditorReady(false);
        
        // Set the active workspace ID from URL
        setActiveWorkspaceId(urlWorkspaceId);
        
        // Save to localStorage for persistence
        localStorage.setItem('studio_last_workspace_id', urlWorkspaceId);
        
        // Force editor mode
        setActiveView('editor');
        
        // After a short delay, mark the editor as ready
        setTimeout(() => {
          setIsEditorReady(true);
          console.log('Editor ready with URL workspace ID:', urlWorkspaceId);
        }, 50);
      }
    }
  }, [setActiveWorkspaceId, setActiveView, setIsEditorReady]);

  // When props or context change, update the active view
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      console.log('Studio: Initializing component')
    }
    
    // If tab has just changed, increment the counter to avoid multiple loads
    const isTabChange = document.visibilityState === 'visible' && tabChangeCount === 0;
    if (isTabChange) {
      setTabChangeCount(prev => prev + 1);
      return;
    }
    
    const hasWorkspace = effectiveWorkspaceId || effectiveChartTemplateId;
    if (hasWorkspace) {
      setIsTransitioning(true);
      setActiveView('editor');
      
      if (effectiveWorkspaceId) {
        // CRITICAL FIX: Don't proceed with temporary workspace IDs if we're initializing
        // This prevents the temporary workspace from being created when a persistent one exists
        if (effectiveWorkspaceId.startsWith('workspace-')) {
          console.warn('FIXING: Detected attempt to use temporary workspace ID. Canceling initialization.');
          setIsTransitioning(false);
          return;
        }
        
        // Force clear previous workspace state to prevent mixing
        setWorkspaceName('');
        setWorkspaceDescription('');
        setIsEditorReady(false);
        
        // Set the workspace ID directly - this will be passed to the StudioEditor
        console.log('Setting active workspace ID to persistent ID:', effectiveWorkspaceId);
        setActiveWorkspaceId(effectiveWorkspaceId);
        saveLastWorkspaceId(effectiveWorkspaceId);
        
        // CRITICAL FIX: Use a simpler approach to loading workspace data
        // This reduces the number of re-renders and initialization calls
        if (effectiveWorkspaceId && !effectiveWorkspaceId.startsWith('workspace-')) {
          console.log('Studio: Loading workspace data for ID:', effectiveWorkspaceId);
          
          // Set as ready immediately, and let StudioEditor handle its own loading state
              setIsEditorReady(true);
          
          // Clear transitioning flag after animation would complete
          const timeout = setTimeout(() => {
            setIsTransitioning(false);
          }, 300);
          
          return () => clearTimeout(timeout);
        } else {
          // For temporary workspaces, we can immediately set as ready
          setIsEditorReady(true);
          
          // Clear transitioning flag after animation completes
          setTimeout(() => {
            setIsTransitioning(false);
          }, 300);
        }
      }
      
      if (effectiveChartTemplateId) {
        setActiveChartTemplateId(effectiveChartTemplateId);
      }
    } else {
      // If we don't have a workspace, make sure the editor isn't shown
      setIsEditorReady(false);
    }
  }, [effectiveWorkspaceId, effectiveChartTemplateId, setActiveWorkspaceId, setActiveChartTemplateId, saveLastWorkspaceId]);

  // Handle returning to workspace list
  const handleReturnToList = useCallback(() => {
    if (!isFullPage && onClose) {
      // If not full page and has onClose, call it
      onClose();
    } else {
      // Otherwise go back to workspace list
      setIsTransitioning(true);
      setIsEditMode(false);
      
      // Reset all workspace state completely
      setWorkspaceName('');
      setWorkspaceDescription('');
      setActiveChartTemplateId(null);
      setIsEditorReady(false);
      
      // Small delay to allow for transition effect
      setTimeout(() => {
        setActiveView('workspace-list');
        setIsTransitioning(false);
      }, 100);
    }
  }, [isFullPage, onClose, setIsEditMode, setWorkspaceName, setWorkspaceDescription, setActiveChartTemplateId]);

  // Handle opening a workspace
  const handleOpenWorkspace = useCallback((workspaceId: string) => {
    console.log('Studio: Opening workspace with ID:', workspaceId);
    
    // SIMPLIFIED APPROACH: Use direct URL navigation for maximum reliability
    // This avoids complex state management that could lead to inconsistencies
    
    // 1. Save the ID to localStorage for persistence
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId);
      console.log('Saved workspace ID to localStorage:', workspaceId);
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
    
    // 2. Update URL and force navigation - most reliable approach
    const studioPath = '/studio';
    const newUrl = `${studioPath}?workspace=${workspaceId}`;
    console.log('Navigating directly to:', newUrl);
    
    // Use direct window.location navigation to ensure clean state
    window.location.href = newUrl;
  }, []);

  // Create a new workspace
  const handleCreateWorkspace = useCallback(
    async (chartTemplateId?: string, name?: string, description?: string) => {
      setIsTransitioning(true);

      try {
        console.log('Creating NEW PERSISTENT WORKSPACE with:', {
          chartTemplateId,
          name,
          description
        });

        if (!name) {
          name = 'Untitled Workspace';
        }

        if (!description) {
          description = 'Data analysis workspace';
        }

        // Call the API to create a new workspace in the database
        const response = await apiCreateWorkspace({
          title: name,
          description: description,
          tags: []
        });

        if (response && response.id) {
          // CRITICAL FIX: Store the exact workspace ID returned from the server
          const newWorkspaceId = response.id;
          console.log('SERVER RETURNED WORKSPACE ID:', newWorkspaceId);
          
          // CRITICAL FIX: Also store as the most recently created workspace ID
          // This provides a fallback mechanism for workspace recovery
          try {
            localStorage.setItem('most_recent_created_workspace_id', newWorkspaceId);
            console.log('Saved as most recently created workspace ID');
          } catch (e) {
            console.error('Error saving to most_recent_created_workspace_id:', e);
          }
          
          // Explicitly set all workspace-related state 
          setActiveWorkspaceId(newWorkspaceId);
          setWorkspaceName(name);
          setWorkspaceDescription(description);
          setActiveChartTemplateId(chartTemplateId || null);
          
          // Make sure to save to localStorage for persistence
          saveLastWorkspaceId(newWorkspaceId);
          
          // Set the active view to editor and mark it as ready
          setActiveView('editor');
          setIsEditorReady(true);
          
          // CRITICAL FIX: Update URL params with the EXACT workspace ID from server
          const params = new URLSearchParams(window.location.search);
          params.set('workspace', newWorkspaceId);
          if (chartTemplateId) {
            params.set('chartTemplate', chartTemplateId);
          } else {
            params.delete('chartTemplate');
          }
          
          // Replace URL with the correct workspace ID
          const newUrl = `${window.location.pathname}?${params}`;
          console.log('Updating URL to:', newUrl);
          window.history.replaceState({}, '', newUrl);
          
          console.log('Successfully created and initialized persistent workspace:', newWorkspaceId);
          return newWorkspaceId;
        } else {
          console.error('Failed to create workspace: API response missing ID', response);
          alert('Failed to create workspace. Please try again.');
          return null;
        }
      } catch (error) {
        console.error('Error creating workspace:', error);
        alert('An error occurred while creating the workspace. Please try again.');
        return null;
      } finally {
        // Use a timeout to make sure the transition effect looks good
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }
    },
    [apiCreateWorkspace, saveLastWorkspaceId, setActiveWorkspaceId, setWorkspaceName, setWorkspaceDescription, setActiveChartTemplateId]
  );

  // Handle close from workspace list
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Render the appropriate view with transition
  if (activeView === 'editor' && effectiveWorkspaceId && isEditorReady) {
    console.log('Rendering StudioEditor with workspace ID:', effectiveWorkspaceId);
  } else {
    console.log('Rendering StudioWorkspace');
  }
  
  return (
    <DataSourcesProvider>
      <div className={`studio-container h-full ${isTransitioning ? 'studio-transitioning' : ''}`}>
        {activeView === 'editor' && effectiveWorkspaceId ? (
          <StudioEditor 
            key={`workspace-${effectiveWorkspaceId}`}
            workspaceId={effectiveWorkspaceId} 
            initialChartTemplateId={effectiveChartTemplateId}
            workspaceName={contextWorkspaceName || undefined}
            workspaceDescription={contextWorkspaceDescription || undefined}
            onClose={handleReturnToList}
          />
        ) : (
          <StudioWorkspace 
            onOpenWorkspace={handleOpenWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onClose={handleClose}
          />
        )}
      </div>
    </DataSourcesProvider>
  );
};

export default Studio; 