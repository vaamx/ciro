import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Briefcase, 
  Users, 
  History, 
  Share2, 
  Sliders, 
  Save,
  PlusCircle,
  Search,
  Filter,
  AlertCircle,
  RefreshCw,
  Plus,
  BarChart2,
  Box
} from 'lucide-react';
import { useStudio } from '../../contexts/StudioContext';
import { useWorkspaces, Workspace } from '../../contexts/WorkspacesContext';

type TabType = 'projects' | 'templates';

interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  lastModified: string;
  collaborators: number;
  visualizations: number;
  tags?: string[];
  createdBy?: string;
}

interface StudioWorkspaceProps {
  onOpenWorkspace: (id: string) => void;
  onCreateWorkspace: (chartTemplateId?: string, name?: string, description?: string) => void;
  onClose?: () => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  backgroundColor: string;
}

// Define a service for workspace data operations
const workspaceService = {
  // Fetch all workspaces
  fetchWorkspaces: async (): Promise<WorkspaceProject[]> => {
    // Simulate API call with timeout
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "proj-1",
            name: "Q2 Sales Analysis",
            description: "Collaborative workspace for analyzing Q2 sales performance across regions",
            lastModified: "2 hours ago",
            collaborators: 4,
            visualizations: 7,
            tags: ["sales", "quarterly", "regions"],
            createdBy: "Alex Johnson"
          },
          {
            id: "proj-2",
            name: "Manufacturing Efficiency",
            description: "Workspace for testing hypotheses related to production line efficiency metrics",
            lastModified: "Yesterday",
            collaborators: 2,
            visualizations: 5,
            tags: ["manufacturing", "efficiency", "metrics"],
            createdBy: "Sarah Chen"
          },
          {
            id: "proj-3",
            name: "Customer Satisfaction",
            description: "Analysis workspace for customer satisfaction scores and feedback trends",
            lastModified: "3 days ago",
            collaborators: 3,
            visualizations: 4,
            tags: ["customer", "satisfaction", "feedback"],
            createdBy: "Michael Davis"
          },
          {
            id: "proj-4",
            name: "Marketing Campaign ROI",
            description: "Analysis of return on investment for recent marketing campaigns",
            lastModified: "1 week ago",
            collaborators: 5,
            visualizations: 8,
            tags: ["marketing", "roi", "campaigns"],
            createdBy: "Jessica Taylor"
          }
        ]);
      }, 800); // Simulate network delay
    });
  },
  
  // Share a workspace
  shareWorkspace: async (id: string): Promise<{ success: boolean }> => {
    // Simulate API call
    console.log(`Sharing workspace: ${id}`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 500);
    });
  },
  
  // Get available templates
  fetchTemplates: async (): Promise<Template[]> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 'hypothesis-testing',
            name: 'Hypothesis Testing',
            description: 'Framework for testing business hypotheses with visualization experiments',
            icon: <Sliders className="w-12 h-12 text-blue-500" />,
            backgroundColor: 'bg-blue-50 dark:bg-blue-900/20'
          },
          {
            id: 'team-analysis',
            name: 'Team Analysis',
            description: 'Collaborative workspace optimized for multi-user analysis sessions',
            icon: <Users className="w-12 h-12 text-purple-500" />,
            backgroundColor: 'bg-purple-50 dark:bg-purple-900/20'
          },
          {
            id: 'version-comparison',
            name: 'Version Comparison',
            description: 'Compare different versions of visualizations and track changes over time',
            icon: <Save className="w-12 h-12 text-green-500" />,
            backgroundColor: 'bg-green-50 dark:bg-green-900/20'
          }
        ]);
      }, 600);
    });
  }
};

