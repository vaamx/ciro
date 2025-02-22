import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

// Generic type for any data that belongs to an organization
interface OrganizationScoped {
  organization_id: number;
  [key: string]: any;
}

// Generic context state and methods
interface OrganizationScopedContextState<T extends OrganizationScoped> {
  items: T[];
  currentItem: T | null;
  isLoading: boolean;
  error: string | null;
}

interface OrganizationScopedContextValue<T extends OrganizationScoped> extends OrganizationScopedContextState<T> {
  addItem: (item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, item: Partial<T>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  switchItem: (id: string) => void;
}

interface ApiService<T extends OrganizationScoped> {
  getItems: (organizationId: number) => Promise<T[]>;
  createItem: (item: Partial<T>) => Promise<T>;
  updateItem: (id: string, item: Partial<T>) => Promise<T>;
  deleteItem: (id: string) => Promise<void>;
}

export function createOrganizationScopedContext<T extends OrganizationScoped>(
  apiService: ApiService<T>,
  contextName: string
) {
  const Context = createContext<OrganizationScopedContextValue<T> | undefined>(undefined);

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<T[]>([]);
    const [currentItem, setCurrentItem] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();

    // Reset state when organization changes
    useEffect(() => {
      setItems([]);
      setCurrentItem(null);
      setError(null);
    }, [currentOrganization?.id]);

    // Fetch items when organization changes
    useEffect(() => {
      const fetchItems = async () => {
        try {
          setIsLoading(true);
          setError(null);

          if (!user || !currentOrganization) {
            setItems([]);
            setCurrentItem(null);
            return;
          }

          const fetchedItems = await apiService.getItems(currentOrganization.id);
          
          // Filter items to only include those belonging to the current organization
          const orgItems = fetchedItems.filter(
            item => item.organization_id === currentOrganization.id
          );
          
          setItems(orgItems);
          setCurrentItem(orgItems.length > 0 ? orgItems[0] : null);
        } catch (err) {
          if (err instanceof Error && !err.message.includes('No authentication token found')) {
            setError(err.message);
            console.error(`Error fetching ${contextName}:`, err);
          }
        } finally {
          setIsLoading(false);
        }
      };

      fetchItems();
    }, [user, currentOrganization?.id]);

    const addItem = async (item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!currentOrganization) {
        throw new Error('No organization selected');
      }

      try {
        setError(null);
        const newItem = await apiService.createItem({
          ...item,
          organization_id: currentOrganization.id,
        });
        
        if (newItem.organization_id === currentOrganization.id) {
          setItems([...items, newItem]);
          setCurrentItem(newItem);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to create ${contextName}`);
        throw err;
      }
    };

    const updateItem = async (id: string, updatedFields: Partial<T>) => {
      const itemToUpdate = items.find(i => i.id === id);
      if (!currentOrganization || !itemToUpdate || itemToUpdate.organization_id !== currentOrganization.id) {
        throw new Error(`Cannot update ${contextName} from different organization`);
      }

      try {
        setError(null);
        const updatedItem = await apiService.updateItem(id, updatedFields);
        
        if (updatedItem.organization_id === currentOrganization.id) {
          setItems(items.map(i => i.id === id ? updatedItem : i));
          if (currentItem?.id === id) {
            setCurrentItem(updatedItem);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to update ${contextName}`);
        throw err;
      }
    };

    const deleteItem = async (id: string) => {
      const itemToDelete = items.find(i => i.id === id);
      if (!currentOrganization || !itemToDelete || itemToDelete.organization_id !== currentOrganization.id) {
        throw new Error(`Cannot delete ${contextName} from different organization`);
      }

      try {
        setError(null);
        await apiService.deleteItem(id);
        setItems(items.filter(i => i.id !== id));
        if (currentItem?.id === id) {
          setCurrentItem(items.find(i => i.id !== id) || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to delete ${contextName}`);
        throw err;
      }
    };

    const switchItem = (id: string) => {
      const item = items.find(i => 
        i.id === id && 
        i.organization_id === currentOrganization?.id
      );
      if (item) {
        setCurrentItem(item);
      }
    };

    return (
      <Context.Provider value={{
        items,
        currentItem,
        isLoading,
        error,
        addItem,
        updateItem,
        deleteItem,
        switchItem,
      }}>
        {children}
      </Context.Provider>
    );
  };

  const useContext = () => {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error(`use${contextName} must be used within a ${contextName}Provider`);
    }
    return context;
  };

  return { Provider, useContext };
} 