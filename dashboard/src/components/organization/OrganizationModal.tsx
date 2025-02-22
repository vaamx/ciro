import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Building2, Upload, X } from 'lucide-react';

interface OrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization?: {
    id: number;
    name: string;
    description?: string;
    logo_url?: string;
  };
}

export function OrganizationModal({ isOpen, onClose, organization }: OrganizationModalProps) {
  const { loadOrganizations } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getLogoUrl = (logoPath: string | undefined | null): string => {
    if (!logoPath) return '';
    // Avoid adding /files prefix if it's already there
    return logoPath.startsWith('/files') ? logoPath : `/files${logoPath}`;
  };

  // Reset form data when modal opens or organization changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: organization?.name || '',
        description: organization?.description || '',
      });
      setLogoFile(null);
      setLogoPreview(organization?.logo_url ? getLogoUrl(organization.logo_url) : '');
    }
  }, [isOpen, organization]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size should be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogoFile(null);
    setLogoPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      if (formData.description) {
        formDataToSend.append('description', formData.description);
      }
      if (logoFile) {
        formDataToSend.append('logo', logoFile, logoFile.name);
      }

      const url = organization
        ? `/api/organizations/${organization.id}`
        : '/api/organizations';
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        method: organization ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save organization');
      }

      await loadOrganizations();
      onClose();
    } catch (error) {
      console.error('Error saving organization:', error);
      alert(error instanceof Error ? error.message : 'Failed to save organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-white mb-6">
          {organization ? 'Edit Organization' : 'Create Organization'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload */}
          <div className="flex flex-col items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <div 
              onClick={handleImageClick}
              className="relative cursor-pointer group"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center border-2 border-gray-600 hover:border-purple-500 transition-colors">
                {logoPreview ? (
                  <img 
                    src={logoPreview} 
                    alt="Organization logo" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload size={24} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-400">Upload Logo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                  <Upload size={20} className="text-white opacity-0 group-hover:opacity-100" />
                </div>
              </div>
              {logoPreview && (
                <div
                  onClick={handleRemoveImage}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                >
                  <X size={14} className="text-white" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Click to upload (max 5MB)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white focus:outline-none"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 