// Define a wrapper that converts from our database Workspace model to the UI WorkspaceProject format
const mapWorkspaceToProject = (workspace: Workspace): WorkspaceProject => {
  return {
    id: workspace.id,
    name: workspace.title,
    description: workspace.description || '',
    lastModified: workspace.updated_at ? formatTimeAgo(workspace.updated_at) : 'Just now',
    collaborators: 1, // Default value - we don't have collaborators yet
    visualizations: 0, // This should be retrieved from charts count in the future
    tags: workspace.tags || [],
    createdBy: 'You'
  };
};

// Simple function to format time like "2 hours ago" from a date string
const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
};

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({ 
  onOpenWorkspace, 
  onCreateWorkspace,
  onClose
}) => {
  // Add render count tracking 
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  
  // Only log every 5th render to reduce console spam
  if (renderCountRef.current % 5 === 1) {
    console.log('StudioWorkspace render #', renderCountRef.current);
    console.log('StudioWorkspace props:', { 
      hasOpenWorkspace: typeof onOpenWorkspace === 'function', 
      hasCreateWorkspace: typeof onCreateWorkspace === 'function',
      hasClose: typeof onClose === 'function' 
    });
  }
  
  // Get the studio context for fallback behavior
  const {
    // These were previously used by the now-removed functions
    // Keeping them would cause linter warnings for unused variables
  } = useStudio();
  
  // Use workspaces context for real data
  const { 
    workspaces, 
    error: workspacesError,
    refreshWorkspaces,
    deleteWorkspace,
    createWorkspace: apiCreateWorkspace
  } = useWorkspaces();
  
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'visualizations'>('recent');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sharingWorkspace, setSharingWorkspace] = useState<string | null>(null);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  
  // Fetch templates on component mount and setup workspaces from context
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      
      try {
        // Only fetch templates - workspaces come from context
        const templatesData = await workspaceService.fetchTemplates();
        setTemplates(templatesData);
        
        // Make sure we have the latest workspaces data
        if (refreshWorkspaces) {
          await refreshWorkspaces();
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setErrorMessage('Failed to load workspaces. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [refreshWorkspaces]);
  
  // Update projects whenever workspaces change in the context
  useEffect(() => {
    if (workspaces) {
      const mappedProjects = workspaces.map(mapWorkspaceToProject);
      setProjects(mappedProjects);
    }
  }, [workspaces]);
  
  // Set error message if workspaces fail to load
  useEffect(() => {
    if (workspacesError) {
      setErrorMessage(workspacesError);
    }
  }, [workspacesError]);
  
  // Handle sharing a workspace
  const handleShareWorkspace = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSharingWorkspace(workspaceId);
    
    try {
      const result = await workspaceService.shareWorkspace(workspaceId);
      if (result.success) {
        // Show a success message or open sharing dialog
        alert(`Workspace ${workspaceId} shared successfully!`);
      }
    } catch (error) {
      console.error('Error sharing workspace:', error);
      alert('Failed to share workspace. Please try again.');
    } finally {
      setSharingWorkspace(null);
    }
  };
  
  // Handle deleting a workspace
  const handleDeleteWorkspace = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await deleteWorkspace(workspaceId);
      // Refresh workspaces list after deletion
      refreshWorkspaces();
    } catch (error) {
      console.error('Error deleting workspace:', error);
      alert('Failed to delete workspace. Please try again.');
    }
  };
  
  // Function to show workspace stats
  const showWorkspaceStats = () => {
    let totalVisualizations = 0;
    let statsMessage = "Workspace Statistics:\n\n";
    
    workspaces.forEach(workspace => {
      const mappedProject = mapWorkspaceToProject(workspace);
      const visCount = mappedProject.visualizations || 0;
      totalVisualizations += visCount;
      
      statsMessage += `- ${mappedProject.name}: ${visCount} visualizations (ID: ${mappedProject.id})\n`;
    });
    
    statsMessage += `\nTotal: ${workspaces.length} workspaces, ${totalVisualizations} visualizations`;
    
    alert(statsMessage);
  };
  
  // Handle template selection
  const handleTemplateSelection = (templateId: string) => {
    console.log(`Using template: ${templateId}`);
    
    // Find the selected template
    const selectedTemplate = templates.find(t => t.id === templateId);
    
    if (selectedTemplate) {
      // Create a new workspace with template name as default
      setNewWorkspaceName(selectedTemplate.name);
      setNewWorkspaceDescription(selectedTemplate.description);
      setSelectedTemplateId(templateId);
      setShowNewWorkspaceModal(true);
    } else {
      // If template not found, just open the create modal
      console.log('Template not found, opening create workspace modal');
      setShowNewWorkspaceModal(true);
    }
  };
  
  // Remove the old direct navigation approach for the create button and use our internal handlers
  const handleCreateButtonClick = () => {
    // Open the new workspace modal with empty fields
    setNewWorkspaceName('');
    setNewWorkspaceDescription('');
    setSelectedTemplateId(undefined);
    setShowNewWorkspaceModal(true);
  };
  
  // Handle create new workspace
  const handleCreateNewWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      alert('Please enter a workspace name');
      return;
    }
    
    // Close modal
    setShowNewWorkspaceModal(false);
    
    try {
      // Create workspace using context API
      const workspaceData = {
        title: newWorkspaceName,
        description: newWorkspaceDescription || 'A collaborative workspace for data visualization',
        tags: []
      };
      
      console.log('Creating new workspace:', workspaceData);
      
      // Use the API to create the workspace
      const createdWorkspace = await apiCreateWorkspace(workspaceData);
      
      if (createdWorkspace && createdWorkspace.id) {
        console.log('Workspace created successfully:', createdWorkspace.id);
        
        // Use the same mechanism as clicking on an existing workspace
        handleOpenWorkspaceClick(createdWorkspace.id);
      } else {
        console.error('Failed to create workspace: No ID returned');
        alert('Failed to create workspace. Please try again.');
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('An error occurred while creating the workspace. Please try again.');
    }
    
    // Reset form values
    setNewWorkspaceName('');
    setNewWorkspaceDescription('');
    setSelectedTemplateId(undefined);
  };
  
  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        project.name.toLowerCase().includes(searchLower) ||
        project.description.toLowerCase().includes(searchLower) ||
        project.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        project.createdBy?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'visualizations') {
        return b.visualizations - a.visualizations;
      } else {
        // Sort by recent by default - this is simplified
        return a.id === 'proj-1' ? -1 : b.id === 'proj-1' ? 1 : 0;
      }
    });
  
  // Handle clicking a workspace tile - use direct navigation for reliability
  const handleOpenWorkspaceClick = useCallback((workspaceId: string) => {
    console.log('Opening workspace with direct navigation:', workspaceId);
    
    try {
      // Save to localStorage first for persistence
      localStorage.setItem('studio_last_workspace_id', workspaceId);
      
      // CRITICAL: Force a hard navigation to ensure clean component mounting
      const url = `/studio?workspace=${workspaceId}`;
      console.log('Navigating to:', url);
      
      // Use location.replace to prevent back button issues
      window.location.replace(url);
    } catch (e) {
      console.error('Error opening workspace:', e);
    }
  }, []);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading workspaces...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Workspace Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Studio Workspaces
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create, collaborate, and test hypotheses in interactive workspaces
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={showWorkspaceStats}
            className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"></path>
              <path d="M9 22h9a2 2 0 0 0 2-2v-7"></path>
              <path d="M13 2v8L8 7l5 3"></path>
              <circle cx="16" cy="19" r="3"></circle>
            </svg>
            View Stats
          </button>
          <button
            onClick={handleCreateButtonClick}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            New Workspace
          </button>
        </div>
      </div>

      {/* Tab selector for projects/templates */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex">
        <button
          onClick={() => setActiveTab('projects')}
          className={`mr-4 pb-2 text-sm font-medium ${
            activeTab === 'projects'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          My Workspaces
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`mr-4 pb-2 text-sm font-medium ${
            activeTab === 'templates'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Templates
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 mb-2"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading workspaces...</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && !isLoading && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2" />
              <div>
                <p className="text-red-700 dark:text-red-400">{errorMessage}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center hover:text-red-800 dark:hover:text-red-300"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh page
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects tab content */}
        {activeTab === 'projects' && !isLoading && !errorMessage && (
          <div>
            {/* Search and filters bar */}
            <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white text-sm placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Search workspaces..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex space-x-2">
                <select
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="recent">Recently modified</option>
                  <option value="name">Name</option>
                  <option value="visualizations">Visualizations</option>
                </select>
                <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Workspace grid */}
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleOpenWorkspaceClick(project.id)}
                    data-workspace-id={project.id}
                    className="workspace-item relative border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition duration-200 bg-white dark:bg-gray-900 flex flex-col hover:border-blue-400 dark:hover:border-blue-500"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-6">{project.name}</h3>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => handleShareWorkspace(project.id, e)}
                          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                          title="Share workspace"
                        >
                          {sharingWorkspace === project.id ? (
                            <div className="w-4 h-4 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                          ) : (
                            <Share2 size={16} className="text-gray-500 dark:text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                              handleDeleteWorkspace(project.id, e);
                            }
                          }}
                          className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                          title="Delete workspace"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 dark:text-red-400">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex-1 mb-4">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {project.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex space-x-3">
                        <div className="flex items-center">
                          <Users className="w-3.5 h-3.5 mr-1" />
                          <span>{project.collaborators}</span>
                        </div>
                        <div className="flex items-center">
                          <BarChart2 className="w-3.5 h-3.5 mr-1" />
                          <span>{project.visualizations}</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <History className="w-3.5 h-3.5 mr-1" />
                        <span>{project.lastModified}</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add a "Create New" tile */}
                <div
                  onClick={handleCreateButtonClick}
                >
                  <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 cursor-pointer bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                      <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">Create New Workspace</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Start a new analysis project
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-gray-500 dark:text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No workspaces found</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1 mb-4">
                  {searchTerm
                    ? `No workspaces match "${searchTerm}"`
                    : "You haven't created any workspaces yet"}
                </p>
                <button
                  onClick={handleCreateButtonClick}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </button>
              </div>
            )}
          </div>
        )}

        {/* Templates tab content */}
        {activeTab === 'templates' && !isLoading && !errorMessage && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelection(template.id)}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 cursor-pointer hover:shadow-md transition duration-200 bg-white dark:bg-gray-900 flex flex-col hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <div className={`w-16 h-16 ${template.backgroundColor} rounded-lg flex items-center justify-center mb-4`}>
                    {template.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                    {template.description}
                  </p>
                </div>
              ))}
              
              {/* Add a custom template option */}
              <div
                onClick={handleCreateButtonClick}
              >
                <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 cursor-pointer bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                    <Plus className="w-8 h-8 text-gray-400 dark:text-gray-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Blank Workspace
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Start from scratch with an empty workspace
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-200 dark:border-gray-700">
              <div className="bg-white dark:bg-gray-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Create New Workspace
                    </h3>
                    
                    <div className="mt-4">
                      <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Workspace Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="workspace-name"
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter workspace name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    
                    <div className="mt-4">
                      <label htmlFor="workspace-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Description
                      </label>
                      <textarea
                        id="workspace-description"
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Describe the purpose of this workspace"
                        value={newWorkspaceDescription}
                        onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                      />
                    </div>
                    
                    {selectedTemplateId && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                        <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                          <Box className="w-4 h-4 mr-2" />
                          Using template: {templates.find(t => t.id === selectedTemplateId)?.name || selectedTemplateId}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
                  onClick={handleCreateNewWorkspace}
                >
                  Create Workspace
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowNewWorkspaceModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioWorkspace; 