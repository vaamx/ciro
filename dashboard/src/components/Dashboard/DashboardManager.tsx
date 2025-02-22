import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard?: {
    id: string;
    name: string;
    description?: string;
    team?: string;
    category?: string;
  };
}

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose, dashboard }) => {
  const { addDashboard, updateDashboard } = useDashboard();
  const { user } = useAuth();
  const [name, setName] = useState(dashboard?.name || '');
  const [description, setDescription] = useState(dashboard?.description || '');
  const [team, setTeam] = useState(dashboard?.team || '');
  const [category, setCategory] = useState(dashboard?.category || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(dashboard?.name || '');
      setDescription(dashboard?.description || '');
      setTeam(dashboard?.team || '');
      setCategory(dashboard?.category || '');
      setError(null);
    }
  }, [isOpen, dashboard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const dashboardData = {
        name: name.trim(),
        description: description.trim(),
        team: team.trim(),
        category: category.trim(),
      };

      if (dashboard?.id) {
        await updateDashboard(dashboard.id, dashboardData);
      } else {
        await addDashboard({
          ...dashboardData,
          widgets: [],
          metrics: [],
          createdBy: user?.id || 0,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">
          {dashboard ? 'Edit Dashboard' : 'Create New Dashboard'}
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name <span className="text-xs text-gray-500">({name.length}/{MAX_NAME_LENGTH})</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description <span className="text-xs text-gray-500">({description.length}/{MAX_DESCRIPTION_LENGTH})</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows={3}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team</label>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (dashboard ? 'Saving...' : 'Creating...') : (dashboard ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const DashboardManager: React.FC = () => {
  const { dashboards, currentDashboard, switchDashboard, deleteDashboard, isLoading, error } = useDashboard();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<typeof dashboards[0] | undefined>();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async (dashboardId: string) => {
    if (!window.confirm('Are you sure you want to delete this dashboard?')) {
      return;
    }
    try {
      setIsDeleting(dashboardId);
      await deleteDashboard(dashboardId);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (dashboard: typeof dashboards[0]) => {
    setSelectedDashboard(dashboard);
    setShowModal(true);
    setIsDropdownOpen(false);
  };

  const handleCreateNew = () => {
    setSelectedDashboard(undefined);
    setShowModal(true);
    setIsDropdownOpen(false);
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
        <Icons.Loader className="w-4 h-4 animate-spin" />
        <span className="font-medium">Loading dashboards...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
        <Icons.AlertCircle className="w-4 h-4" />
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Icons.Layout size={16} />
            <span className="font-medium max-w-[200px] truncate">
              {currentDashboard?.name || 'Select Dashboard'}
            </span>
            <Icons.ChevronDown 
              size={16} 
              className={`transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </button>
          <button
            onClick={handleCreateNew}
            className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
            title="Create New Dashboard"
          >
            <Icons.Plus size={16} />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                Your Dashboards
              </div>
              {dashboards.length === 0 ? (
                <div className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No dashboards found. Create your first one!
                </div>
              ) : (
                dashboards.map((dashboard) => (
                  <div
                    key={dashboard.id}
                    className={`group flex items-center justify-between px-2 py-2 rounded-md ${
                      currentDashboard?.id === dashboard.id
                        ? 'bg-purple-50 dark:bg-purple-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div 
                      className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer" 
                      onClick={() => {
                        switchDashboard(dashboard.id);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <Icons.Layout 
                        size={14} 
                        className={`flex-shrink-0 ${
                          currentDashboard?.id === dashboard.id
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {dashboard.name}
                        </div>
                        {(dashboard.team || dashboard.category) && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {dashboard.team && (
                              <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 truncate max-w-[100px]">
                                {dashboard.team}
                              </span>
                            )}
                            {dashboard.category && (
                              <span className="px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 truncate max-w-[100px]">
                                {dashboard.category}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(dashboard)}
                        className="p-1 text-gray-400 hover:text-purple-600 dark:text-gray-500 dark:hover:text-purple-400"
                        title="Edit Dashboard"
                      >
                        <Icons.Settings size={14} />
                      </button>
                      {dashboard.id !== 'default' && (
                        <button
                          onClick={() => handleDelete(dashboard.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 disabled:opacity-50"
                          disabled={isDeleting === dashboard.id}
                          title="Delete Dashboard"
                        >
                          {isDeleting === dashboard.id ? (
                            <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Icons.Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <DashboardModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDashboard(undefined);
        }}
        dashboard={selectedDashboard}
      />
    </>
  );
}; 