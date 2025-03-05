import React, { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';

interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

interface DashboardFormProps {
  onSubmit: (data: {
    name: string;
    description: string;
    organization_id: number;
    team_id?: number;
    category_id?: number;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DashboardForm({ onSubmit, onCancel, isSubmitting }: DashboardFormProps) {
  const { currentOrganization, organizations, teams } = useOrganization();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization_id: currentOrganization?.id || '',
    team_id: '',
    category_id: '',
  });

  // Load categories when organization changes
  useEffect(() => {
    const loadCategories = async () => {
      if (!formData.organization_id) return;
      
      try {
        const response = await fetch(`/api/organizations/${formData.organization_id}/categories`);
        if (!response.ok) throw new Error('Failed to load categories');
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([]);
      }
    };

    loadCategories();
  }, [formData.organization_id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      organization_id: Number(formData.organization_id),
      team_id: formData.team_id ? Number(formData.team_id) : undefined,
      category_id: formData.category_id ? Number(formData.category_id) : undefined,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40"></div>
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ margin: 0, padding: 0 }}>
        <div className="min-h-screen flex items-center justify-center p-0">
          <div className="relative bg-gray-800 rounded-lg p-6 w-full max-w-md m-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Organization
                </label>
                <select
                  value={formData.organization_id}
                  onChange={(e) => setFormData({
                    ...formData,
                    organization_id: e.target.value,
                    team_id: '', // Reset team when organization changes
                    category_id: '', // Reset category when organization changes
                  })}
                  className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.organization_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Team (Optional)
                  </label>
                  <select
                    value={formData.team_id}
                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.organization_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Category (Optional)
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-300 hover:text-white focus:outline-none"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
} 