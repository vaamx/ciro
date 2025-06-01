import React, { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Upload, X } from 'lucide-react';
import { buildApiUrl } from '../../contexts/AuthContext';

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
    
    // If logoPath already starts with http or /, use it as-is
    if (logoPath.startsWith('http') || logoPath.startsWith('/')) {
      // If it starts with /files/, prepend the backend server URL
      if (logoPath.startsWith('/files/')) {
        return `http://localhost:3001${logoPath}`;
      }
      return logoPath;
    }
    
    // Otherwise, construct the full URL
    return `http://localhost:3001/files/${logoPath}`;
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      try {
        // Convert image to a web-safe format (JPEG/PNG)
        const canvas = document.createElement('canvas');
        const img = new Image();
        
        img.onload = () => {
          // Scale down if necessary while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          const maxDimension = 1024;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to PNG format
          canvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.png', {
                type: 'image/png'
              });
              setLogoFile(processedFile);
              setLogoPreview(URL.createObjectURL(processedFile));
            }
          }, 'image/png', 0.9);
        };
        
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('Error processing image:', error);
        alert('Failed to process image. Please try another file.');
      }
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
        formDataToSend.append('logo', logoFile);
        console.log('Logo file details:', {
          name: logoFile.name,
          type: logoFile.type,
          size: logoFile.size
        });
      }

      const url = organization
        ? buildApiUrl(`organizations/${organization.id}`)
        : buildApiUrl('organizations');
      
      const token = localStorage.getItem('auth_token');
      console.log('Sending request to:', url);
      
      const response = await fetch(url, {
        method: organization ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        mode: 'cors',
        credentials: 'include',
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error('Server response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          url: response.url,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(errorData.error || `Failed to save organization (${response.status})`);
      }

      const responseData = await response.json();
      console.log('Success response:', responseData);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-white">
            {organization ? 'Edit Organization' : 'Create Organization'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center border-2 border-gray-600 hover:border-purple-500 transition-colors">
                {logoPreview ? (
                  <img 
                    src={logoPreview} 
                    alt="Organization logo" 
                    className="w-full h-full object-cover"
                    crossOrigin="use-credentials"
                    onError={(e) => {
                      // Use fallback SVG if image fails to load
                      e.currentTarget.src = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3crect width="18" height="18" x="3" y="3" rx="2" ry="2"%3e%3c/rect%3e%3crect width="8" height="8" x="8" y="8" rx="1" ry="1"%3e%3c/rect%3e%3c/svg%3e';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload size={20} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-400">Upload Logo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                  <Upload size={18} className="text-white opacity-0 group-hover:opacity-100" />
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
              placeholder="Enter organization name"
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
              placeholder="Describe your organization (optional)"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md font-medium transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-md font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : organization ? 'Save Changes' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 